import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"

export type HTMLTableSectionTagName = "thead" | "tbody" | "tfoot"

export class HTMLTableSectionElement extends HTMLElement {
  constructor(ownerDocument: Document, localName: HTMLTableSectionTagName) {
    super(ownerDocument, localName)
  }
}
