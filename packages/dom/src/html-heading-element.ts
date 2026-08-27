import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"

export type HTMLHeadingTagName = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

export class HTMLHeadingElement extends HTMLElement {
  constructor(ownerDocument: Document, localName: HTMLHeadingTagName) {
    super(ownerDocument, localName)
  }
}
