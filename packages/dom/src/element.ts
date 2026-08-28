import type {Document} from "./document.ts"
import {getClassList} from "./dom-token-list.ts"
import type {DOMTokenList} from "./dom-token-list.ts"
import type {AttributeMutation} from "./mutation.ts"
import {Node} from "./node.ts"
import type {NodeOrString} from "./node.ts"
import type {NodeList} from "./node-list.ts"
import {readElementBoundingClientRect} from "./render-read.ts"
import type {DOMRectReadOnly} from "./dom-rect.ts"
import {
  closestMatch,
  matchesSelector,
  queryAll,
  queryFirst
} from "./selectors.ts"

function normalizeAttributeName(name: string): string {
  return String(name).replace(/[A-Z]/g, character => character.toLowerCase())
}

export class Element extends Node {
  readonly localName: string
  readonly tagName: string
  private attributeValues: Map<string, string> | null = null

  constructor(ownerDocument: Document, localName: string) {
    const normalizedName = String(localName).toLowerCase()
    super(ownerDocument, Node.ELEMENT_NODE, normalizedName.toUpperCase())
    this.localName = normalizedName
    this.tagName = normalizedName.toUpperCase()
  }

  get children(): readonly Element[] {
    return this.childNodes.filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE)
  }

  get childElementCount(): number {
    return this.children.length
  }

  get firstElementChild(): Element | null {
    return this.children[0] ?? null
  }

  get lastElementChild(): Element | null {
    return this.children.at(-1) ?? null
  }

  get id(): string {
    return this.getAttribute("id") ?? ""
  }

  set id(value: string) {
    this.setAttribute("id", value)
  }

  get className(): string {
    return this.getAttribute("class") ?? ""
  }

  set className(value: string) {
    this.setAttribute("class", value)
  }

  get classList(): DOMTokenList {
    return getClassList(this)
  }

  hasAttributes(): boolean {
    return (this.attributeValues?.size ?? 0) > 0
  }

  hasAttribute(name: string): boolean {
    return this.attributeValues?.has(normalizeAttributeName(name)) ?? false
  }

  getAttribute(name: string): string | null {
    return this.attributeValues?.get(normalizeAttributeName(name)) ?? null
  }

  getAttributeNames(): string[] {
    return this.attributeValues ? [...this.attributeValues.keys()] : []
  }

  setAttribute(name: string, value: string): void {
    const attributeName = normalizeAttributeName(name)
    const attributeValues = this.attributeValues ??= new Map()
    const oldValue = attributeValues.get(attributeName) ?? null
    const newValue = String(value)
    attributeValues.set(attributeName, newValue)
    this.recordAttributeMutation(attributeName, oldValue, newValue)
  }

  removeAttribute(name: string): void {
    const attributeName = normalizeAttributeName(name)
    const oldValue = this.attributeValues?.get(attributeName)
    if (oldValue === undefined) return
    this.attributeValues!.delete(attributeName)
    if (this.attributeValues!.size === 0) this.attributeValues = null
    this.recordAttributeMutation(attributeName, oldValue, null)
  }

  toggleAttribute(name: string, force?: boolean): boolean {
    const attributeName = normalizeAttributeName(name)
    const present = this.hasAttribute(attributeName)
    if (present && force !== true) {
      this.removeAttribute(attributeName)
      return false
    }
    if (!present && force !== false) {
      this.setAttribute(attributeName, "")
      return true
    }
    return present
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

  before(...nodes: NodeOrString[]): void {
    this.beforeNodes(...nodes)
  }

  after(...nodes: NodeOrString[]): void {
    this.afterNodes(...nodes)
  }

  replaceWith(...nodes: NodeOrString[]): void {
    this.replaceWithNodes(...nodes)
  }

  remove(): void {
    this.removeNode()
  }

  matches(selectors: string): boolean {
    return matchesSelector(this, selectors)
  }

  closest(selectors: string): Element | null {
    return closestMatch(this, selectors)
  }

  querySelector(selectors: string): Element | null {
    return queryFirst(this, selectors)
  }

  querySelectorAll(selectors: string): NodeList<Element> {
    return queryAll(this, selectors)
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return readElementBoundingClientRect(this)
  }

  override get textContent(): string {
    return this.descendantTextContent()
  }

  override set textContent(value: string | null) {
    this.replaceAllWithText(value)
  }

  private recordAttributeMutation(
    attributeName: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    const document = this.ownerDocument
    if (!document || !this.isConnected) return
    const mutation: AttributeMutation = Object.freeze({
      type: "attributes",
      target: this,
      attributeName,
      oldValue,
      newValue
    })
    document.recordMutation(mutation)
  }
}
