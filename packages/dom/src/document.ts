import {Comment} from "./comment.ts"
import {
  acquireDocumentAuthorStyleSheetOwnerInternal,
  readDocumentAuthorStyleSheetsInternal,
  subscribeDocumentAuthorStyleSheetsInternal
} from "./author-style-sheet.ts"
import type {
  DocumentAuthorStyleSheet,
  DocumentAuthorStyleSheetOwner,
  DocumentAuthorStyleSheetSnapshot,
  DocumentAuthorStyleSheetSubscriber
} from "./author-style-sheet.ts"
import {
  acquireDocumentCompiledStyleSheetsInternal,
  readDocumentCompiledStyleSheetsInternal,
  subscribeDocumentCompiledStyleSheetsInternal
} from "./compiled-style-sheet.ts"
import type {
  DocumentCompiledStyleSheet,
  DocumentCompiledStyleSheetLease,
  DocumentCompiledStyleSheetSnapshot,
  DocumentCompiledStyleSheetSubscriber
} from "./compiled-style-sheet.ts"
import {DocumentFragment} from "./document-fragment.ts"
import {Element} from "./element.ts"
import {FocusEvent} from "./focus-event.ts"
import {HTMLButtonElement} from "./html-button-element.ts"
import {HTMLDivElement} from "./html-div-element.ts"
import {HTMLFieldSetElement} from "./html-field-set-element.ts"
import {HTMLHeadingElement} from "./html-heading-element.ts"
import {HTMLElement} from "./html-element.ts"
import {HTMLInputElement} from "./html-input-element.ts"
import {HTMLImageElement} from "./html-image-element.ts"
import {HTMLLabelElement} from "./html-label-element.ts"
import {HTMLLIElement} from "./html-li-element.ts"
import {HTMLLegendElement} from "./html-legend-element.ts"
import {HTMLMeterElement} from "./html-meter-element.ts"
import {HTMLOptionElement} from "./html-option-element.ts"
import {HTMLParagraphElement} from "./html-paragraph-element.ts"
import {HTMLProgressElement} from "./html-progress-element.ts"
import {HTMLSelectElement} from "./html-select-element.ts"
import {HTMLSpanElement} from "./html-span-element.ts"
import {HTMLTableCellElement} from "./html-table-cell-element.ts"
import {HTMLTableElement} from "./html-table-element.ts"
import {HTMLTableRowElement} from "./html-table-row-element.ts"
import {HTMLTableSectionElement} from "./html-table-section-element.ts"
import {HTMLTextAreaElement} from "./html-text-area-element.ts"
import {HTMLUListElement} from "./html-u-list-element.ts"
import {
  changeFocus,
  clearFocusInSubtree,
  isProgrammaticallyFocusable
} from "./internal/focus.ts"
import {
  dismissTopmostAutoPopover,
  lightDismissPopovers
} from "./internal/popover.ts"
import {
  recordFocusStateChange,
  recordInputStateChange,
  recordOptionStateChange,
  recordPopoverStateChange,
  recordScrollStateChange,
  recordSelectPickerStateChange,
  recordTextAreaStateChange
} from "./internal/state-change.ts"
import type {DocumentMutation, MutationBatch, MutationSubscriber} from "./mutation.ts"
import {Node} from "./node.ts"
import type {NodeOrString} from "./node.ts"
import type {NodeList} from "./node-list.ts"
import {findElementById, queryAll, queryFirst} from "./selectors.ts"
import {
  beginDocumentPointer,
  endDocumentPointer,
  readDocumentPointerCaptureTarget
} from "./pointer-capture.ts"
import {
  closeSelectPickerOutside,
  readOpenSelectPicker
} from "./select-picker-state.ts"
import type {
  DocumentStateChange,
  FocusStateChange,
  InputStateChange,
  OptionSelectedStateChange,
  PopoverStateChange,
  ScrollStateChange,
  SelectPickerStateChange,
  StateChangeBatch,
  StateChangeSubscriber,
  TextAreaStateChange
} from "./state-change.ts"
import {sameTextSelection} from "./internal/text-selection.ts"
import {Text} from "./text.ts"

