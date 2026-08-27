import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"

export class HTMLLIElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "li")
  }
}
