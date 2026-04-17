// collect — first-pass walk, reserved for cross-reference resolution.
// MVP: no-op. The two-phase (collect → dispatch) seam is preserved so
// future features (forward refs, cross-refs, TOC) have a hook without
// a second refactor.

import type { Block } from "../types/block.ts";
import type { EmitContext } from "../ir/emit-context.ts";

export function collect(_node: Block, _ctx: EmitContext): void {
  // reserved for cross-reference resolution
}
