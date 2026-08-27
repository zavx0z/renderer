import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"
import {
  finiteHTMLNumber,
  parseHTMLFloatingPointNumberPrefix,
  serializeHTMLNumber
} from "./internal/html-number.ts"

export class HTMLProgressElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "progress")
  }

  get max(): number {
    const parsed = parseHTMLFloatingPointNumberPrefix(this.getAttribute("max") ?? "")
    return parsed !== null && parsed > 0 ? parsed : 1
  }

  set max(value: number) {
    this.setAttribute("max", serializeHTMLNumber(finiteHTMLNumber(value)))
  }

  get value(): number {
    if (!this.hasAttribute("value")) return 0
    const parsed = parseHTMLFloatingPointNumberPrefix(this.getAttribute("value") ?? "")
    return Math.min(this.max, parsed !== null && parsed > 0 ? parsed : 0)
  }

  set value(value: number) {
    this.setAttribute("value", serializeHTMLNumber(finiteHTMLNumber(value)))
  }

  get position(): number {
    return this.hasAttribute("value") ? this.value / this.max : -1
  }
}