type StateChangeState = {
  flushing: boolean
  pending: Map<HTMLElement, Map<string, DocumentStateChange>>
  subscribers: Set<StateChangeSubscriber>
  version: number
}

type CompiledStyleSheetEntry = {
  references: number
  styleSheet: DocumentCompiledStyleSheet
}

type CompiledStyleSheetState = {
  dirty: boolean
  entries: Map<string, CompiledStyleSheetEntry>
  snapshot: DocumentCompiledStyleSheetSnapshot
  subscribers: Set<DocumentCompiledStyleSheetSubscriber>
}

type AuthorStyleSheetState = {
  dirty: boolean
  owner: symbol | null
  pending: readonly DocumentAuthorStyleSheet[]
  snapshot: DocumentAuthorStyleSheetSnapshot
  subscribers: Set<DocumentAuthorStyleSheetSubscriber>
}

export interface HTMLElementTagNameMap {
  button: HTMLButtonElement
  div: HTMLDivElement
  fieldset: HTMLFieldSetElement
  h1: HTMLHeadingElement
  h2: HTMLHeadingElement
  h3: HTMLHeadingElement
  h4: HTMLHeadingElement
  h5: HTMLHeadingElement
  h6: HTMLHeadingElement
  input: HTMLInputElement
  img: HTMLImageElement
  label: HTMLLabelElement
  li: HTMLLIElement
  legend: HTMLLegendElement
  meter: HTMLMeterElement
  option: HTMLOptionElement
  p: HTMLParagraphElement
  progress: HTMLProgressElement
  select: HTMLSelectElement
  span: HTMLSpanElement
  table: HTMLTableElement
  tbody: HTMLTableSectionElement
  td: HTMLTableCellElement
  textarea: HTMLTextAreaElement
  tfoot: HTMLTableSectionElement
  th: HTMLTableCellElement
  thead: HTMLTableSectionElement
  tr: HTMLTableRowElement
  ul: HTMLUListElement
}

export type TextControlSelectionTarget = HTMLInputElement | HTMLTextAreaElement

export type DocumentTextControlSelection = Readonly<{
  target: TextControlSelectionTarget
  start: number
  end: number
  direction: "forward" | "backward" | "none"
  collapsed: boolean
  text: string
}>

export class Document extends Node {
  private transactionDepth = 0
  private pendingMutations: DocumentMutation[] = []
  private readonly mutationSubscribers = new Set<MutationSubscriber>()
  private flushingMutations = false
  private mutationVersion = 0
  private focusState: {activeElement: HTMLElement | null; revision: number} | null = null
  private stateChangeState: StateChangeState | null = null
  private authorStyleSheetState: AuthorStyleSheetState | null = null
  private compiledStyleSheetState: CompiledStyleSheetState | null = null

  constructor() {
    super(null, Node.DOCUMENT_NODE, "#document")
  }

  get documentElement(): Element | null {
    return this.children[0] ?? null
  }

