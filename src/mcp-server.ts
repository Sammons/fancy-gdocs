#!/usr/bin/env node
/**
 * MCP Server for fancy-gdocs.
 *
 * Exposes tools for creating and reading Google Docs via the Model Context Protocol.
 * Designed for Claude Desktop integration.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  compileDoc,
  type DocSpec,
} from "./dag/index.ts";
import {
  resolveConnectionId,
  createBlankDoc,
  batchUpdate,
  getDoc,
} from "./lib/api-client.ts";
import { loadTheme, isThemeName, applyThemePreset, THEME_NAMES } from "./themes/index.ts";
import { processTab, flattenBlocks, type TabSpec } from "./lib/doc-reader.ts";
import type { GoogleDocsInlineObject, GoogleDocsTab } from "./lib/google-docs-types.ts";

// ---------------------------------------------------------------------------
// Core document creation logic (extracted from entrypoint.ts handleCreate)
// ---------------------------------------------------------------------------

async function createDocument(spec: DocSpec, themeName?: string): Promise<{
  documentId: string;
  url: string;
  title: string;
}> {
  // Apply theme if specified
  if (themeName) {
    if (!isThemeName(themeName)) {
      throw new Error(`Unknown theme: "${themeName}". Available: ${THEME_NAMES.join(", ")}`);
    }
    const preset = loadTheme(themeName);
    applyThemePreset(spec, preset);
  }

  if (!spec.title) throw new Error("Spec must have a 'title' field");
  if (!spec.blocks && !spec.tabs) throw new Error("Spec must have 'blocks' or 'tabs'");

  const account = spec.account ?? "work";
  const connection = await resolveConnectionId(account);

  // Compile and create
  const { ir } = compileDoc(spec, spec.theme);
  const doc = await createBlankDoc(spec.title, connection);
  const documentId: string = doc.documentId;
  if (!documentId) throw new Error("docs.create returned no documentId");

  // Execute batchUpdate with compiled requests
  const requests = ir.segments.flatMap(seg => seg.requests);
  if (requests.length > 0) {
    await batchUpdate(documentId, requests, connection);
  }

  // Execute deferred requests
  const deferredRequests = ir.segments.flatMap(seg => seg.deferred);
  if (deferredRequests.length > 0) {
    await batchUpdate(documentId, deferredRequests, connection);
  }

  return {
    documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    title: spec.title,
  };
}

// ---------------------------------------------------------------------------
// Core document reading logic (extracted from entrypoint.ts handleRead)
// ---------------------------------------------------------------------------

async function readDocument(documentId: string, account?: string): Promise<{
  title: string;
  blocks: unknown[];
  tabs?: unknown[];
}> {
  const resolvedAccount = account ?? "work";
  const connection = await resolveConnectionId(resolvedAccount);
  const doc = await getDoc(documentId, connection);

  // Extract inline objects
  const inlineObjects: Record<string, GoogleDocsInlineObject> = {};
  for (const tab of doc.tabs || []) {
    const objs = tab.documentTab?.inlineObjects;
    if (objs) Object.assign(inlineObjects, objs);
  }

  // Process tabs
  const docTabs = doc.tabs || [];
  const tabSpecs: TabSpec[] = docTabs.map((tab: GoogleDocsTab) => processTab(tab, inlineObjects));
  const allBlocks = flattenBlocks(tabSpecs);

  return {
    title: doc.title || "(Untitled)",
    blocks: allBlocks,
    tabs: tabSpecs.length > 1 ? tabSpecs : undefined,
  };
}

// ---------------------------------------------------------------------------
// MCP Server Setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "fancy-gdocs",
  version: "0.2.0",
});

// Tool: create_doc
server.tool(
  "create_doc",
  "Create a Google Doc from a DSL specification. Returns the document URL.",
  {
    spec: z.object({
      title: z.string().describe("Document title"),
      account: z.enum(["work", "personal"]).optional().describe("Google account to use"),
      theme: z.string().optional().describe(`Theme preset: ${THEME_NAMES.join(", ")}`),
      blocks: z.array(z.record(z.unknown())).optional().describe("Document blocks (paragraphs, tables, lists, etc.)"),
      tabs: z.array(z.record(z.unknown())).optional().describe("Multi-tab document structure"),
    }).describe("Document specification in fancy-gdocs DSL format"),
    theme: z.string().optional().describe("Override theme (takes precedence over spec.theme)"),
  },
  async ({ spec, theme }) => {
    try {
      const result = await createDocument(spec as DocSpec, theme ?? (typeof spec.theme === "string" ? spec.theme : undefined));
      return {
        content: [
          {
            type: "text",
            text: `Created document: ${result.title}\nURL: ${result.url}\nID: ${result.documentId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating document: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: read_doc
server.tool(
  "read_doc",
  "Read a Google Doc and return its content as DSL blocks.",
  {
    documentId: z.string().describe("Google Doc document ID"),
    account: z.enum(["work", "personal"]).optional().describe("Google account to use"),
  },
  async ({ documentId, account }) => {
    try {
      const result = await readDocument(documentId, account);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading document: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool: list_themes
server.tool(
  "list_themes",
  "List available document themes.",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: `Available themes:\n${THEME_NAMES.map(t => `- ${t}`).join("\n")}`,
        },
      ],
    };
  }
);

// Tool: validate_spec
server.tool(
  "validate_spec",
  "Validate a document spec without creating it. Returns compiled IR for inspection.",
  {
    spec: z.object({
      title: z.string(),
      blocks: z.array(z.record(z.unknown())).optional(),
      tabs: z.array(z.record(z.unknown())).optional(),
      theme: z.string().optional(),
    }).describe("Document specification to validate"),
  },
  async ({ spec }) => {
    try {
      if (!spec.title) throw new Error("Spec must have a 'title' field");
      if (!spec.blocks && !spec.tabs) throw new Error("Spec must have 'blocks' or 'tabs'");

      // Apply theme if specified
      const docSpec = spec as DocSpec;
      if (typeof spec.theme === "string" && isThemeName(spec.theme)) {
        const preset = loadTheme(spec.theme);
        applyThemePreset(docSpec, preset);
      }

      const { ir, registry } = compileDoc(docSpec, docSpec.theme);
      const requestCount = ir.segments.reduce((sum, seg) => sum + seg.requests.length + seg.deferred.length, 0);

      return {
        content: [
          {
            type: "text",
            text: `Spec is valid.\nTitle: ${spec.title}\nSegments: ${ir.segments.length}\nTotal requests: ${requestCount}\nPending footnotes: ${registry.getPendingFootnotes().length}\nPending anchor links: ${registry.getPendingAnchorLinks().length}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("fancy-gdocs MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
