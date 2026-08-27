import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"

export class HTMLFieldSetElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "fieldset")
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled")
  }

  set disabled(value: boolean) {
    if (value) this.setAttribute("disabled", "")
    else this.removeAttribute("disabled")
  }

  get name(): string {
    return this.getAttribute("name") ?? ""
  }

  set name(value: string) {
    this.setAttribute("name", value)
  }
}
