import { test } from "node:test";
import assert from "node:assert/strict";
import { executeIR } from "./execute.ts";
import type { DocIR } from "../ir/doc-ir.ts";

function fakeClient() {
  const calls: { url: string; body: any }[] = [];
  return {
    calls,
    async fetch(url: string, opts: { method?: string; body?: string } = {}): Promise<{ ok: boolean; json(): Promise<unknown> }> {
      calls.push({ url, body: opts.body ? JSON.parse(opts.body) : undefined });
      return { ok: true, json: async () => ({}) };
    },
  };
}

test("executeIR sends structure then deferred, splitting batches", async () => {
  const client = fakeClient();
  const ir: DocIR = {
    segments: [{
      localRequests: [
        { request: { insertText: { text: "a", location: { index: 0 } } }, indexFields: ["insertText.location.index"] },
      ],
      deferredRequests: [
        { request: { updateTextStyle: { range: { startIndex: 0, endIndex: 1 }, textStyle: {}, fields: "" } }, indexFields: ["updateTextStyle.range.startIndex", "updateTextStyle.range.endIndex"] },
      ],
    }],
  };
  await executeIR(ir, client, undefined, "", "doc-123");
  assert.equal(client.calls.length, 2);
  assert.ok(client.calls[0].url.includes("doc-123:batchUpdate"));
  // first = structure, second = deferred
  assert.ok(client.calls[0].body.requests[0].insertText);
  assert.ok(client.calls[1].body.requests[0].updateTextStyle);
});

test("executeIR skips empty batches", async () => {
  const client = fakeClient();
  const ir: DocIR = { segments: [{ localRequests: [], deferredRequests: [] }] };
  await executeIR(ir, client, undefined, "", "d");
  assert.equal(client.calls.length, 0);
});
