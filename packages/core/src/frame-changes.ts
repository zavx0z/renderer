import type {RenderFrame} from "./types.ts"
import {
  readCanonicalRenderFrameChangeState,
  type CanonicalRenderFrameChanges,
} from "./frame-change-state.ts"

/**
 * Reads an unforgeable sparse change set while its exact predecessor remains
 * live. A collected predecessor returns `null`, requiring complete validation.
 */
export function readCanonicalRenderFrameChanges(frame: RenderFrame): CanonicalRenderFrameChanges | null {
  return readCanonicalRenderFrameChangeState(frame)
}