  get children(): readonly Element[] {
    return this.childNodes.filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE)
  }

  get version(): number {
    return this.mutationVersion
  }

  get stateVersion(): number {
    return this.stateChangeState?.version ?? 0
  }

  get activeElement(): Element | null {
    const activeElement = this.focusState?.activeElement ?? null
    if (!activeElement || activeElement.ownerDocument !== this || activeElement.getRootNode() !== this) {
      return null
    }
    return activeElement
  }

  createElement<K extends keyof HTMLElementTagNameMap>(localName: K): HTMLElementTagNameMap[K]
  createElement(localName: string): HTMLElement
  createElement(localName: string): HTMLElement {
    switch (String(localName).toLowerCase()) {
      case "button": return new HTMLButtonElement(this)
      case "div": return new HTMLDivElement(this)
      case "fieldset": return new HTMLFieldSetElement(this)
      case "h1": return new HTMLHeadingElement(this, "h1")
      case "h2": return new HTMLHeadingElement(this, "h2")
      case "h3": return new HTMLHeadingElement(this, "h3")
      case "h4": return new HTMLHeadingElement(this, "h4")
      case "h5": return new HTMLHeadingElement(this, "h5")
      case "h6": return new HTMLHeadingElement(this, "h6")
      case "input": return new HTMLInputElement(this)
      case "img": return new HTMLImageElement(this)
      case "label": return new HTMLLabelElement(this)
      case "li": return new HTMLLIElement(this)
      case "legend": return new HTMLLegendElement(this)
      case "meter": return new HTMLMeterElement(this)
      case "option": return new HTMLOptionElement(this)
      case "p": return new HTMLParagraphElement(this)
      case "progress": return new HTMLProgressElement(this)
      case "select": return new HTMLSelectElement(this)
      case "span": return new HTMLSpanElement(this)
      case "table": return new HTMLTableElement(this)
      case "tbody": return new HTMLTableSectionElement(this, "tbody")
      case "td": return new HTMLTableCellElement(this, "td")
      case "textarea": return new HTMLTextAreaElement(this)
      case "tfoot": return new HTMLTableSectionElement(this, "tfoot")
      case "th": return new HTMLTableCellElement(this, "th")
      case "thead": return new HTMLTableSectionElement(this, "thead")
      case "tr": return new HTMLTableRowElement(this)
      case "ul": return new HTMLUListElement(this)
      default: return new HTMLElement(this, localName)
    }
  }

  createTextNode(data: string): Text {
    return new Text(this, data)
  }

  createComment(data: string): Comment {
    return new Comment(this, data)
  }

  createDocumentFragment(): DocumentFragment {
    return new DocumentFragment(this)
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

  getElementById(elementId: string): Element | null {
    return findElementById(this, elementId)
  }

  querySelector(selectors: string): Element | null {
    return queryFirst(this, selectors)
  }

  querySelectorAll(selectors: string): NodeList<Element> {
    return queryAll(this, selectors)
  }

  beginPointer(pointerId: number): void {
    beginDocumentPointer(this, pointerId)
  }

  readPointerCaptureTarget(pointerId: number): Element | null {
    return readDocumentPointerCaptureTarget(this, pointerId)
  }

  endPointer(pointerId: number): void {
    endDocumentPointer(this, pointerId)
  }

  readOpenSelectPicker(): HTMLSelectElement | null {
    return readOpenSelectPicker(this)
  }

  closeSelectPickerOutside(target: Element | null): boolean {
    return closeSelectPickerOutside(this, target)
  }

  readTextControlSelection(): DocumentTextControlSelection | null {
    const active = this.activeElement
    if (active instanceof HTMLTextAreaElement) {
      return textControlSelection(
        active,
        active.selectionStart,
        active.selectionEnd,
        active.selectionDirection,
      )
    }
    if (active instanceof HTMLInputElement && active.selectionStart !== null) {
      return textControlSelection(
        active,
        active.selectionStart,
        active.selectionEnd ?? active.selectionStart,
        active.selectionDirection ?? "none",
      )
    }
    return null
  }

  lightDismissPopovers(target: Element | null): boolean {
    return lightDismissPopovers(this, target)
  }

  dismissTopmostAutoPopover(): boolean {
    return dismissTopmostAutoPopover(this)
  }

  transaction<Result>(callback: () => Result): Result {
    this.transactionDepth += 1
    try {
      return callback()
    } finally {
      this.transactionDepth -= 1
      if (this.transactionDepth === 0) {
        this.flushAuthorStyleSheets()
        this.flushCompiledStyleSheets()
        this.flushMutations()
        this.flushStateChanges()
      }
    }
  }

  subscribeMutations(subscriber: MutationSubscriber): () => void {
    this.mutationSubscribers.add(subscriber)
    return () => this.mutationSubscribers.delete(subscriber)
  }

  [acquireDocumentAuthorStyleSheetOwnerInternal](): DocumentAuthorStyleSheetOwner {
    const state = this.ensureAuthorStyleSheetState()
    if (state.owner !== null) {
      throw new Error("Document author stylesheet owner is already acquired")
    }
    const owner = Symbol("document-author-style-sheet-owner")
    state.owner = owner
    let released = false
    return Object.freeze({
      replace: (styleSheets: readonly DocumentAuthorStyleSheet[]) => {
        if (released || state.owner !== owner) {
          throw new Error("Document author stylesheet owner has been released")
        }
        const next = normalizeAuthorStyleSheets(styleSheets)
        if (sameAuthorStyleSheets(state.pending, next)) return
        state.pending = next
        state.dirty = true
        if (this.transactionDepth === 0) this.flushAuthorStyleSheets()
      },
      release: () => {
        if (released) return
        released = true
        if (state.owner !== owner) return
        state.owner = null
        if (state.pending.length === 0) return
        state.pending = Object.freeze([])
        state.dirty = true
        if (this.transactionDepth === 0) this.flushAuthorStyleSheets()
      }
    })
  }

  [readDocumentAuthorStyleSheetsInternal](): DocumentAuthorStyleSheetSnapshot {
    return this.ensureAuthorStyleSheetState().snapshot
  }

  [subscribeDocumentAuthorStyleSheetsInternal](
    subscriber: DocumentAuthorStyleSheetSubscriber
  ): () => void {
    if (typeof subscriber !== "function") {
      throw new TypeError("Author stylesheet subscriber must be a function")
    }
    const state = this.ensureAuthorStyleSheetState()
    state.subscribers.add(subscriber)
    return () => state.subscribers.delete(subscriber)
  }

  [acquireDocumentCompiledStyleSheetsInternal](
    styleSheets: readonly DocumentCompiledStyleSheet[]
  ): DocumentCompiledStyleSheetLease {
    if (!Array.isArray(styleSheets)) {
      throw new TypeError("Compiled styleSheets must be an array")
    }
    const unique = new Map<string, DocumentCompiledStyleSheet>()
    for (const source of styleSheets) {
      if (source === null || typeof source !== "object") {
        throw new TypeError("A compiled stylesheet must be an object")
      }
      if (typeof source.id !== "string" || typeof source.cssText !== "string") {
        throw new TypeError("A compiled stylesheet requires string id and cssText")
      }
      const id = source.id.trim()
      const {cssText} = source
      if (id.length === 0) throw new TypeError("A compiled stylesheet id cannot be empty")
      const previous = unique.get(id)
      if (previous !== undefined && previous.cssText !== cssText) {
        throw new Error(`Compiled stylesheet id collision: ${id}`)
      }
      if (previous === undefined) unique.set(id, Object.freeze({id, cssText}))
    }

    const state = this.ensureCompiledStyleSheetState()
    for (const [id, source] of unique) {
      const current = state.entries.get(id)
      if (current !== undefined && current.styleSheet.cssText !== source.cssText) {
        throw new Error(`Compiled stylesheet id collision: ${id}`)
      }
      if (current?.references === Number.MAX_SAFE_INTEGER) {
        throw new RangeError(`Compiled stylesheet reference overflow: ${id}`)
      }
    }

    for (const [id, source] of unique) {
      const current = state.entries.get(id)
      if (current === undefined) {
        state.entries.set(id, {references: 1, styleSheet: source})
        state.dirty = true
      } else current.references += 1
    }
    if (this.transactionDepth === 0) this.flushCompiledStyleSheets()

    let released = false
    return Object.freeze({
      release: () => {
        if (released) return
        released = true
        for (const id of unique.keys()) {
          const current = state.entries.get(id)
          if (current === undefined) continue
          current.references -= 1
          if (current.references === 0) {
            state.entries.delete(id)
            state.dirty = true
          }
        }
        if (this.transactionDepth === 0) this.flushCompiledStyleSheets()
      }
    })
  }

  [readDocumentCompiledStyleSheetsInternal](): DocumentCompiledStyleSheetSnapshot {
    return this.ensureCompiledStyleSheetState().snapshot
  }

  [subscribeDocumentCompiledStyleSheetsInternal](
    subscriber: DocumentCompiledStyleSheetSubscriber
  ): () => void {
    if (typeof subscriber !== "function") {
      throw new TypeError("Compiled stylesheet subscriber must be a function")
    }
    const state = this.ensureCompiledStyleSheetState()
    state.subscribers.add(subscriber)
    return () => state.subscribers.delete(subscriber)
  }

  recordMutation(mutation: DocumentMutation): void {
    this.pendingMutations.push(mutation)
    if (this.transactionDepth === 0) this.flushMutations()
  }

  subscribeStateChanges(subscriber: StateChangeSubscriber): () => void {
    const state = this.ensureStateChangeState()
    state.subscribers.add(subscriber)
    return () => state.subscribers.delete(subscriber)
  }

  [recordScrollStateChange](change: ScrollStateChange): void {
    const state = this.ensureStateChangeState()
    const targetChanges = state.pending.get(change.target) ?? new Map<string, DocumentStateChange>()
    const current = targetChanges.get("scroll") as ScrollStateChange | undefined
    const next = Object.freeze({
      type: "scroll" as const,
      target: change.target,
      oldScrollLeft: current?.oldScrollLeft ?? change.oldScrollLeft,
      oldScrollTop: current?.oldScrollTop ?? change.oldScrollTop,
      scrollLeft: change.scrollLeft,
      scrollTop: change.scrollTop
    })
    if (next.oldScrollLeft === next.scrollLeft && next.oldScrollTop === next.scrollTop) {
      targetChanges.delete("scroll")
    } else {
      targetChanges.set("scroll", next)
    }
    this.updatePendingTarget(state, change.target, targetChanges)
    if (this.transactionDepth === 0) this.flushStateChanges()
  }

  [recordFocusStateChange](change: FocusStateChange): void {
    const state = this.ensureStateChangeState()
    const targetChanges = state.pending.get(change.target) ?? new Map<string, DocumentStateChange>()
    const key = `focus:${change.property}`
    const current = targetChanges.get(key) as FocusStateChange | undefined
    const next: FocusStateChange = Object.freeze({
      type: "focus",
      target: change.target,
      property: change.property,
      oldValue: current?.oldValue ?? change.oldValue,
      newValue: change.newValue
    })
    if (next.oldValue === next.newValue) targetChanges.delete(key)
    else targetChanges.set(key, next)
    this.updatePendingTarget(state, change.target, targetChanges)
    if (this.transactionDepth === 0) this.flushStateChanges()
  }

  [recordInputStateChange](change: InputStateChange): void {
    const state = this.ensureStateChangeState()
    const targetChanges = state.pending.get(change.target) ?? new Map<string, DocumentStateChange>()
    const key = `input:${change.property}`
    const current = targetChanges.get(key) as InputStateChange | undefined
    const next = Object.freeze({
      type: "input" as const,
      target: change.target,
      property: change.property,
      oldValue: current?.oldValue ?? change.oldValue,
      newValue: change.newValue
    }) as InputStateChange
    if (sameStateValue(next.oldValue, next.newValue)) targetChanges.delete(key)
    else targetChanges.set(key, next)
    this.updatePendingTarget(state, change.target, targetChanges)
    if (this.transactionDepth === 0) this.flushStateChanges()
  }

  [recordOptionStateChange](change: OptionSelectedStateChange): void {
    const state = this.ensureStateChangeState()
    const targetChanges = state.pending.get(change.target) ?? new Map<string, DocumentStateChange>()
    const key = "option:selected"
    const current = targetChanges.get(key) as OptionSelectedStateChange | undefined
    const next: OptionSelectedStateChange = Object.freeze({
      type: "option",
      target: change.target,
      property: "selected",
      oldValue: current?.oldValue ?? change.oldValue,
      newValue: change.newValue
    })
    if (next.oldValue === next.newValue) targetChanges.delete(key)
    else targetChanges.set(key, next)
    this.updatePendingTarget(state, change.target, targetChanges)
    if (this.transactionDepth === 0) this.flushStateChanges()
  }

  [recordPopoverStateChange](change: PopoverStateChange): void {
    const state = this.ensureStateChangeState()
    const targetChanges = state.pending.get(change.target) ?? new Map<string, DocumentStateChange>()
    const key = "popover:open"
    const current = targetChanges.get(key) as PopoverStateChange | undefined
    const next: PopoverStateChange = Object.freeze({
      type: "popover",
      target: change.target,
      property: "open",
      oldValue: current?.oldValue ?? change.oldValue,
      newValue: change.newValue
    })
    if (next.oldValue === next.newValue) targetChanges.delete(key)
    else targetChanges.set(key, next)
    this.updatePendingTarget(state, change.target, targetChanges)
    if (this.transactionDepth === 0) this.flushStateChanges()
  }

  [recordSelectPickerStateChange](change: SelectPickerStateChange): void {
    const state = this.ensureStateChangeState()
    const targetChanges = state.pending.get(change.target) ?? new Map<string, DocumentStateChange>()
    const key = "select-picker:open"
    const current = targetChanges.get(key) as SelectPickerStateChange | undefined
    const next: SelectPickerStateChange = Object.freeze({
      type: "select-picker",
      target: change.target,
      property: "open",
      oldValue: current?.oldValue ?? change.oldValue,
      newValue: change.newValue
    })
    if (next.oldValue === next.newValue) targetChanges.delete(key)
    else targetChanges.set(key, next)
    this.updatePendingTarget(state, change.target, targetChanges)
    if (this.transactionDepth === 0) this.flushStateChanges()
  }

  [recordTextAreaStateChange](change: TextAreaStateChange): void {
    const state = this.ensureStateChangeState()
    const targetChanges = state.pending.get(change.target) ?? new Map<string, DocumentStateChange>()
    const key = `textarea:${change.property}`
    const current = targetChanges.get(key) as TextAreaStateChange | undefined
    const next = Object.freeze({
      type: "textarea" as const,
      target: change.target,
      property: change.property,
      oldValue: current?.oldValue ?? change.oldValue,
      newValue: change.newValue
    }) as TextAreaStateChange
    if (sameStateValue(next.oldValue, next.newValue)) targetChanges.delete(key)
    else targetChanges.set(key, next)
    this.updatePendingTarget(state, change.target, targetChanges)
    if (this.transactionDepth === 0) this.flushStateChanges()
  }

  [changeFocus](nextElement: HTMLElement | null): void {
    this.transaction(() => this.applyFocusChange(nextElement))
  }

  private applyFocusChange(nextElement: HTMLElement | null): void {
    if (nextElement && (nextElement.ownerDocument !== this || !nextElement[isProgrammaticallyFocusable]())) {
      return
    }

    const previousElement = this.activeElement as HTMLElement | null
    if (previousElement === nextElement) return

    const focusState = this.focusState ??= {activeElement: null, revision: 0}
    focusState.revision += 1
    const revision = focusState.revision
    focusState.activeElement = null
    this.recordFocusTransition(previousElement, null)

    if (previousElement) {
      previousElement.dispatchEvent(new FocusEvent("blur", {
        composed: true,
        relatedTarget: nextElement
      }))
      if (focusState.revision !== revision) return
      previousElement.dispatchEvent(new FocusEvent("focusout", {
        bubbles: true,
        composed: true,
        relatedTarget: nextElement
      }))
      if (focusState.revision !== revision) return
    }

    if (!nextElement || !nextElement[isProgrammaticallyFocusable]()) return
    focusState.activeElement = nextElement
    this.recordFocusTransition(null, nextElement)
    nextElement.dispatchEvent(new FocusEvent("focus", {
      composed: true,
      relatedTarget: previousElement
    }))
    if (focusState.revision !== revision || focusState.activeElement !== nextElement) return
    nextElement.dispatchEvent(new FocusEvent("focusin", {
      bubbles: true,
      composed: true,
      relatedTarget: previousElement
    }))
  }

  [clearFocusInSubtree](subtree: Node): void {
    const focusState = this.focusState
    if (!focusState?.activeElement || !subtree.contains(focusState.activeElement)) return
    const previousElement = focusState.activeElement
    focusState.activeElement = null
    focusState.revision += 1
    this.recordFocusTransition(previousElement, null)
  }

  private recordFocusTransition(
    previousElement: HTMLElement | null,
    nextElement: HTMLElement | null
  ): void {
    if (previousElement !== null) {
      this[recordFocusStateChange](Object.freeze({
        type: "focus",
        target: previousElement,
        property: "focus",
        oldValue: true,
        newValue: false
      }))
    }
    if (nextElement !== null) {
      this[recordFocusStateChange](Object.freeze({
        type: "focus",
        target: nextElement,
        property: "focus",
        oldValue: false,
        newValue: true
      }))
    }

    const previousWithin = focusChain(previousElement)
    const nextWithin = focusChain(nextElement)
    for (const element of previousWithin) {
      if (nextWithin.has(element)) continue
      this[recordFocusStateChange](Object.freeze({
        type: "focus",
        target: element,
        property: "focus-within",
        oldValue: true,
        newValue: false
      }))
    }
    for (const element of nextWithin) {
      if (previousWithin.has(element)) continue
      this[recordFocusStateChange](Object.freeze({
        type: "focus",
        target: element,
        property: "focus-within",
        oldValue: false,
        newValue: true
      }))
    }
  }

  private flushMutations(): void {
    if (this.flushingMutations || this.pendingMutations.length === 0) return
    this.flushingMutations = true
    try {
      while (this.pendingMutations.length > 0) {
        const records = Object.freeze(this.pendingMutations.splice(0))
        this.mutationVersion += 1
        const batch: MutationBatch = Object.freeze({
          document: this,
          version: this.mutationVersion,
          records
        })
        for (const subscriber of [...this.mutationSubscribers]) subscriber(batch)
      }
    } finally {
      this.flushingMutations = false
    }
  }

  private ensureStateChangeState(): StateChangeState {
    return this.stateChangeState ??= {
      flushing: false,
      pending: new Map(),
      subscribers: new Set(),
      version: 0
    }
  }

  private ensureCompiledStyleSheetState(): CompiledStyleSheetState {
    return this.compiledStyleSheetState ??= {
      dirty: false,
      entries: new Map(),
      snapshot: Object.freeze({revision: 0, styleSheets: Object.freeze([])}),
      subscribers: new Set()
    }
  }

  private ensureAuthorStyleSheetState(): AuthorStyleSheetState {
    return this.authorStyleSheetState ??= {
      dirty: false,
      owner: null,
      pending: Object.freeze([]),
      snapshot: Object.freeze({revision: 0, styleSheets: Object.freeze([])}),
      subscribers: new Set()
    }
  }

  private flushAuthorStyleSheets(): void {
    const state = this.authorStyleSheetState
    if (!state?.dirty) return
    state.dirty = false
    if (sameAuthorStyleSheets(state.snapshot.styleSheets, state.pending)) return
    const revision = state.snapshot.revision + 1
    const styleSheets = state.pending
    state.snapshot = Object.freeze({revision, styleSheets})
    const change = Object.freeze({document: this, revision, styleSheets})
    for (const subscriber of [...state.subscribers]) subscriber(change)
  }

  private flushCompiledStyleSheets(): void {
    const state = this.compiledStyleSheetState
    if (!state?.dirty) return
    state.dirty = false
    const styleSheets = Object.freeze([...state.entries.values()].map(entry => entry.styleSheet))
    if (
      styleSheets.length === state.snapshot.styleSheets.length &&
      styleSheets.every((styleSheet, index) => styleSheet === state.snapshot.styleSheets[index])
    ) return
    const revision = state.snapshot.revision + 1
    state.snapshot = Object.freeze({revision, styleSheets})
    const change = Object.freeze({document: this, revision, styleSheets})
    for (const subscriber of [...state.subscribers]) subscriber(change)
  }

  private updatePendingTarget(
    state: StateChangeState,
    target: HTMLElement,
    targetChanges: Map<string, DocumentStateChange>
  ): void {
    if (targetChanges.size === 0) state.pending.delete(target)
    else state.pending.set(target, targetChanges)
  }

  private flushStateChanges(): void {
    const state = this.stateChangeState
    if (!state || state.flushing || state.pending.size === 0) return
    state.flushing = true
    try {
      while (state.pending.size > 0) {
        const records = Object.freeze(
          [...state.pending.values()].flatMap(targetChanges => [...targetChanges.values()])
        )
        state.pending.clear()
        state.version += 1
        const batch: StateChangeBatch = Object.freeze({
          document: this,
          version: state.version,
          records
        })
        for (const subscriber of [...state.subscribers]) subscriber(batch)
      }
    } finally {
      state.flushing = false
    }
  }
}

