// SVG → Google Drive → insertInlineImage pipeline.
// Google Drive transcodes SVGs server-side via lh3.googleusercontent.com,
// so we upload the SVG directly — no Docker/rsvg-convert needed.

import { readFileSync, writeFileSync, unlinkSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fail, createAuthClient } from "./api-client.ts";

const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

export function isSvgUri(uri: string): boolean {
  return /\.svg(\?|$)/i.test(uri) || uri.startsWith("data:image/svg");
}

/** SSRF blocklist — reject URLs targeting internal/metadata endpoints */
const SSRF_BLOCKLIST = [
  "169.254.",          // AWS/GCP metadata
  "metadata.google",   // GCP metadata
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  ".internal",
  "10.0.0.",
  "192.168.",
  "172.16.",
];

function isBlockedUrl(uri: string): boolean {
  const lower = uri.toLowerCase();
  return SSRF_BLOCKLIST.some((pattern) => lower.includes(pattern));
}

/** Download a URL to a temp file. */
export function downloadToFile(uri: string, ext: string): string {
  // Validate URI scheme to prevent SSRF (file://, internal IPs, metadata endpoints)
  if (!/^https?:\/\//i.test(uri)) {
    fail(`Image URI must use http(s): ${uri.slice(0, 80)}`);
  }
  if (isBlockedUrl(uri)) {
    fail(`Image URI blocked (internal/metadata endpoint): ${uri.slice(0, 80)}. Ensure URL is publicly accessible.`);
  }
  const filePath = path.join(tmpdir(), `gdocs-dl-${randomUUID()}.${ext}`);
  let headers = "";
  try {
    // Use execFileSync (array form) to prevent shell injection via crafted URIs.
    // -f fails on HTTP errors instead of silently saving the error body,
    // -D captures headers so we can assert the response is actually an image.
    headers = execFileSync(
      "curl",
      ["-sLf", "-D", "-", "-o", filePath, uri],
      { timeout: 15_000, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    );
  } catch (err: any) {
    fail(`Download failed for ${uri.slice(0, 80)}: ${err.message?.slice(0, 200)}`);
  }
  // Sanity check: content-type must be image/*, and file must be >= 256 bytes.
  // Catches cases like Wikimedia 404 HTML pages being uploaded as "image/svg+xml".
  const ctMatch = /content-type:\s*([^\r\n;]+)/i.exec(headers);
  const ct = ctMatch?.[1]?.trim().toLowerCase() ?? "";
  if (!ct.startsWith("image/")) {
    fail(`Image URI returned non-image content-type "${ct}" for ${uri.slice(0, 80)}`);
  }
  const size = statSync(filePath).size;
  if (size < 256) {
    fail(`Image URI returned only ${size} bytes (likely error page) for ${uri.slice(0, 80)}`);
  }
  return filePath;
}

/** Upload a file to Google Drive, share publicly, return an lh3 URL for insertInlineImage. */
export async function uploadToDrive(
  filePath: string,
  mimeType: string,
  connection: string,
): Promise<{ url: string; fileId: string }> {
  const fileData = readFileSync(filePath);
  // Strip "+xml" and similar mime suffixes so "image/svg+xml" → "svg", not "svg+xml".
  // Drive's thumbnail/transcode pipeline keys off the filename extension.
  const ext = (mimeType.split("/")[1] ?? "bin").replace(/\+.*$/, "");
  const boundary = `gdocs_upload_${randomUUID().slice(0, 8)}`;
  const metadata = JSON.stringify({ name: `gdocs-image-${Date.now()}.${ext}`, mimeType });

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "Content-Transfer-Encoding: base64",
    "",
    fileData.toString("base64"),
    `--${boundary}--`,
  ].join("\r\n");

  const { client } = await createAuthClient();
  const res = await client.fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart`, {
    method: "POST",
    body,
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
  });
  const result = await res.json() as { id?: string; error?: { message: string } };
  if (result.error) fail(`Drive upload failed: ${result.error.message}`);
  const fileId = result.id;
  if (!fileId) fail("Drive upload returned no file ID");

  // Share publicly so Google Docs can fetch it
  await client.fetch(`${DRIVE_API}/${fileId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ role: "reader", type: "anyone" }),
    headers: { "Content-Type": "application/json" },
  });

  // Drive's thumbnail endpoint transcodes SVG → raster server-side; Docs API
  // supports PNG/JPEG/GIF only, so the transcode is what makes SVG relay work.
  return { url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`, fileId };
}

/** Process compiled requests: relay SVG images through Drive for server-side transcoding. Returns Drive file IDs for cleanup. */
export async function resolveSvgImages(
  requests: Record<string, unknown>[],
  connection: string,
): Promise<string[]> {
  const driveFileIds: string[] = [];

  for (const req of requests) {
    const insert = req.insertInlineImage as Record<string, unknown> | undefined;
    if (!insert) continue;
    const uri = insert.uri as string;
    if (!uri || !isSvgUri(uri)) continue;

    console.error(`Relaying SVG via Drive: ${uri.slice(0, 80)}...`);
    // Resolve SVG content to a temp file
    let svgPath: string;
    if (uri.startsWith("data:")) {
      // Validate data URI format before decoding
      if (!/^data:image\/(svg\+xml|png|jpeg|gif|webp);base64,/.test(uri)) {
        fail(`Invalid data URI format. Expected data:image/<type>;base64,... but got: ${uri.slice(0, 50)}`);
      }
      const p = path.join(tmpdir(), `gdocs-svg-${randomUUID()}.svg`);
      writeFileSync(p, Buffer.from(uri.split(",")[1], "base64"));
      svgPath = p;
    } else {
      svgPath = downloadToFile(uri, "svg");
    }

    const { url, fileId } = await uploadToDrive(svgPath, "image/svg+xml", connection);
    insert.uri = url;
    driveFileIds.push(fileId);

    // Cleanup temp file
    try { unlinkSync(svgPath); } catch (e) { console.warn("[gdocs] SVG cleanup failed:", e); }
  }

  return driveFileIds;
}

/** Delete temporary Drive files after doc creation. */
export async function cleanupDriveFiles(fileIds: string[], _connection?: string): Promise<void> {
  const { client } = await createAuthClient();
  for (const id of fileIds) {
    try {
      await client.fetch(`${DRIVE_API}/${id}`, { method: "DELETE" });
    } catch { /* Drive cleanup, ok to fail */ }
  }
  if (fileIds.length > 0) console.error(`Cleaned up ${fileIds.length} temporary Drive file(s).`);
}

/** Download an image to a local file. Returns the local path. */
export async function downloadImage(uri: string, outDir: string, index: number): Promise<string> {
  // Extract extension from URI or default to .png
  const extMatch = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  const ext = extMatch?.[1] ?? "png";
  const fileName = `image-${index}.${ext}`;
  const filePath = `${outDir}/${fileName}`;

  downloadToFile(uri, ext);
  // Move to final location
  const tmpPath = downloadToFile(uri, ext);
  const { renameSync } = await import("node:fs");
  renameSync(tmpPath, filePath);

  return fileName;
}
