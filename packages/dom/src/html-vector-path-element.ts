import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"

/** Exact absolute author-coordinate bound shared with the bounded Renderer parser. */
export const VECTOR_PATH_COORDINATE_LIMIT = 16_777_216

/**
 * Project-extension semantic owner for one retained stroked vector path.
 *
 * `d` is reflected as ordinary DOM state. Parsing, layout, paint and hit
 * projection remain Renderer responsibilities.
 */
export class HTMLVectorPathElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "vector-path")
  }

  get d(): string {
    return this.getAttribute("d") ?? ""
  }

  set d(value: string) {
    this.setAttribute("d", String(value))
  }
}
