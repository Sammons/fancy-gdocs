#!/usr/bin/env node
/**
 * gdocs skill entrypoint.
 *
 * Usage:
 *   pnpm gdocs create /tmp/doc.json [--dry-run] [--out /tmp/result.json]
 *   pnpm gdocs help
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  compileDoc,
  executeIR,
  type DocSpec,
  type DocIR,
  type FootnoteSpec,
  type PendingAnchorLink,
  type FetchClient,
  type CompileResult,
} from "./dag/index.ts";
// Header/footer compilation (extracted from legacy build-requests.ts)
import { compileHeaderFooterRequests, buildTextStyle, type HeaderFooterSpec as LibHeaderFooterSpec, type Run as LibRun } from "./lib/header-footer.ts";
import { handleChart } from "./charts/index.ts";
import { loadTheme, isThemeName, applyThemePreset, THEME_NAMES } from "./themes/index.ts";

// Import extracted lib modules
import {
  fail,
  resolveConnectionId,
  createBlankDoc,
  batchUpdate,
  getDoc,
  createFetchClient,
} from "./lib/api-client.ts";
import type { BatchUpdateResponse, BatchUpdateReply, GoogleDocsInlineObject, GoogleDocsTab } from "./lib/google-docs-types.ts";
import {
  extractRequestsFromIR,
  remapTabIds,
  filterHeaderFooterFromIR,
} from "./lib/ir-helpers.ts";
import {
  extractBlocksFromBody,
  processTab,
  flattenBlocks,
  type TabSpec,
} from "./lib/doc-reader.ts";
import {
  extractComparableContent,
  deepEqual,
} from "./lib/validation.ts";
import {
  buildAnchorByIndex,
  buildAnchorTargets,
  remapPendingLinks,
  buildAnchorLinkRequests,
  type DocTab,
} from "./lib/anchor-links.ts";
import {
  resolveSvgImages,
  cleanupDriveFiles,
} from "./lib/image-pipeline.ts";
import {
  readSpec,
  takeFlag,
  takeOption,
} from "./lib/cli.ts";

// ---------------------------------------------------------------------------
// Helper to extract tab IDs from batchUpdate response
// ---------------------------------------------------------------------------

function extractTabIdsFromResponse(response: BatchUpdateResponse): string[] {
  const replies = response?.replies ?? [];
  return replies
    .filter((r: BatchUpdateReply) => r?.addDocumentTab?.tabProperties?.tabId)
    .map((r: BatchUpdateReply) => r.addDocumentTab!.tabProperties!.tabId!);
}


// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function handleCreate(args: string[]): Promise<void> {
  const { present: dryRun, remaining: args2 } = takeFlag(args, "dry-run");
  const { value: outPath, remaining: args3 } = takeOption(args2, "out");
  const { value: themeName, remaining: args4 } = takeOption(args3, "theme");

  const filePath = args4[0];
  if (!filePath) {
    fail("Usage: pnpm gdocs create <file.json> [--dry-run] [--out /tmp/result.json] [--theme <name>]\n" +
         `Available themes: ${THEME_NAMES.join(", ")}`);
  }

  const spec = readSpec(path.resolve(filePath));

  // Apply theme preset if specified
  if (themeName) {
    if (!isThemeName(themeName)) {
      fail(`Unknown theme: "${themeName}". Available themes: ${THEME_NAMES.join(", ")}`);
    }
    const preset = loadTheme(themeName);
    applyThemePreset(spec, preset);
    console.error(`Applied theme: ${themeName}`);
  }
  if (!spec.title) fail("Error: DSL file must have a 'title' field.");
  if (!spec.blocks && !spec.tabs) fail("Error: DSL file must have 'blocks' or 'tabs'.");

  if (dryRun) {
    // Use DAG compile for dry-run to output the IR structure
    const { ir, registry } = compileDoc(spec);
    const output = {
      title: spec.title,
      account: spec.account ?? "work",
      ir,
      pendingFootnotes: registry.getPendingFootnotes(),
      pendingAnchorLinks: registry.getPendingAnchorLinks(),
    };
    const json = JSON.stringify(output, null, 2);
    if (outPath) {
      writeFileSync(outPath, json + "\n");
      console.log(JSON.stringify({ outputPath: outPath }));
    } else {
      console.log(json);
    }
    return;
  }

  // Live creation via Zapier SDK relay using DAG pipeline
  const account = spec.account ?? "work";
  const connection = await resolveConnectionId(account);
  const documentId = await createDocFromSpec(spec, "", connection);
  const url = `https://docs.google.com/document/d/${documentId}/edit`;
  const result = { documentId, url, title: spec.title };

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ ...result, outputPath: outPath }));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}


/** Create a doc from the spec and return its documentId. */
async function createDocFromSpec(
  spec: DocSpec,
  suffix: string,
  connection: string,
): Promise<string> {
  // Use DAG pipeline for compilation
  const { ir, registry } = compileDoc(spec, spec.theme);

  console.error(`Creating "${spec.title} ${suffix}" ...`);
  const doc = await createBlankDoc(`${spec.title} ${suffix}`, connection);
  const documentId: string = doc.documentId;
  if (!documentId) fail(`docs.create returned no documentId`);

  // Build tabId mapping: placeholder -> real
  // The default tab (tab-0) maps to the doc's first tab, additional tabs need to be created
  const defaultTabId = doc.tabs?.[0]?.tabProperties?.tabId;
  const tabIdMap: Record<string, string | undefined> = { "tab-0": undefined }; // tab-0 = default tab (no tabId needed)

  // Track Drive file IDs for cleanup
  const driveFileIds: string[] = [];

  try {
    // Flatten tab tree into ordered list with parent references
    interface FlatTab {
      tab: typeof spec.tabs extends (infer T)[] | undefined ? NonNullable<T> : never;
      placeholderId: string;
      parentPlaceholderId?: string;
      index: number;
    }

    function flattenTabs(
      tabs: typeof spec.tabs,
      parentId?: string,
      startIndex = 0
    ): FlatTab[] {
      if (!tabs) return [];
      const result: FlatTab[] = [];
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        const placeholderId = parentId
          ? `${parentId}-child-${i}`
          : `tab-${startIndex + i}`;
        result.push({
          tab,
          placeholderId,
          parentPlaceholderId: parentId,
          index: i,
        });
        // Recursively add children
        if (tab.children && tab.children.length > 0) {
          result.push(...flattenTabs(tab.children, placeholderId, 0));
        }
      }
      return result;
    }

    const flatTabs = flattenTabs(spec.tabs);

    // Build parent→children index for O(1) lookups (avoid O(n²) filter loops)
    const childrenByParent = new Map<string | undefined, FlatTab[]>();
    for (const flatTab of flatTabs) {
      const parentId = flatTab.parentPlaceholderId;
      const existing = childrenByParent.get(parentId) ?? [];
      existing.push(flatTab);
      childrenByParent.set(parentId, existing);
    }

    // Create tabs in order (first tab already exists, just rename it)
    const firstTab = spec.tabs?.[0];
    if (firstTab?.title) {
      const tabProps: Record<string, unknown> = { tabId: defaultTabId ?? "t.0", title: firstTab.title };
      const tabFields = ["title"];
      if (firstTab.icon) {
        tabProps.iconEmoji = firstTab.icon;
        tabFields.push("iconEmoji");
      }
      await batchUpdate(documentId, [{
        updateDocumentTabProperties: {
          tabProperties: tabProps,
          fields: tabFields.join(","),
        },
      }], connection);
      // Map first tab's placeholder to undefined (uses default tab)
      tabIdMap["tab-0"] = undefined;
    }

    // Create remaining tabs level by level (parents before children)
    // First pass: create all top-level tabs (except first)
    const topLevelTabs = (childrenByParent.get(undefined) ?? []).filter(flatTab => flatTab.placeholderId !== "tab-0");
    if (topLevelTabs.length > 0) {
      const addTabRequests = topLevelTabs.map((flatTab) => {
        const tabProps: Record<string, unknown> = { title: flatTab.tab.title, index: flatTab.index };
        if (flatTab.tab.icon) tabProps.iconEmoji = flatTab.tab.icon;
        return { addDocumentTab: { tabProperties: tabProps } };
      });
      const tabResponse = await batchUpdate(documentId, addTabRequests, connection);
      const realTabIds = extractTabIdsFromResponse(tabResponse);
      for (let i = 0; i < realTabIds.length; i++) {
        tabIdMap[topLevelTabs[i].placeholderId] = realTabIds[i];
      }
    }

    // Second pass: create child tabs for first tab (which uses defaultTabId)
    const firstTabChildren = childrenByParent.get("tab-0") ?? [];
    if (firstTabChildren.length > 0) {
      const addChildRequests = firstTabChildren.map((flatTab) => {
        const tabProps: Record<string, unknown> = {
          title: flatTab.tab.title,
          index: flatTab.index,
          parentTabId: defaultTabId,
        };
        if (flatTab.tab.icon) tabProps.iconEmoji = flatTab.tab.icon;
        return { addDocumentTab: { tabProperties: tabProps } };
      });
      const childResponse = await batchUpdate(documentId, addChildRequests, connection);
      const childRealIds = extractTabIdsFromResponse(childResponse);
      for (let i = 0; i < childRealIds.length; i++) {
        tabIdMap[firstTabChildren[i].placeholderId] = childRealIds[i];
      }
    }

    // Third pass: create child tabs for other top-level tabs
    for (const topTab of topLevelTabs) {
      const children = childrenByParent.get(topTab.placeholderId) ?? [];
      if (children.length === 0) continue;

      const parentRealId = tabIdMap[topTab.placeholderId];
      if (!parentRealId) continue; // Should never happen

      const addChildRequests = children.map((flatTab) => {
        const tabProps: Record<string, unknown> = {
          title: flatTab.tab.title,
          index: flatTab.index,
          parentTabId: parentRealId,
        };
        if (flatTab.tab.icon) tabProps.iconEmoji = flatTab.tab.icon;
        return { addDocumentTab: { tabProperties: tabProps } };
      });
      const childResponse = await batchUpdate(documentId, addChildRequests, connection);
      const childRealIds = extractTabIdsFromResponse(childResponse);
      for (let i = 0; i < childRealIds.length; i++) {
        tabIdMap[children[i].placeholderId] = childRealIds[i];
      }
    }

    // Remap placeholder tabIds in IR to real tabIds
    remapTabIds(ir, tabIdMap);

    // Filter out header/footer segments — handled separately via legacy path
    const filteredIR = filterHeaderFooterFromIR(ir);

    // Resolve SVG images in IR requests
    const requests = extractRequestsFromIR(filteredIR);
    driveFileIds.push(...await resolveSvgImages(requests, connection));

    // Execute the IR via DAG pipeline
    const client = createFetchClient(connection);
    console.error(`Executing IR with ${filteredIR.segments.length} segment(s) ...`);
    await executeIR(filteredIR, client, undefined, connection, documentId); // theme already applied in compileDoc

    // Post-processing: Create headers/footers (requires real segment IDs from API)
    // For now, use legacy path for header/footer content
    if (spec.header) {
      const headerResp = await batchUpdate(documentId, [
        { createHeader: { type: "DEFAULT", sectionBreakLocation: { index: 0 } } },
      ], connection);
      const headerId = headerResp?.replies?.[0]?.createHeader?.headerId;
      if (headerId) {
        const headerReqs = compileHeaderFooterRequests(spec.header as unknown as LibHeaderFooterSpec, headerId);
        if (headerReqs.length > 0) {
          await batchUpdate(documentId, headerReqs, connection);
        }
      }
    }

    if (spec.footer) {
      const footerResp = await batchUpdate(documentId, [
        { createFooter: { type: "DEFAULT", sectionBreakLocation: { index: 0 } } },
      ], connection);
      const footerId = footerResp?.replies?.[0]?.createFooter?.footerId;
      if (footerId) {
        const footerReqs = compileHeaderFooterRequests(spec.footer as unknown as LibHeaderFooterSpec, footerId);
        if (footerReqs.length > 0) {
          await batchUpdate(documentId, footerReqs, connection);
        }
      }
    }

    // Reject unsupported header/footer variants
    if (spec.firstPageHeader || spec.firstPageFooter) {
      fail(
        "Error: firstPageHeader/firstPageFooter are not supported.\n" +
        "The Google Docs API only writes the DEFAULT header/footer slot.\n" +
        "Workaround: author a template doc with the variant headers in the UI, then copy it via drive.files.copy."
      );
    }

    // Post-processing: Create footnotes from registry
    // Process in reverse body-index order since each createFootnote shifts indices
    const allFootnotes = registry.getPendingFootnotes();
    if (allFootnotes.length > 0) {
      console.error(`Creating ${allFootnotes.length} footnote(s) ...`);
      // Remap tabIds and rebase bodyIndex (add origin 1 for body segment)
      const remappedFootnotes = allFootnotes.map(fn => ({
        ...fn,
        bodyIndex: fn.bodyIndex + 1, // Rebase: segment-relative -> absolute (body origin = 1)
        tabId: fn.tabId ? tabIdMap[fn.tabId] : undefined,
      }));
      // Sort reverse by bodyIndex within each tab
      const sortedFootnotes = [...remappedFootnotes].sort((a, b) => {
        const tabCmp = (a.tabId ?? "").localeCompare(b.tabId ?? "");
        return tabCmp !== 0 ? tabCmp : b.bodyIndex - a.bodyIndex;
      });

      for (const fn of sortedFootnotes) {
        const loc: Record<string, unknown> = { index: fn.bodyIndex };
        if (fn.tabId) loc.tabId = fn.tabId;

        const fnResp = await batchUpdate(documentId, [
          { createFootnote: { location: loc } },
        ], connection);
        const footnoteId = fnResp?.replies?.[0]?.createFootnote?.footnoteId;
        if (!footnoteId) {
          console.error(`Warning: createFootnote at index ${fn.bodyIndex} returned no footnoteId`);
          continue;
        }

        const text = fn.content.map(r => r.text).join("");
        if (text.length > 0) {
          const insertLoc: Record<string, unknown> = { segmentId: footnoteId, index: 0 };
          if (fn.tabId) insertLoc.tabId = fn.tabId;
          const contentReqs: Record<string, unknown>[] = [
            { insertText: { text, location: insertLoc } },
          ];
          let offset = 0;
          for (const run of fn.content) {
            const styleResult = buildTextStyle(run as unknown as LibRun);
            if (styleResult) {
              const range: Record<string, unknown> = {
                segmentId: footnoteId,
                startIndex: offset,
                endIndex: offset + run.text.length,
              };
              if (fn.tabId) range.tabId = fn.tabId;
              contentReqs.push({
                updateTextStyle: {
                  range,
                  textStyle: styleResult.style,
                  fields: styleResult.fields,
                },
              });
            }
            offset += run.text.length;
          }
          await batchUpdate(documentId, contentReqs, connection);
        }
      }
    }

    // Post-processing: Resolve in-doc anchor links from registry
    const allPendingAnchorLinks = registry.getPendingAnchorLinks();
    if (allPendingAnchorLinks.length > 0) {
      console.error(`Resolving ${allPendingAnchorLinks.length} in-doc anchor link(s) ...`);

      // Read the doc to find heading IDs
      const docContent = await getDoc(documentId, connection) as { tabs?: unknown[] };

      // Build anchor index and resolve targets
      const registeredAnchors = registry.getAnchors();
      const anchorByAbsoluteIndex = buildAnchorByIndex(registeredAnchors, tabIdMap);
      const anchorIdByName = buildAnchorTargets((docContent.tabs ?? []) as DocTab[], anchorByAbsoluteIndex);

      // Remap links and build requests
      const remappedLinks = remapPendingLinks(allPendingAnchorLinks, tabIdMap);
      const { requests: linkReqs, unresolved } = buildAnchorLinkRequests(remappedLinks, anchorIdByName);

      if (unresolved.length > 0) {
        fail(`Error: unresolved in-doc anchor link(s): ${[...new Set(unresolved)].join(", ")}. No heading with matching anchor was found.`);
      }
      if (linkReqs.length > 0) {
        await batchUpdate(documentId, linkReqs, connection);
      }
    }

    return documentId;
  } finally {
    // Clean up temporary Drive files
    await cleanupDriveFiles(driveFileIds, connection);
  }
}

