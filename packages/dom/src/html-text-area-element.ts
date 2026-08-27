import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"
import {domError} from "./internal/errors.ts"
import {disabledByAncestorFieldSet} from "./internal/disabled.ts"
import {isProgrammaticallyFocusable} from "./internal/focus.ts"
import {recordTextAreaStateChange} from "./internal/state-change.ts"
import {
  EMPTY_TEXT_SELECTION,
  sameTextSelection,
  textSelection,
  type TextSelection,
  type TextSelectionDirection
} from "./internal/text-selection.ts"
import {parseHTMLInteger, toLong} from "./internal/web-idl.ts"

type TextAreaState = {
  dirty: boolean
  value: string
  selection: TextSelection | null
}

function normalizeNewlines(value: string): string {
  return String(value).replace(/\r\n?/g, "\n")
}

function positiveReflection(value: number, fallback: number): number {
  const converted = toLong(value, 32, true)
  return converted >= 1 && converted <= 2147483647 ? converted : fallback
}

function reflectedNonNegativeInteger(value: string | null): number {
  const parsed = parseHTMLInteger(value ?? "")
  return parsed !== null && parsed >= 0 ? parsed : -1
}

export class HTMLTextAreaElement extends HTMLElement {
  private textAreaState: TextAreaState | null = null

  constructor(ownerDocument: Document) {
    super(ownerDocument, "textarea")
  }

  get placeholder(): string {
    return this.getAttribute("placeholder") ?? ""
  }

  set placeholder(value: string) {
    this.setAttribute("placeholder", value)
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled")
  }

  set disabled(value: boolean) {
    if (value) this.setAttribute("disabled", "")
    else this.removeAttribute("disabled")
  }

  get readOnly(): boolean {
    return this.hasAttribute("readonly")
  }

  set readOnly(value: boolean) {
    if (value) this.setAttribute("readonly", "")
    else this.removeAttribute("readonly")
  }

  get rows(): number {
    const parsed = parseHTMLInteger(this.getAttribute("rows") ?? "")
    return parsed !== null && parsed > 0 ? parsed : 2
  }

  set rows(value: number) {
    this.setAttribute("rows", String(positiveReflection(value, 2)))
  }

  get cols(): number {
    const parsed = parseHTMLInteger(this.getAttribute("cols") ?? "")
    return parsed !== null && parsed > 0 ? parsed : 20
  }

  set cols(value: number) {
    this.setAttribute("cols", String(positiveReflection(value, 20)))
  }

  get maxLength(): number {
    return reflectedNonNegativeInteger(this.getAttribute("maxlength"))
  }

  set maxLength(value: number) {
    const converted = toLong(value)
    if (converted < 0) throw domError("IndexSizeError", "maxLength must not be negative")
    this.setAttribute("maxlength", String(converted))
  }

  get minLength(): number {
    return reflectedNonNegativeInteger(this.getAttribute("minlength"))
  }

  set minLength(value: number) {
    const converted = toLong(value)
    if (converted < 0) throw domError("IndexSizeError", "minLength must not be negative")
    this.setAttribute("minlength", String(converted))
  }

  get wrap(): string {
    return this.getAttribute("wrap") ?? ""
  }

  set wrap(value: string) {
    this.setAttribute("wrap", value)
  }

  get defaultValue(): string {
    return normalizeNewlines(super.textContent)
  }

  set defaultValue(value: string) {
    this.textContent = normalizeNewlines(value)
  }

  get value(): string {
    return this.textAreaState?.dirty ? this.textAreaState.value : this.defaultValue
  }

  set value(value: string) {
    this.ownerDocument!.transaction(() => {
      const oldValue = this.value
      const oldSelection = this.selectionSnapshot()
      const newValue = normalizeNewlines(value ?? "")
      const state = this.ensureTextAreaState()
      state.dirty = true
      state.value = newValue
      const end = newValue.length
      state.selection = textSelection(end, end, end)
      this.recordValueChange(oldValue, newValue)
      this.recordSelectionChange(oldSelection, state.selection)
    })
  }

  get selectionStart(): number {
    return this.selectionSnapshot().start
  }

  set selectionStart(value: number) {
    const current = this.selectionSnapshot()
    const start = Number(value)
    this.setSelectionRange(start, Math.max(start, current.end), current.direction)
  }

  get selectionEnd(): number {
    return this.selectionSnapshot().end
  }

  set selectionEnd(value: number) {
    const current = this.selectionSnapshot()
    this.setSelectionRange(current.start, Number(value), current.direction)
  }

  get selectionDirection(): TextSelectionDirection {
    return this.selectionSnapshot().direction
  }

  set selectionDirection(value: TextSelectionDirection) {
    const current = this.selectionSnapshot()
    this.setSelectionRange(current.start, current.end, value)
  }

  select(): void {
    this.setSelectionRange(0, this.value.length)
  }

  setSelectionRange(
    start: number,
    end: number,
    direction: TextSelectionDirection = "none"
  ): void {
    const previous = this.selectionSnapshot()
    const next = textSelection(this.value.length, start, end, direction)
    if (sameTextSelection(previous, next)) return
    this.ensureTextAreaState().selection = next
    this.recordSelectionChange(previous, next)
  }

  override get textContent(): string {
    return super.textContent
  }

  override set textContent(value: string) {
    const oldValue = this.value
    const oldSelection = this.selectionSnapshot()
    this.ownerDocument!.transaction(() => {
      super.textContent = normalizeNewlines(value ?? "")
      if (!this.textAreaState?.dirty) {
        this.clampStoredSelection()
        this.recordValueChange(oldValue, this.value)
        this.recordSelectionChange(oldSelection, this.selectionSnapshot())
      }
    })
  }

  override [isProgrammaticallyFocusable](): boolean {
    return !this.disabled &&
      !disabledByAncestorFieldSet(this) &&
      super[isProgrammaticallyFocusable]()
  }

  protected override get defaultTabIndex(): number {
    return 0
  }

  private ensureTextAreaState(): TextAreaState {
    return this.textAreaState ??= {dirty: false, value: "", selection: null}
  }

  private selectionSnapshot(): TextSelection {
    return this.textAreaState?.selection ?? EMPTY_TEXT_SELECTION
  }

  private clampStoredSelection(): void {
    const current = this.textAreaState?.selection
    if (current === null || current === undefined) return
    this.textAreaState!.selection = textSelection(
      this.value.length,
      current.start,
      current.end,
      current.direction
    )
  }

  private recordValueChange(oldValue: string, newValue: string): void {
    if (oldValue === newValue || !this.isConnected) return
    this.ownerDocument![recordTextAreaStateChange](Object.freeze({
      type: "textarea",
      target: this,
      property: "value",
      oldValue,
      newValue
    }))
  }

  private recordSelectionChange(oldValue: TextSelection, newValue: TextSelection): void {
    if (sameTextSelection(oldValue, newValue) || !this.isConnected) return
    this.ownerDocument![recordTextAreaStateChange](Object.freeze({
      type: "textarea",
      target: this,
      property: "selection",
      oldValue,
      newValue
    }))
  }
}