const textControlSelection = (
  target: TextControlSelectionTarget,
  start: number,
  end: number,
  direction: "forward" | "backward" | "none",
): DocumentTextControlSelection => Object.freeze({
  target,
  start,
  end,
  direction,
  collapsed: start === end,
  text: target.value.slice(start, end),
})

const normalizeAuthorStyleSheets = (
  styleSheets: readonly DocumentAuthorStyleSheet[]
): readonly DocumentAuthorStyleSheet[] => {
  if (!Array.isArray(styleSheets)) throw new TypeError("Author styleSheets must be an array")
  const unique = new Map<string, DocumentAuthorStyleSheet>()
  for (const source of styleSheets) {
    if (source === null || typeof source !== "object") {
      throw new TypeError("An author stylesheet must be an object")
    }
    if (typeof source.id !== "string" || typeof source.cssText !== "string") {
      throw new TypeError("An author stylesheet requires string id and cssText")
    }
    const id = source.id.trim()
    const {cssText} = source
    if (id.length === 0) throw new TypeError("An author stylesheet id cannot be empty")
    const previous = unique.get(id)
    if (previous !== undefined && previous.cssText !== cssText) {
      throw new Error(`Author stylesheet id collision: ${id}`)
    }
    if (previous === undefined) unique.set(id, Object.freeze({id, cssText}))
  }
  return Object.freeze([...unique.values()])
}

const sameAuthorStyleSheets = (
  left: readonly DocumentAuthorStyleSheet[],
  right: readonly DocumentAuthorStyleSheet[]
): boolean =>
  left.length === right.length &&
  left.every((styleSheet, index) => {
    const other = right[index]
    return other !== undefined &&
      styleSheet.id === other.id &&
      styleSheet.cssText === other.cssText
  })

const focusChain = (element: HTMLElement | null): Set<HTMLElement> => {
  const chain = new Set<HTMLElement>()
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current instanceof HTMLElement) chain.add(current)
  }
  return chain
}

const sameStateValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  return isTextSelectionValue(left) &&
    isTextSelectionValue(right) &&
    sameTextSelection(left, right)
}

const isTextSelectionValue = (
  value: unknown,
): value is Readonly<{start: number; end: number; direction: "forward" | "backward" | "none"}> =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as {start?: unknown}).start === "number" &&
  typeof (value as {end?: unknown}).end === "number" &&
  (
    (value as {direction?: unknown}).direction === "forward" ||
    (value as {direction?: unknown}).direction === "backward" ||
    (value as {direction?: unknown}).direction === "none"
  )

export function createDocument(): Document {
  return new Document()
}