async function handleValidate(args: string[]): Promise<void> {
  const { value: outPath, remaining: args2 } = takeOption(args, "out");

  const filePath = args2[0];
  if (!filePath) {
    fail("Usage: pnpm gdocs validate <file.json> [--out /tmp/result.json]");
  }

  const spec = readSpec(path.resolve(filePath));
  if (!spec.title) fail("Error: DSL file must have a 'title' field.");
  if (!spec.blocks && !spec.tabs) fail("Error: DSL file must have 'blocks' or 'tabs'.");

  const account = spec.account ?? "work";
  const connection = await resolveConnectionId(account);

  // Step 1: Create doc A
  const docIdA = await createDocFromSpec(spec, "(A)", connection);
  console.error(`Doc A: ${docIdA}`);

  // Step 2: Create doc B (identical spec)
  const docIdB = await createDocFromSpec(spec, "(B)", connection);
  console.error(`Doc B: ${docIdB}`);

  // Step 3: Read both docs
  console.error("Reading doc A ...");
  const rawA = await getDoc(docIdA, connection);
  console.error("Reading doc B ...");
  const rawB = await getDoc(docIdB, connection);

  // Step 4: Extract comparable content and diff
  const contentA = extractComparableContent(rawA);
  const contentB = extractComparableContent(rawB);
  const diffs = deepEqual(contentA, contentB);

  const result = {
    status: diffs.length === 0 ? "PASS" : "FAIL",
    docA: { documentId: docIdA, url: `https://docs.google.com/document/d/${docIdA}/edit` },
    docB: { documentId: docIdB, url: `https://docs.google.com/document/d/${docIdB}/edit` },
    tabCount: (rawA.tabs ?? []).length,
    diffs: diffs.length > 0 ? diffs : undefined,
  };

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
    // Also write raw reads for inspection
    writeFileSync(outPath.replace(".json", "-a.json"), JSON.stringify(rawA, null, 2) + "\n");
    writeFileSync(outPath.replace(".json", "-b.json"), JSON.stringify(rawB, null, 2) + "\n");
  }

  console.log(JSON.stringify(result, null, 2));

  if (diffs.length > 0) {
    console.error(`\nFAILED: ${diffs.length} diff(s) found.`);
    for (const d of diffs.slice(0, 20)) console.error(`  ${d}`);
    if (diffs.length > 20) console.error(`  ... and ${diffs.length - 20} more`);
    process.exit(1);
  } else {
    console.error("\nPASSED: Round-trip content is identical.");
  }
}

