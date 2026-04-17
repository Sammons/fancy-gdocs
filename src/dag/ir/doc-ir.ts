import type { NamedStyleType } from "../theme/theme-spec.ts";

export interface SegmentRelativeRequest {
  request: Record<string, unknown>;
  indexFields: string[];
  /** Named style type of the paragraph this request belongs to (for theme application) */
  namedStyleType?: NamedStyleType;
}

export interface Segment {
  segmentId?: string;
  tabId?: string;
  localRequests: SegmentRelativeRequest[];
  deferredRequests: SegmentRelativeRequest[];
}

export interface DocIR {
  segments: Segment[];
}

export function makeRequest(
  request: Record<string, unknown>,
  indexFields: string[] = [],
  namedStyleType?: NamedStyleType,
): SegmentRelativeRequest {
  return { request, indexFields, namedStyleType };
}
