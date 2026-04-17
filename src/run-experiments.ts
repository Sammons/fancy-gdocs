#!/usr/bin/env npx tsx
/**
 * Systematic exploration of Google Docs embedded/positioned objects.
 * Runs via Zapier SDK relay — uses the gdocs skill's connection resolution.
 */

import { createZapierSdk } from "@zapier/zapier-sdk";

const sdk = createZapierSdk();
const DOCS_API = "https://docs.googleapis.com/v1/documents";

// Use env var or auto-detect
const CONN = process.env.GDOCS_CONNECTION ?? process.env.GDOCS_CONNECTION_WORK ?? "";

if (!CONN) {
  console.error("Set GDOCS_CONNECTION or GDOCS_CONNECTION_WORK env var");
  process.exit(1);
}

async function createDoc(title: string): Promise<any> {
  const r = await sdk.fetch(DOCS_API, {
    method: "POST", connection: CONN,
    body: JSON.stringify({ title }),
    headers: { "Content-Type": "application/json" },
  });
  return r.json();
}

async function batch(docId: string, requests: any[]): Promise<any> {
  const r = await sdk.fetch(`${DOCS_API}/${docId}:batchUpdate`, {
    method: "POST", connection: CONN,
    body: JSON.stringify({ requests }),
    headers: { "Content-Type": "application/json" },
  });
  return r.json();
}

async function getDoc(docId: string): Promise<any> {
  const r = await sdk.fetch(`${DOCS_API}/${docId}?includeTabsContent=true`, {
    method: "GET", connection: CONN,
  });
  return r.json();
}

function log(label: string, result: any) {
  if (result.error) {
    console.log(`[FAIL] ${label}: ${result.error.message?.slice(0, 200)}`);
  } else {
    console.log(`[OK]   ${label}`);
    if (result.replies) {
      for (const [i, reply] of result.replies.entries()) {
        const keys = Object.keys(reply);
        if (keys.length > 0) {
          console.log(`       reply[${i}]: ${JSON.stringify(reply).slice(0, 300)}`);
        }
      }
    }
  }
}

