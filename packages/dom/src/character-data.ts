import type {Document} from "./document.ts"
import type {CharacterDataMutation} from "./mutation.ts"
import {Node} from "./node.ts"
import type {NodeOrString} from "./node.ts"

export class CharacterData extends Node {
  private value: string

  constructor(ownerDocument: Document, data = "", nodeType = Node.TEXT_NODE, nodeName = "#text") {
    super(ownerDocument, nodeType, nodeName)
    this.value = String(data)
  }

  get data(): string {
    return this.value
  }

  set data(value: string) {
    const next = String(value)
    const oldValue = this.value
    this.value = next
    const document = this.ownerDocument
    if (!document || !this.isConnected) return
    const mutation: CharacterDataMutation = Object.freeze({
      type: "characterData",
      target: this,
      oldValue,
      newValue: next
    })
    document.recordMutation(mutation)
  }

  get length(): number {
    return this.value.length
  }

  override get nodeValue(): string {
    return this.value
  }

  override set nodeValue(value: string | null) {
    this.data = value ?? ""
  }

  override get textContent(): string {
    return this.value
  }

  override set textContent(value: string | null) {
    this.data = value ?? ""
  }

  appendData(data: string): void {
    this.data = this.value + String(data)
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
}
