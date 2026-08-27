import type {Document} from "./document.ts"
import type {Element} from "./element.ts"
import {Node} from "./node.ts"
import type {NodeOrString} from "./node.ts"
import type {NodeList} from "./node-list.ts"
import {queryAll, queryFirst} from "./selectors.ts"

export class DocumentFragment extends Node {
  constructor(ownerDocument: Document) {
    super(ownerDocument, Node.DOCUMENT_FRAGMENT_NODE, "#document-fragment")
  }

  override get textContent(): string {
    return this.descendantTextContent()
  }

  override set textContent(value: string | null) {
    this.replaceAllWithText(value)
  }

  append(...nodes: NodeOrString[]): void {
    this.appendNodes(...nodes)
  }

  prepend(...nodes: NodeOrString[]): void {
    this.prependNodes(...nodes)
  }

  replaceChildren(...nodes: NodeOrString[]): void {
    this.replaceChildrenNodes(...nodes)
  }

  querySelector(selectors: string): Element | null {
    return queryFirst(this, selectors)
  }

  querySelectorAll(selectors: string): NodeList<Element> {
    return queryAll(this, selectors)
  }
}
