import type {Document} from "./document.ts"
import {Event} from "./event.ts"
import {HTMLElement} from "./html-element.ts"
import {domError} from "./internal/errors.ts"
import {disabledByAncestorFieldSet} from "./internal/disabled.ts"
import {isProgrammaticallyFocusable} from "./internal/focus.ts"
import {
  parseHTMLFloatingPointNumber,
  serializeHTMLNumber
} from "./internal/html-number.ts"
import {recordInputStateChange} from "./internal/state-change.ts"
import {
  EMPTY_TEXT_SELECTION,
  assertSelectionApplies,
  sameTextSelection,
  textSelection,
  type TextSelection,
  type TextSelectionDirection
} from "./internal/text-selection.ts"
import {MouseEvent} from "./mouse-event.ts"

const VALUE_DIRTY = 1
const CHECKED_DIRTY = 2

const inputTypes = new Set([
  "hidden",
  "text",
  "search",
  "tel",
  "url",
  "email",
  "password",
  "date",
  "month",
  "week",
  "time",
  "datetime-local",
  "number",
  "range",
  "color",
  "checkbox",
  "radio",
  "file",
  "submit",
  "image",
  "reset",
  "button"
])

type InputState = {
  dirty: number
  value: string
  checked: boolean
  indeterminate: boolean
  selection: TextSelection | null
}

const selectionInputTypes = new Set(["text", "search", "tel", "url", "password"])

function normalizeAttributeName(name: string): string {
  return String(name).replace(/[A-Z]/g, character => character.toLowerCase())
}

function attributeCanChangeLiveState(name: string): boolean {
  return name === "value" ||
    name === "checked" ||
    name === "type" ||
    name === "min" ||
    name === "max" ||
    name === "step"
}

function nearestStepValue(
  value: number,
  minimum: number,
  maximum: number,
  base: number,
  step: number
): number {
  const firstIndex = Math.ceil((minimum - base) / step)
  const lastIndex = Math.floor((maximum - base) / step)
  if (firstIndex > lastIndex) return value
  const quotient = (value - base) / step
  const lowerIndex = Math.max(firstIndex, Math.min(lastIndex, Math.floor(quotient)))
  const upperIndex = Math.max(firstIndex, Math.min(lastIndex, Math.ceil(quotient)))
  const lower = base + lowerIndex * step
  const upper = base + upperIndex * step
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(lower), Math.abs(upper)) * 8
  if (Math.abs(value - lower) <= tolerance) return lower
  if (Math.abs(value - upper) <= tolerance) return upper
  return value - lower < upper - value ? lower : upper
}

export class HTMLInputElement extends HTMLElement {
  private inputState: InputState | null = null

  constructor(ownerDocument: Document) {
    super(ownerDocument, "input")
  }

  get type(): string {
    const type = (this.getAttribute("type") ?? "").toLowerCase()
    return inputTypes.has(type) ? type : "text"
  }

  set type(value: string) {
    this.setAttribute("type", value)
  }

  get value(): string {
    const type = this.type
    let value: string
    if (this.inputState && (this.inputState.dirty & VALUE_DIRTY) !== 0) {
      value = this.inputState.value
    } else {
      const attribute = this.getAttribute("value")
      if (attribute !== null) value = attribute
      else value = type === "checkbox" || type === "radio" ? "on" : ""
    }
    return this.sanitizeValue(value, type)
  }

  set value(value: string) {
    this.ownerDocument!.transaction(() => {
      const oldValue = this.value
      const oldSelection = this.selectionSnapshot()
      const inputState = this.ensureInputState()
      inputState.value = this.sanitizeValue(String(value))
      inputState.dirty |= VALUE_DIRTY
      if (oldSelection !== null) {
        const end = inputState.value.length
        inputState.selection = textSelection(end, end, end)
      }
      this.recordValueChange(oldValue, inputState.value)
      this.recordSelectionChange(oldSelection, this.selectionSnapshot())
    })
  }

  get defaultValue(): string {
    return this.getAttribute("value") ?? ""
  }

  set defaultValue(value: string) {
    this.setAttribute("value", value)
  }

  get placeholder(): string {
    return this.getAttribute("placeholder") ?? ""
  }

