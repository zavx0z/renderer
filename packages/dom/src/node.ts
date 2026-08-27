import {EventTarget} from "./event-target.ts"
import {domError} from "./internal/errors.ts"
import {clearFocusInSubtree} from "./internal/focus.ts"
import {closePopoversInSubtree} from "./internal/popover.ts"
import type {Document} from "./document.ts"
import type {Element} from "./element.ts"
import type {ChildListMutation} from "./mutation.ts"

function isElementNode(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

function mutationDocument(node: Node): Document | null {
  return node.nodeType === Node.DOCUMENT_NODE ? node as unknown as Document : node.ownerDocument
}

export type NodeOrString = Node | string

export abstract class Node extends EventTarget {
  static readonly ELEMENT_NODE = 1
  static readonly TEXT_NODE = 3
  static readonly COMMENT_NODE = 8
  static readonly DOCUMENT_NODE = 9
  static readonly DOCUMENT_FRAGMENT_NODE = 11

  readonly ELEMENT_NODE = Node.ELEMENT_NODE
  readonly TEXT_NODE = Node.TEXT_NODE
  readonly COMMENT_NODE = Node.COMMENT_NODE
  readonly DOCUMENT_NODE = Node.DOCUMENT_NODE
  readonly DOCUMENT_FRAGMENT_NODE = Node.DOCUMENT_FRAGMENT_NODE

  readonly nodeType: number
  readonly nodeName: string

  private nodeDocument: Document | null
  private parent: Node | null = null
  private previous: Node | null = null
  private next: Node | null = null
  private first: Node | null = null
  private last: Node | null = null

  protected constructor(ownerDocument: Document | null, nodeType: number, nodeName: string) {
    super()
    this.nodeDocument = ownerDocument
    this.nodeType = nodeType
    this.nodeName = nodeName
  }

  get ownerDocument(): Document | null {
    return this.nodeDocument
  }

  get parentNode(): Node | null {
    return this.parent
  }

  get parentElement(): Element | null {
    return this.parent && isElementNode(this.parent) ? this.parent : null
  }

  get previousSibling(): Node | null {
    return this.previous
  }

  get nextSibling(): Node | null {
    return this.next
  }

  get firstChild(): Node | null {
    return this.first
  }

  get lastChild(): Node | null {
    return this.last
  }

  get childNodes(): readonly Node[] {
    const children: Node[] = []
    for (let child = this.first; child; child = child.next) children.push(child)
    return children
  }

  get isConnected(): boolean {
    return this.getRootNode().nodeType === Node.DOCUMENT_NODE
  }

  get nodeValue(): string | null {
    return null
  }

  set nodeValue(_value: string | null) {}

  get textContent(): string | null {
    return null
  }

  set textContent(_value: string | null) {}

  hasChildNodes(): boolean {
    return this.first !== null
  }

  getRootNode(): Node {
    let root: Node = this
    while (root.parent) root = root.parent
    return root
  }

  contains(other: Node | null): boolean {
    for (let current = other; current; current = current.parent) {
      if (current === this) return true
    }
    return false
  }

  appendChild<T extends Node>(node: T): T {
    return this.insertBefore(node, null)
  }

  insertBefore<T extends Node>(node: T, child: Node | null): T {
    if (!this.canHaveChildren()) {
      throw domError("HierarchyRequestError", `${this.nodeName} cannot contain child nodes`)
    }
    if (child && child.parent !== this) {
      throw domError("NotFoundError", "The reference child does not belong to this parent")
    }
    if (node === child) return node
    if ((node as Node) === this || node.contains(this)) {
      throw domError("HierarchyRequestError", "The insertion would create a tree cycle")
    }

    const inserted = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? [...node.childNodes] : [node]
    this.validateInsertion(inserted, null)
    const document = mutationDocument(this)
    const mutate = () => this.insertNodes(inserted, child)
    if (document) document.transaction(mutate)
    else mutate()
    return node
  }

  removeChild<T extends Node>(child: T): T {
    if (child.parent !== this) throw domError("NotFoundError", "The child does not belong to this parent")
    const document = mutationDocument(this)
    const mutate = () => child.detach(true)
    if (document) document.transaction(mutate)
    else mutate()
    return child
  }

  replaceChild<T extends Node>(node: Node, child: T): T {
    if (child.parent !== this) throw domError("NotFoundError", "The child does not belong to this parent")
    if (node === child) return child
    if (node === this || node.contains(this)) {
      throw domError("HierarchyRequestError", "The replacement would create a tree cycle")
    }

    const inserted = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? [...node.childNodes] : [node]
    this.validateInsertion(inserted, [child])
    const document = mutationDocument(this)
    const mutate = () => {
      const before = [...this.childNodes]
      const childIndex = before.indexOf(child)
      const insertedSet = new Set(inserted)
      let insertionIndex = 0
      for (let index = 0; index < childIndex; index += 1) {
        const candidate = before[index]
        if (candidate && !insertedSet.has(candidate)) insertionIndex += 1
      }

      child.detach(true)
      for (const candidate of inserted) candidate.detach(true)
      const remaining = [...this.childNodes]
      const reference = remaining[insertionIndex] ?? null
      this.insertNodes(inserted, reference)
    }
    if (document) document.transaction(mutate)
    else mutate()
    return child
  }

  protected appendNodes(...nodes: NodeOrString[]): void {
    this.withMutationTransaction(() => this.insertBefore(this.convertNodes(nodes), null))
  }

  protected prependNodes(...nodes: NodeOrString[]): void {
    this.withMutationTransaction(() => this.insertBefore(this.convertNodes(nodes), this.first))
  }

  protected replaceChildrenNodes(...nodes: NodeOrString[]): void {
    this.withMutationTransaction(() => {
      const node = this.convertNodes(nodes)
      const inserted = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? [...node.childNodes] : [node]
      this.validateInsertion(inserted, this.childNodes)
      const removed = [...this.childNodes]
      for (const child of removed) child.detach(false)
      for (const child of inserted) child.detach(true)
      for (const child of inserted) {
        this.adopt(child)
        this.linkBefore(child, null)
      }
      if (removed.length > 0 || inserted.length > 0) {
        this.recordChildMutation(inserted, removed, null, null)
      }
    })
  }

  protected beforeNodes(...nodes: NodeOrString[]): void {
    const parent = this.parent
    if (!parent) return
    const nodeArguments = new Set(nodes.filter((node): node is Node => node instanceof Node))
    let viablePreviousSibling = this.previous
    while (viablePreviousSibling && nodeArguments.has(viablePreviousSibling)) {
      viablePreviousSibling = viablePreviousSibling.previous
    }
    this.withMutationTransaction(() => {
      const node = this.convertNodes(nodes)
      const reference = viablePreviousSibling ? viablePreviousSibling.next : parent.first
      parent.insertBefore(node, reference)
    })
  }

  protected afterNodes(...nodes: NodeOrString[]): void {
    const parent = this.parent
    if (!parent) return
    const nodeArguments = new Set(nodes.filter((node): node is Node => node instanceof Node))
    let viableNextSibling = this.next
    while (viableNextSibling && nodeArguments.has(viableNextSibling)) {
      viableNextSibling = viableNextSibling.next
    }
    this.withMutationTransaction(() => parent.insertBefore(this.convertNodes(nodes), viableNextSibling))
  }

  protected replaceWithNodes(...nodes: NodeOrString[]): void {
    const parent = this.parent
    if (!parent) return
    const nodeArguments = new Set(nodes.filter((node): node is Node => node instanceof Node))
    let viableNextSibling = this.next
    while (viableNextSibling && nodeArguments.has(viableNextSibling)) {
      viableNextSibling = viableNextSibling.next
    }
    this.withMutationTransaction(() => {
      const node = this.convertNodes(nodes)
      if (this.parent === parent) parent.replaceChild(node, this)
      else parent.insertBefore(node, viableNextSibling)
    })
  }

  protected removeNode(): void {
    this.parent?.removeChild(this)
  }

  protected descendantTextContent(): string {
    let content = ""
    const visit = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        content += node.nodeValue ?? ""
        return
      }
      for (const child of node.childNodes) visit(child)
    }
    for (const child of this.childNodes) visit(child)
    return content
  }

  protected replaceAllWithText(value: string | null): void {
    const document = mutationDocument(this)
    const mutate = () => {
      const removed = [...this.childNodes]
      for (const child of removed) child.detach(false)
      const normalized = value === null ? "" : String(value)
      const added = normalized === "" || !document ? [] : [document.createTextNode(normalized)]
      for (const child of added) this.linkBefore(child, null)
      if (removed.length > 0 || added.length > 0) {
        this.recordChildMutation(added, removed, null, null)
      }
    }
    if (document) document.transaction(mutate)
    else mutate()
  }

  protected override eventParent(): EventTarget | null {
    return this.parent
  }

  private canHaveChildren(): boolean {
    return this.nodeType === Node.DOCUMENT_NODE ||
      this.nodeType === Node.DOCUMENT_FRAGMENT_NODE ||
      this.nodeType === Node.ELEMENT_NODE
  }

  private validateInsertion(nodes: readonly Node[], replacing: readonly Node[] | null): void {
    for (const node of nodes) {
      if (node.nodeType === Node.DOCUMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        throw domError("HierarchyRequestError", "Document and DocumentFragment nodes cannot be inserted")
      }
      if (node === this || node.contains(this)) {
        throw domError("HierarchyRequestError", "The insertion would create a tree cycle")
      }
    }

    if (this.nodeType !== Node.DOCUMENT_NODE) return
    if (nodes.some(node => node.nodeType === Node.TEXT_NODE)) {
      throw domError("HierarchyRequestError", "A Document cannot contain Text children")
    }
    const replaced = new Set(replacing ?? [])
    const moving = new Set(nodes.filter(node => node.parent === this))
    const retainedElementCount = this.childNodes.filter(candidate =>
      !replaced.has(candidate) && !moving.has(candidate) && candidate.nodeType === Node.ELEMENT_NODE
    ).length
    const insertedElementCount = nodes.filter(node => node.nodeType === Node.ELEMENT_NODE).length
    if (retainedElementCount + insertedElementCount > 1) {
      throw domError("HierarchyRequestError", "A Document can contain at most one Element child")
    }
  }

  private convertNodes(nodes: readonly NodeOrString[]): Node {
    const document = mutationDocument(this)
    if (!document) throw domError("InvalidStateError", "The node has no associated Document")
    const converted = nodes.map(node => node instanceof Node ? node : document.createTextNode(String(node)))
    if (converted.length === 1) return converted[0]!
    const fragment = document.createDocumentFragment()
    for (const node of converted) fragment.appendChild(node)
    return fragment
  }

  private withMutationTransaction<Result>(callback: () => Result): Result {
    const document = mutationDocument(this)
    return document ? document.transaction(callback) : callback()
  }

  private insertNodes(nodes: readonly Node[], reference: Node | null): void {
    if (nodes.length === 0) return
    for (const node of nodes) node.detach(true)
    const previousSibling = reference ? reference.previous : this.last
    for (const node of nodes) {
      this.adopt(node)
      this.linkBefore(node, reference)
    }
    this.recordChildMutation(nodes, [], previousSibling, reference)
  }

  private adopt(node: Node): void {
    const document = mutationDocument(this)
    if (!document || node.nodeDocument === document) return
    const visit = (current: Node): void => {
      if (current.nodeType !== Node.DOCUMENT_NODE) current.nodeDocument = document
      for (const child of current.childNodes) visit(child)
    }
    visit(node)
  }

  private linkBefore(node: Node, reference: Node | null): void {
    const previous = reference ? reference.previous : this.last
    node.parent = this
    node.previous = previous
    node.next = reference
    if (previous) previous.next = node
    else this.first = node
    if (reference) reference.previous = node
    else this.last = node
  }

  private detach(record: boolean): void {
    const parent = this.parent
    if (!parent) return
    const document = mutationDocument(this)
    document?.[clearFocusInSubtree](this)
    closePopoversInSubtree(this)
    const previous = this.previous
    const next = this.next
    if (previous) previous.next = next
    else parent.first = next
    if (next) next.previous = previous
    else parent.last = previous
    this.parent = null
    this.previous = null
    this.next = null
    if (record) parent.recordChildMutation([], [this], previous, next)
  }

  private recordChildMutation(
    addedNodes: readonly Node[],
    removedNodes: readonly Node[],
    previousSibling: Node | null,
    nextSibling: Node | null
  ): void {
    const document = mutationDocument(this)
    if (!document || !this.isConnected) return
    const mutation: ChildListMutation = Object.freeze({
      type: "childList",
      target: this,
      addedNodes: Object.freeze([...addedNodes]),
      removedNodes: Object.freeze([...removedNodes]),
      previousSibling,
      nextSibling
    })
    document.recordMutation(mutation)
  }
}
