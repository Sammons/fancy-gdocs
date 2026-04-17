/**
 * Anchor link resolution for in-document navigation.
 *
 * This module handles the post-processing step that resolves anchor links
 * (e.g., [[#my-heading]]) to actual heading IDs after document creation.
 *
 * The process:
 * 1. During emit, anchors are registered with segment-relative indices
 * 2. After doc creation, we read the doc to find heading IDs at those positions
 * 3. We update the link text styles to point to the resolved heading IDs
 */

import type { AnchorLocation, PendingAnchorLink } from "../dag/ir/document-registry.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedAnchor {
  headingId: string;
  tabId?: string;
}

export interface RemappedLink {
  range: { startIndex: number; endIndex: number };
  tabId?: string;
  anchorName: string;
}

// ---------------------------------------------------------------------------
// Build anchor index by position
// ---------------------------------------------------------------------------

/**
 * Build a map from absolute document index to anchor name.
 * This is used to match heading positions in the doc to user-defined anchors.
 */
export function buildAnchorByIndex(
  registeredAnchors: Map<string, AnchorLocation>,
  tabIdMap: Record<string, string | undefined>,
): Map<number, { anchorName: string; tabId?: string }> {
  const anchorByAbsoluteIndex = new Map<number, { anchorName: string; tabId?: string }>();

  for (const [anchorName, loc] of registeredAnchors) {
    // Body segments have origin 1; header/footer have origin 0
    // For now, all user-defined anchors are in body segments (segmentId undefined)
    const origin = loc.segmentId === undefined ? 1 : 0;
    const absoluteIndex = loc.index + origin;
    // Map both the absolute index and the tabId (if set)
    const mappedTabId = loc.tabId ? tabIdMap[loc.tabId] : undefined;
    anchorByAbsoluteIndex.set(absoluteIndex, { anchorName, tabId: mappedTabId });
  }

  return anchorByAbsoluteIndex;
}

// ---------------------------------------------------------------------------
// Walk document to find heading IDs
// ---------------------------------------------------------------------------

export interface DocTab {
  tabProperties?: { tabId?: string };
  documentTab?: { body?: { content?: unknown[] } };
}

interface ParagraphElement {
  startIndex?: number;
  paragraph?: {
    paragraphStyle?: { headingId?: string };
  };
}

/**
 * Walk document content to build a map from anchor names to heading IDs.
 */
export function buildAnchorTargets(
  tabs: DocTab[],
  anchorByAbsoluteIndex: Map<number, { anchorName: string; tabId?: string }>,
): Map<string, ResolvedAnchor> {
  const anchorIdByName = new Map<string, ResolvedAnchor>();

  const walkContent = (content: unknown[], realTabId?: string): void => {
    for (const el of content ?? []) {
      const elem = el as ParagraphElement;
      const para = elem?.paragraph;
      if (!para) continue;
      const ps = para.paragraphStyle ?? {};
      const headingId: string | undefined = ps.headingId;
      if (!headingId) continue;
      // Check if this paragraph's startIndex matches a registered anchor
      const startIndex: number | undefined = elem.startIndex;
      if (startIndex === undefined) continue;
      const anchor = anchorByAbsoluteIndex.get(startIndex);
      if (anchor) {
        anchorIdByName.set(anchor.anchorName, { headingId, tabId: realTabId });
      }
    }
  };

  for (const tab of tabs) {
    const rawTabId = tab?.tabProperties?.tabId;
    const tabBody = tab?.documentTab?.body?.content as unknown[] | undefined;
    if (tabBody) walkContent(tabBody, rawTabId);
  }

  return anchorIdByName;
}

// ---------------------------------------------------------------------------
// Remap pending links
// ---------------------------------------------------------------------------

/**
 * Remap pending anchor links' tabIds and rebase indices (body origin = 1).
 */
export function remapPendingLinks(
  pendingLinks: PendingAnchorLink[],
  tabIdMap: Record<string, string | undefined>,
): RemappedLink[] {
  return pendingLinks.map(link => ({
    anchorName: link.anchorName,
    range: {
      startIndex: link.range.startIndex + 1, // Rebase: segment-relative -> absolute
      endIndex: link.range.endIndex + 1,
    },
    tabId: link.tabId ? tabIdMap[link.tabId] : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Build update requests
// ---------------------------------------------------------------------------

export interface AnchorLinkResult {
  requests: Record<string, unknown>[];
  unresolved: string[];
}

/**
 * Build updateTextStyle requests for resolved anchor links.
 * Returns the requests and any unresolved anchor names.
 */
export function buildAnchorLinkRequests(
  remappedLinks: RemappedLink[],
  anchorIdByName: Map<string, ResolvedAnchor>,
): AnchorLinkResult {
  const requests: Record<string, unknown>[] = [];
  const unresolved: string[] = [];

  for (const link of remappedLinks) {
    const target = anchorIdByName.get(link.anchorName);
    if (!target) {
      unresolved.push(link.anchorName);
      continue;
    }
    const range: Record<string, unknown> = {
      startIndex: link.range.startIndex,
      endIndex: link.range.endIndex,
    };
    if (link.tabId) range.tabId = link.tabId;

    const linkValue: Record<string, unknown> = { heading: { id: target.headingId } };
    if (target.tabId) (linkValue.heading as Record<string, unknown>).tabId = target.tabId;

    requests.push({
      updateTextStyle: {
        range,
        textStyle: { link: linkValue },
        fields: "link",
      },
    });
  }

  return { requests, unresolved };
}
