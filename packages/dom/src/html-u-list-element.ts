import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"

export class HTMLUListElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "ul")
  }
}