async function main() {
  console.log("=== Creating test doc ===");
  const doc = await createDoc("Embedded Object Experiments " + new Date().toISOString().slice(0, 16));
  const docId = doc.documentId;
  console.log(`Doc: ${docId}`);
  console.log(`URL: https://docs.google.com/document/d/${docId}/edit`);

  // Setup: insert some text so we have index positions to work with
  await batch(docId, [
    { insertText: { text: "Embedded Object Experiments\n\nThis doc tests API building blocks.\n\n", location: { index: 1 } } },
  ]);

  // Read back to get current end index
  let docState = await getDoc(docId);
  let bodyContent = docState.tabs?.[0]?.documentTab?.body?.content ?? [];
  let endIdx = bodyContent[bodyContent.length - 1]?.endIndex ?? 60;
  console.log(`Body end index: ${endIdx}`);

  // ========================================================================
  // Experiment 1: insertInlineSheetsChart
  // ========================================================================
  console.log("\n=== Exp 1: insertInlineSheetsChart (fake spreadsheet) ===");
  let r = await batch(docId, [{
    insertInlineSheetsChart: {
      spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms", // Google's sample
      chartId: 0,
      location: { index: endIdx - 1 },
    }
  }]);
  log("insertInlineSheetsChart", r);

  // ========================================================================
  // Experiment 2: Try undocumented request types one at a time
  // ========================================================================
  console.log("\n=== Exp 2: Undocumented/less-documented request types ===");

  // Refresh index after any successful insertions
  docState = await getDoc(docId);
  bodyContent = docState.tabs?.[0]?.documentTab?.body?.content ?? [];
  endIdx = bodyContent[bodyContent.length - 1]?.endIndex ?? 60;

  const experiments: Array<{ name: string; request: any }> = [
    {
      name: "insertRichLink",
      request: { insertRichLink: { uri: "https://docs.google.com/document/d/" + docId, location: { index: endIdx - 1 } } }
    },
    {
      name: "insertChip (fake)",
      request: { insertChip: { uri: "https://example.com", location: { index: endIdx - 1 } } }
    },
    {
      name: "insertSmartChip (fake)",
      request: { insertSmartChip: { uri: "https://example.com", location: { index: endIdx - 1 } } }
    },
    {
      name: "insertBookmark",
      request: { insertBookmark: { location: { index: 5 } } }
    },
    {
      name: "createBookmark",
      request: { createBookmark: { location: { index: 5 } } }
    },
    {
      name: "insertDrawing",
      request: { insertDrawing: { location: { index: endIdx - 1 } } }
    },
    {
      name: "insertPositionedObject",
      request: { insertPositionedObject: { location: { index: endIdx - 1 } } }
    },
    {
      name: "insertPageBreak",
      request: { insertPageBreak: { location: { index: endIdx - 1 } } }
    },
    {
      name: "insertSectionBreak",
      request: { insertSectionBreak: { sectionType: "NEXT_PAGE", location: { index: endIdx - 1 } } }
    },
    {
      name: "insertFootnote",
      request: { insertFootnote: { location: { index: endIdx - 1 } } }
    },
    {
      name: "createFootnote",
      request: { createFootnote: { location: { index: endIdx - 1 } } }
    },
    {
      name: "insertTable",
      request: { insertTable: { rows: 2, columns: 2, location: { index: endIdx - 1 } } }
    },
    {
      name: "createHeader",
      request: { createHeader: { type: "DEFAULT", sectionBreakLocation: { index: 0 } } }
    },
    {
      name: "createFooter",
      request: { createFooter: { type: "DEFAULT", sectionBreakLocation: { index: 0 } } }
    },
    {
      name: "insertPerson (self)",
      request: { insertPerson: { personProperties: { email: "ben@sammons.io" }, location: { index: endIdx - 1 } } }
    },
  ];

  for (const exp of experiments) {
    r = await batch(docId, [exp.request]);
    log(exp.name, r);
    // If successful, refresh the end index for subsequent experiments
    if (!r.error) {
      docState = await getDoc(docId);
      bodyContent = docState.tabs?.[0]?.documentTab?.body?.content ?? [];
      endIdx = bodyContent[bodyContent.length - 1]?.endIndex ?? endIdx;
    }
  }

  // ========================================================================
  // Experiment 3: insertInlineImage with various URIs
  // ========================================================================
  console.log("\n=== Exp 3: insertInlineImage with various URIs ===");

  docState = await getDoc(docId);
  bodyContent = docState.tabs?.[0]?.documentTab?.body?.content ?? [];
  endIdx = bodyContent[bodyContent.length - 1]?.endIndex ?? 60;

  const imageUris = [
    // Google's own hosted images
    "https://developers.google.com/static/workspace/docs/api/images/hero-image.png",
    // Wikipedia image (public, no auth)
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/200px-Google_2015_logo.svg.png",
    // 1x1 pixel data URI test
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    // Google Drive thumbnail pattern (fake ID — to test error message)
    "https://drive.google.com/thumbnail?id=FAKE_FILE_ID&sz=w200",
  ];

  for (const uri of imageUris) {
    r = await batch(docId, [{
      insertInlineImage: {
        uri,
        location: { index: endIdx - 1 },
        objectSize: { width: { magnitude: 100, unit: "PT" }, height: { magnitude: 100, unit: "PT" } },
      }
    }]);
    log(`insertInlineImage(${uri.slice(0, 70)}...)`, r);
    if (!r.error) {
      docState = await getDoc(docId);
      bodyContent = docState.tabs?.[0]?.documentTab?.body?.content ?? [];
      endIdx = bodyContent[bodyContent.length - 1]?.endIndex ?? endIdx;
    }
  }

  // ========================================================================
  // Experiment 4: Full read-back — inspect everything
  // ========================================================================
  console.log("\n=== Exp 4: Full document read-back ===");
  const finalDoc = await getDoc(docId);
  const tab = finalDoc.tabs?.[0];
  const content = tab?.documentTab?.body?.content ?? [];
  const inlineObjs = finalDoc.inlineObjects ?? {};
  const posObjs = finalDoc.positionedObjects ?? {};
  const headers = finalDoc.headers ?? {};
  const footers = finalDoc.footers ?? {};
  const footnotes = finalDoc.footnotes ?? {};
  const lists = tab?.documentTab?.lists ?? {};

  console.log(`Body elements: ${content.length}`);
  console.log(`Inline objects: ${Object.keys(inlineObjs).length}`);
  console.log(`Positioned objects: ${Object.keys(posObjs).length}`);
  console.log(`Headers: ${Object.keys(headers).length}`);
  console.log(`Footers: ${Object.keys(footers).length}`);
  console.log(`Footnotes: ${Object.keys(footnotes).length}`);
  console.log(`Lists: ${Object.keys(lists).length}`);

  // Walk body elements
  for (const el of content) {
    if (el.paragraph) {
      for (const pe of el.paragraph.elements ?? []) {
        if (pe.inlineObjectElement) {
          const id = pe.inlineObjectElement.inlineObjectId;
          const obj = inlineObjs[id];
          const emb = obj?.inlineObjectProperties?.embeddedObject;
          console.log(`  InlineObj[${id}]: type=${emb ? "embeddedObject" : "unknown"}`);
          if (emb) {
            console.log(`    imageProps: sourceUri=${emb?.imageProperties?.sourceUri?.slice(0, 80) ?? "none"}`);
            console.log(`    imageProps: contentUri=${emb?.imageProperties?.contentUri ? "present" : "absent"}`);
            console.log(`    size: ${JSON.stringify(emb?.size)}`);
            console.log(`    title: ${emb?.title ?? "none"}`);
            console.log(`    description: ${emb?.description ?? "none"}`);
            if (emb?.linkedContentReference) {
              console.log(`    linkedContentRef: ${JSON.stringify(emb.linkedContentReference).slice(0, 200)}`);
            }
          }
        }
        if (pe.richLink) {
          console.log(`  RichLink: ${JSON.stringify(pe.richLink).slice(0, 300)}`);
        }
        if (pe.person) {
          console.log(`  Person: ${JSON.stringify(pe.person).slice(0, 300)}`);
        }
        if (pe.footnoteReference) {
          console.log(`  FootnoteRef: ${JSON.stringify(pe.footnoteReference).slice(0, 200)}`);
        }
        if (pe.autoText) {
          console.log(`  AutoText: ${JSON.stringify(pe.autoText).slice(0, 200)}`);
        }
      }
    }
    if (el.sectionBreak) {
      console.log(`  SectionBreak: ${JSON.stringify(el.sectionBreak).slice(0, 200)}`);
    }
    if (el.table) {
      console.log(`  Table: ${el.table.rows} rows x ${el.table.columns} cols`);
    }
  }

  // Inspect headers/footers
  for (const [id, header] of Object.entries(headers)) {
    console.log(`  Header[${id}]: ${JSON.stringify(header).slice(0, 200)}`);
  }
  for (const [id, footer] of Object.entries(footers)) {
    console.log(`  Footer[${id}]: ${JSON.stringify(footer).slice(0, 200)}`);
  }
  for (const [id, fn] of Object.entries(footnotes)) {
    console.log(`  Footnote[${id}]: ${JSON.stringify(fn).slice(0, 200)}`);
  }

  console.log("\n=== Summary ===");
  console.log("Doc URL:", `https://docs.google.com/document/d/${docId}/edit`);
  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