  set placeholder(value: string) {
    this.setAttribute("placeholder", value)
  }

  get min(): string {
    return this.getAttribute("min") ?? ""
  }

  set min(value: string) {
    this.setAttribute("min", value)
  }

  get max(): string {
    return this.getAttribute("max") ?? ""
  }

  set max(value: string) {
    this.setAttribute("max", value)
  }

  get step(): string {
    return this.getAttribute("step") ?? ""
  }

  set step(value: string) {
    this.setAttribute("step", value)
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

  get required(): boolean {
    return this.hasAttribute("required")
  }

  set required(value: boolean) {
    if (value) this.setAttribute("required", "")
    else this.removeAttribute("required")
  }

  get checked(): boolean {
    if (this.inputState && (this.inputState.dirty & CHECKED_DIRTY) !== 0) {
      return this.inputState.checked
    }
    return this.defaultChecked
  }

  set checked(value: boolean) {
    const oldValue = this.checked
    const inputState = this.ensureInputState()
    inputState.checked = Boolean(value)
    inputState.dirty |= CHECKED_DIRTY
    this.recordCheckedChange(oldValue, inputState.checked)
  }

  get indeterminate(): boolean {
    return this.inputState?.indeterminate ?? false
  }

  set indeterminate(value: boolean) {
    const oldValue = this.indeterminate
    const newValue = Boolean(value)
    if (oldValue === newValue) return
    if (newValue) this.ensureInputState().indeterminate = true
    else if (this.inputState) {
      this.inputState.indeterminate = false
      this.releaseInputStateIfEmpty()
    }
    this.recordIndeterminateChange(oldValue, newValue)
  }

  get valueAsNumber(): number {
    if (this.type !== "number" && this.type !== "range") return Number.NaN
    return parseHTMLFloatingPointNumber(this.value) ?? Number.NaN
  }

  set valueAsNumber(value: number) {
    const number = Number(value)
    if (!Number.isFinite(number) && !Number.isNaN(number)) {
      throw new TypeError("valueAsNumber must be finite or NaN")
    }
    if (this.type !== "number" && this.type !== "range") {
      throw domError("InvalidStateError", "valueAsNumber does not apply to this input type")
    }
    this.value = Number.isNaN(number) ? "" : serializeHTMLNumber(number)
  }

  get defaultChecked(): boolean {
    return this.hasAttribute("checked")
  }

  set defaultChecked(value: boolean) {
    if (value) this.setAttribute("checked", "")
    else this.removeAttribute("checked")
  }

  get selectionStart(): number | null {
    return this.selectionSnapshot()?.start ?? null
  }

  set selectionStart(value: number | null) {
    assertSelectionApplies(this.selectionApplies())
    const current = this.selectionSnapshot()!
    const start = Number(value ?? 0)
    this.setSelectionRange(start, Math.max(start, current.end), current.direction)
  }

  get selectionEnd(): number | null {
    return this.selectionSnapshot()?.end ?? null
  }

  set selectionEnd(value: number | null) {
    assertSelectionApplies(this.selectionApplies())
    const current = this.selectionSnapshot()!
    this.setSelectionRange(current.start, Number(value ?? 0), current.direction)
  }

  get selectionDirection(): TextSelectionDirection | null {
    return this.selectionSnapshot()?.direction ?? null
  }

  set selectionDirection(value: TextSelectionDirection | null) {
    assertSelectionApplies(this.selectionApplies())
    const current = this.selectionSnapshot()!
    this.setSelectionRange(current.start, current.end, value ?? "none")
  }

  select(): void {
    assertSelectionApplies(this.selectionApplies())
    this.setSelectionRange(0, this.value.length)
  }

  setSelectionRange(
    start: number,
    end: number,
    direction: TextSelectionDirection = "none"
  ): void {
    assertSelectionApplies(this.selectionApplies())
    const previous = this.selectionSnapshot()!
    const next = textSelection(this.value.length, start, end, direction)
    if (sameTextSelection(previous, next)) return
    this.ensureInputState().selection = next
    this.recordSelectionChange(previous, next)
  }

  applyRangeKeyboardDefault(key: string): boolean {
    return applyRangeKeyboardDefault(this, key)
  }

  click(): void {
    if (this.disabled || disabledByAncestorFieldSet(this)) return
    const ownerDocument = this.ownerDocument!
    ownerDocument.transaction(() => {
      const activation = this.prepareActivation()
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true
      })
      if (!this.dispatchEvent(event)) {
        activation.rollback()
        return
      }
      if (!activation.changed()) return
      this.dispatchEvent(new Event("input", {bubbles: true, composed: true}))
      this.dispatchEvent(new Event("change", {bubbles: true}))
    })
  }

  override setAttribute(name: string, value: string): void {
    const attributeName = normalizeAttributeName(name)
    if (!attributeCanChangeLiveState(attributeName)) {
      super.setAttribute(name, value)
      return
    }
    this.ownerDocument!.transaction(() => {
      const oldValue = this.value
      const oldChecked = this.checked
      const oldSelection = this.selectionSnapshot()
      super.setAttribute(name, value)
      this.sanitizeDirtyValue()
      this.clampStoredSelection()
      this.recordEffectiveChanges(oldValue, oldChecked, oldSelection)
    })
  }

  override removeAttribute(name: string): void {
    const attributeName = normalizeAttributeName(name)
    if (!attributeCanChangeLiveState(attributeName)) {
      super.removeAttribute(name)
      return
    }
    this.ownerDocument!.transaction(() => {
      const oldValue = this.value
      const oldChecked = this.checked
      const oldSelection = this.selectionSnapshot()
      super.removeAttribute(name)
      this.sanitizeDirtyValue()
      this.clampStoredSelection()
      this.recordEffectiveChanges(oldValue, oldChecked, oldSelection)
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

  private prepareActivation(): Readonly<{changed(): boolean; rollback(): void}> {
    if (this.type === "checkbox") {
      const checked = this.checked
      const indeterminate = this.indeterminate
      this.indeterminate = false
      this.checked = !checked
      return Object.freeze({
        changed: () => this.checked !== checked || this.indeterminate !== indeterminate,
        rollback: () => {
          this.checked = checked
          this.indeterminate = indeterminate
        }
      })
    }
    if (this.type === "radio") {
      const group = this.radioGroup()
      const states = group.map(input => Object.freeze({input, checked: input.checked}))
      if (!this.checked) {
        for (const input of group) input.checked = input === this
      }
      return Object.freeze({
        changed: () => states.some(({input, checked}) => input.checked !== checked),
        rollback: () => {
          for (const {input, checked} of states) input.checked = checked
        }
      })
    }
    return Object.freeze({changed: () => false, rollback() {}})
  }

  private radioGroup(): readonly HTMLInputElement[] {
    const name = this.getAttribute("name")
    const radios = [...this.ownerDocument!.querySelectorAll('input[type="radio"]')]
      .filter((element): element is HTMLInputElement => element instanceof HTMLInputElement)
    if (name === null || name === "") return Object.freeze([this])
    return Object.freeze(radios.filter(input => input.getAttribute("name") === name))
  }

  private ensureInputState(): InputState {
    return this.inputState ??= {
      dirty: 0,
      value: "",
      checked: false,
      indeterminate: false,
      selection: null
    }
  }

  private sanitizeValue(value: string, type = this.type): string {
    if (type === "number") return parseHTMLFloatingPointNumber(value) === null ? "" : value
    if (type !== "range") return value
    const minimum = parseHTMLFloatingPointNumber(this.min) ?? 0
    const maximum = parseHTMLFloatingPointNumber(this.max) ?? 100
    if (maximum < minimum) return serializeHTMLNumber(minimum)
    const parsed = parseHTMLFloatingPointNumber(value)
    const numeric = parsed ?? minimum + (maximum - minimum) / 2
    const clamped = Math.max(minimum, Math.min(maximum, numeric))
    const stepSource = this.step
    if (stepSource.toLowerCase() === "any") return serializeHTMLNumber(clamped)
    const parsedStep = parseHTMLFloatingPointNumber(stepSource)
    const step = parsedStep !== null && parsedStep > 0 ? parsedStep : 1
    const base = parseHTMLFloatingPointNumber(this.min) ??
      parseHTMLFloatingPointNumber(this.defaultValue) ?? 0
    return serializeHTMLNumber(nearestStepValue(clamped, minimum, maximum, base, step))
  }

  private sanitizeDirtyValue(): void {
    if (!this.inputState || (this.inputState.dirty & VALUE_DIRTY) === 0) return
    this.inputState.value = this.sanitizeValue(this.inputState.value)
  }

  private selectionApplies(): boolean {
    return selectionInputTypes.has(this.type)
  }

  private selectionSnapshot(): TextSelection | null {
    if (!this.selectionApplies()) return null
    return this.inputState?.selection ?? EMPTY_TEXT_SELECTION
  }

  private clampStoredSelection(): void {
    const current = this.inputState?.selection
    if (current === null || current === undefined || !this.selectionApplies()) return
    this.inputState!.selection = textSelection(
      this.value.length,
      current.start,
      current.end,
      current.direction
    )
  }

  private releaseInputStateIfEmpty(): void {
    if (
      this.inputState?.dirty === 0 &&
      !this.inputState.indeterminate &&
      this.inputState.selection === null
    ) this.inputState = null
  }

  private recordEffectiveChanges(
    oldValue: string,
    oldChecked: boolean,
    oldSelection: TextSelection | null
  ): void {
    this.recordValueChange(oldValue, this.value)
    this.recordCheckedChange(oldChecked, this.checked)
    this.recordSelectionChange(oldSelection, this.selectionSnapshot())
  }

  private recordValueChange(oldValue: string, newValue: string): void {
    if (oldValue === newValue || !this.isConnected) return
    this.ownerDocument![recordInputStateChange](Object.freeze({
      type: "input",
      target: this,
      property: "value",
      oldValue,
      newValue
    }))
  }

  private recordCheckedChange(oldValue: boolean, newValue: boolean): void {
    if (oldValue === newValue || !this.isConnected) return
    this.ownerDocument![recordInputStateChange](Object.freeze({
      type: "input",
      target: this,
      property: "checked",
      oldValue,
      newValue
    }))
  }

  private recordIndeterminateChange(oldValue: boolean, newValue: boolean): void {
    if (oldValue === newValue || !this.isConnected) return
    this.ownerDocument![recordInputStateChange](Object.freeze({
      type: "input",
      target: this,
      property: "indeterminate",
      oldValue,
      newValue
    }))
  }

  private recordSelectionChange(
    oldValue: TextSelection | null,
    newValue: TextSelection | null
  ): void {
    if (
      oldValue === null ||
      newValue === null ||
      sameTextSelection(oldValue, newValue) ||
      !this.isConnected
    ) return
    this.ownerDocument![recordInputStateChange](Object.freeze({
      type: "input",
      target: this,
      property: "selection",
      oldValue,
      newValue
    }))
  }
}

function applyRangeKeyboardDefault(
  input: HTMLInputElement,
  key: string,
): boolean {
  if (input.type !== "range" || input.disabled || disabledByAncestorFieldSet(input)) return false
  const minimum = parseHTMLFloatingPointNumber(input.min) ?? 0
  const declaredMaximum = parseHTMLFloatingPointNumber(input.max) ?? 100
  const maximum = Math.max(minimum, declaredMaximum)
  const parsedStep = parseHTMLFloatingPointNumber(input.step)
  const step = parsedStep !== null && parsedStep > 0 ? parsedStep : 1
  const current = Number.isFinite(input.valueAsNumber)
    ? input.valueAsNumber
    : minimum + (maximum - minimum) / 2
  const requested = key === "ArrowUp" || key === "ArrowRight"
    ? current + step
    : key === "ArrowDown" || key === "ArrowLeft"
      ? current - step
      : key === "PageUp"
        ? current + step * 10
        : key === "PageDown"
          ? current - step * 10
          : key === "Home"
            ? minimum
            : key === "End"
              ? maximum
              : null
  if (requested === null) return false
  const previous = input.value
  input.valueAsNumber = requested
  if (input.value !== previous) {
    input.dispatchEvent(new Event("input", {bubbles: true, composed: true}))
    input.dispatchEvent(new Event("change", {bubbles: true}))
  }
  return true
}
