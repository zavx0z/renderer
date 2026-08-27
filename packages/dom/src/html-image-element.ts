import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"
import {parseHTMLInteger, toLong} from "./internal/web-idl.ts"

export class HTMLImageElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "img")
  }

  get src(): string {
    return this.getAttribute("src") ?? ""
  }

  set src(value: string) {
    this.setAttribute("src", value)
  }

  get alt(): string {
    return this.getAttribute("alt") ?? ""
  }

  set alt(value: string) {
    this.setAttribute("alt", value)
  }

  get width(): number {
    return reflectedDimension(this.getAttribute("width"))
  }

  set width(value: number) {
    this.setAttribute("width", String(toLong(value, 32, true)))
  }

  get height(): number {
    return reflectedDimension(this.getAttribute("height"))
  }

  set height(value: number) {
    this.setAttribute("height", String(toLong(value, 32, true)))
  }
}

function reflectedDimension(value: string | null): number {
  if (value === null) return 0
  const parsed = parseHTMLInteger(value)
  return parsed !== null && parsed >= 0 ? parsed : 0
}
