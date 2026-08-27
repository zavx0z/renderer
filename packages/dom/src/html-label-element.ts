import type {Document} from "./document.ts"
import {Element} from "./element.ts"
import {HTMLButtonElement} from "./html-button-element.ts"
import {HTMLElement} from "./html-element.ts"
import {HTMLInputElement} from "./html-input-element.ts"
import {HTMLMeterElement} from "./html-meter-element.ts"
import {HTMLProgressElement} from "./html-progress-element.ts"
import {HTMLSelectElement} from "./html-select-element.ts"
import {HTMLTextAreaElement} from "./html-text-area-element.ts"
import type {Node} from "./node.ts"

function labelable(element: Element): element is HTMLElement {
  return element instanceof HTMLButtonElement ||
    (element instanceof HTMLInputElement && element.type !== "hidden") ||
    element instanceof HTMLMeterElement ||
    element instanceof HTMLProgressElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
}

function descendants(root: Node): Element[] {
  const elements: Element[] = []
  const visit = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === 1) elements.push(child as Element)
      visit(child)
    }
  }
  visit(root)
  return elements
}

export class HTMLLabelElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "label")
  }

  get htmlFor(): string {
    return this.getAttribute("for") ?? ""
  }

  set htmlFor(value: string) {
    this.setAttribute("for", value)
  }

  get control(): HTMLElement | null {
    if (this.hasAttribute("for")) {
      const id = this.htmlFor
      if (id === "") return null
      const candidate = descendants(this.getRootNode()).find(
        element => element.getAttribute("id") === id
      ) ?? null
      return candidate && labelable(candidate) ? candidate : null
    }
    return descendants(this).find(labelable) ?? null
  }
}
