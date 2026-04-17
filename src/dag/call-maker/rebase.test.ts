import { test } from "node:test";
import assert from "node:assert/strict";
import { rebase, segmentKey } from "./rebase.ts";
import type { DocIR } from "../ir/doc-ir.ts";

test("rebase adds origin to index + sets segmentId/tabId on parent", () => {
  const ir: DocIR = {
    segments: [
      {
        localRequests: [
          { request: { insertText: { text: "x", location: { index: 0 } } }, indexFields: ["insertText.location.index"] },
        ],
        deferredRequests: [],
      },
      {
        segmentId: "hdr",
        localRequests: [
          { request: { insertText: { text: "y", location: { index: 0 } } }, indexFields: ["insertText.location.index"] },
        ],
        deferredRequests: [],
      },
    ],
  };
  const [structure, deferred] = rebase(ir, {
    [segmentKey(undefined, undefined)]: 1,
    [segmentKey(undefined, "hdr")]: 0,
  });
  assert.equal(structure.length, 2);
  assert.equal(deferred.length, 0);
  const r0 = structure[0] as any;
  assert.equal(r0.insertText.location.index, 1);
  assert.equal(r0.insertText.location.segmentId, undefined);
  const r1 = structure[1] as any;
  assert.equal(r1.insertText.location.index, 0);
  assert.equal(r1.insertText.location.segmentId, "hdr");
});

test("rebase handles deferred + range fields", () => {
  const ir: DocIR = {
    segments: [{
      localRequests: [],
      deferredRequests: [{
        request: { updateTextStyle: { range: { startIndex: 5, endIndex: 10 }, textStyle: {}, fields: "" } },
        indexFields: ["updateTextStyle.range.startIndex", "updateTextStyle.range.endIndex"],
      }],
    }],
  };
  const [structure, deferred] = rebase(ir, { [segmentKey(undefined, undefined)]: 100 });
  assert.equal(structure.length, 0);
  const d = deferred[0] as any;
  assert.equal(d.updateTextStyle.range.startIndex, 105);
  assert.equal(d.updateTextStyle.range.endIndex, 110);
});