// ---------------------------------------------------------------------------
// handleRead — Read and display a Google Doc's content
// ---------------------------------------------------------------------------

type Block = import("./dag/types/block.ts").Block;
type Run = import("./dag/types/run.ts").Run;
type NamedStyle = import("./dag/types/style-tokens.ts").NamedStyle;

interface ImageDownload {
  uri: string;
  localPath: string;
}

async function downloadImage(uri: string, outDir: string, index: number): Promise<string> {
  const ext = uri.includes(".png") ? "png" : uri.includes(".gif") ? "gif" : "jpg";
  const filename = `image-${index}.${ext}`;
  const localPath = `${outDir}/${filename}`;

  // Use fetch to download (Node 18+ has native fetch)
  const resp = await fetch(uri);
  if (!resp.ok) {
    console.error(`Warning: Failed to download image ${uri}: ${resp.status}`);
    return uri; // Return original URI on failure
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(localPath, buffer);
  return filename;
}

async function handleRead(args: string[]): Promise<void> {
  const { value: outPath, remaining: args1 } = takeOption(args, "out");
  const { present: rawJson, remaining: args2 } = takeFlag(args1, "raw");
  const { present: dslMode, remaining: args3 } = takeFlag(args2, "dsl");
  const { value: imageDir, remaining: args4 } = takeOption(args3, "images");
  const { value: accountOpt, remaining: args5 } = takeOption(args4, "account");
  const { value: idFlag, remaining: args6 } = takeOption(args5, "id");

  const docId = idFlag ?? args6[0];
  if (!docId) {
    fail(`Usage: pnpm gdocs read <documentId> [options]
  --id <id>         Document ID (or pass as positional arg)
  --out <path>      Write output to a file instead of stdout
  --raw             Output raw API JSON
  --dsl             Output as DSL JSON (same format as create input)
  --images <dir>    Download images to directory (for markdown mode)
  --account <email> Google account to use (default: ben@sammons.io)`);
  }

  const account = accountOpt ?? "ben@sammons.io";
  const connection = await resolveConnectionId(account);
  const doc = await getDoc(docId, connection);

  // Extract inline objects (images) map
  const inlineObjects: Record<string, GoogleDocsInlineObject> = {};
  for (const tab of doc.tabs || []) {
    const objs = tab.documentTab?.inlineObjects;
    if (objs) Object.assign(inlineObjects, objs);
  }

  if (rawJson) {
    // Output raw API response
    const output = JSON.stringify(doc, null, 2);
    if (outPath) {
      writeFileSync(outPath, output);
      console.log(`Raw document JSON written to ${outPath}`);
    } else {
      console.log(output);
    }
    return;
  }

  // Process all tabs using extracted helpers
  const docTabs = doc.tabs || [];
  const tabSpecs: TabSpec[] = docTabs.map((tab: GoogleDocsTab) => processTab(tab, inlineObjects));
  const allBlocks: Block[] = flattenBlocks(tabSpecs);

  if (dslMode) {
    // Output as DSL JSON (same format as create input)
    const spec: Record<string, unknown> = {
      title: doc.title || "(Untitled)",
      account: account,
    };

    // Use tabs array if multiple tabs, otherwise use blocks for single-tab docs
    if (tabSpecs.length > 1) {
      spec.tabs = tabSpecs;
    } else if (tabSpecs.length === 1) {
      // Single tab: if it has a non-default title, still use tabs format
      const singleTab = tabSpecs[0];
      if (singleTab.title && singleTab.title !== "Tab 1" && singleTab.title !== doc.title) {
        spec.tabs = tabSpecs;
      } else {
        spec.blocks = singleTab.blocks;
      }
    }

    const output = JSON.stringify(spec, null, 2);
    if (outPath) {
      writeFileSync(outPath, output);
      console.log(`DSL JSON written to ${outPath}`);
    } else {
      console.log(output);
    }
    return;
  }

  // For markdown mode, use flattened blocks
  const blocks = allBlocks;

  // Markdown mode with optional image download
  const title = doc.title || "(Untitled)";
  const content: string[] = [`# ${title}`, ""];
  let imageIndex = 0;
  const imageMap: Map<string, string> = new Map();

  // Download images if directory specified
  if (imageDir) {
    mkdirSync(imageDir, { recursive: true });
    for (const block of blocks) {
      if (block.kind === "image") {
        const { uri } = block;
        if (!imageMap.has(uri)) {
          const localPath = await downloadImage(uri, imageDir, imageIndex++);
          imageMap.set(uri, localPath);
        }
      }
    }
  }

  // Convert blocks to markdown
  function runsToMarkdown(runs: Run[]): string {
    return runs
      .map((r) => {
        let text = r.text;
        if (r.bold) text = `**${text}**`;
        if (r.italic) text = `*${text}*`;
        if (r.strikethrough) text = `~~${text}~~`;
        if (r.link) text = `[${text}](${typeof r.link === "string" ? r.link : "#" + r.link.anchorId})`;
        return text;
      })
      .join("");
  }

  for (const block of blocks) {
    if (block.kind === "paragraph") {
      const text = runsToMarkdown(block.runs).trimEnd();
      const style = block.style;
      if (style?.startsWith("HEADING_")) {
        const level = parseInt(style.replace("HEADING_", "")) || 1;
        content.push(`${"#".repeat(level + 1)} ${text}`);
      } else if (style === "TITLE") {
        // Skip title, already added
      } else if (text) {
        content.push(text);
      }
    } else if (block.kind === "image") {
      const src = imageMap.get(block.uri) || block.uri;
      content.push(`![image](${src})`);
    } else if (block.kind === "table") {
      content.push("[TABLE]");
    } else if (block.kind === "sectionBreak") {
      content.push("---");
    } else if (block.kind === "hr") {
      content.push("---");
    }
  }

  const output = content.join("\n");
  if (outPath) {
    writeFileSync(outPath, output);
    console.log(`Document content written to ${outPath}`);
  } else {
    console.log(output);
  }
}

function printHelp(): void {
  console.log(`gdocs — Create and read richly formatted Google Docs.

Usage:
  pnpm gdocs create <file.json> [--dry-run] [--out /tmp/result.json]
  pnpm gdocs read <documentId> [--out /tmp/doc.md] [--raw]
  pnpm gdocs validate <file.json> [--out /tmp/result.json]
  pnpm gdocs chart <type> <file.json> [options]
  pnpm gdocs help

Commands:
  create     Build a Google Doc from a DSL JSON file.
             --dry-run   Emit compiled batchUpdate requests without calling the API.
             --out       Write output to a file instead of stdout.
             --theme     Apply a theme preset: corporate, dark-mode, academic.

  read       Read a Google Doc and output its content.
             --id        Document ID (or pass as positional arg).
             --out       Write output to a file instead of stdout.
             --raw       Output raw API JSON.
             --dsl       Output as DSL JSON (same format as create input).
             --images    Download images to directory (markdown mode only).

  validate   Round-trip validation: create two docs from same DSL, read both
             back, compare content. Exits 0 on match, 1 on diff.
             --out       Write result + raw reads to files.

  chart      Generate SVG charts from JSON data.
             Types: pie, bar, scatter, sankey
             Run "pnpm gdocs chart help" for full options.

  help       Show this help message.

DSL block types: title, subtitle, heading, paragraph, table, image, list, pageBreak, hr
See SKILL.md for full DSL reference and examples.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2);

try {
  switch (command) {
    case "create":
      await handleCreate(rest);
      break;
    case "read":
      await handleRead(rest);
      break;
    case "validate":
      await handleValidate(rest);
      break;
    case "chart":
      handleChart(rest);
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;
    default:
      fail(`Unknown command: ${command}. Run "pnpm gdocs help" for usage.`);
  }
} catch (err: any) {
  console.error(`Error: ${err?.message ?? err}`);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
}
