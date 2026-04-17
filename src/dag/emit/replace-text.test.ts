import { test } from "node:test";
import assert from "node:assert/strict";
import { EmitContext } from "../ir/emit-context.ts";
import { IndexCursor } from "../ir/index-cursor.ts";
import { SegmentScope } from "../ir/segment-scope.ts";
import { DocumentRegistry } from "../ir/document-registry.ts";
import { emitReplaceText } from "./replace-text.ts";

test("emitReplaceText emits replaceAllText with no indexFields", () => {
  const ctx = new EmitContext(new IndexCursor(0), new SegmentScope(), new DocumentRegistry());
  ctx.openSegment();
  emitReplaceText({ kind: "replaceText", search: "foo", replace: "bar", matchCase: true }, ctx);
  const r = ctx.buildIR().segments[0].localRequests[0];
  assert.deepEqual(r.request, {
    replaceAllText: {
      containsText: { text: "foo", matchCase: true },
      replaceText: "bar",
    },
  });
  assert.deepEqual(r.indexFields, []);
});
