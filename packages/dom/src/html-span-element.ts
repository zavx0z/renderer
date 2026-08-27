import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"

export class HTMLSpanElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "span")
  }
}
