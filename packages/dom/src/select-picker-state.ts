import type {Document} from "./document.ts"
import {Event} from "./event.ts"
import type {HTMLSelectElement} from "./html-select-element.ts"
import type {HTMLOptionElement} from "./html-option-element.ts"
import type {Node} from "./node.ts"
import {domError} from "./internal/errors.ts"
import {recordSelectPickerStateChange} from "./internal/state-change.ts"

export type SelectPickerVisibilityState = "closed" | "open"

type DocumentSelectPickerState = {
  open: HTMLSelectElement | null
}

const documentStates = new WeakMap<Document, DocumentSelectPickerState>()

export function getSelectPickerVisibilityState(
  select: HTMLSelectElement,
): SelectPickerVisibilityState {
  return documentStates.get(select.ownerDocument!)?.open === select ? "open" : "closed"
}

export function readOpenSelectPicker(document: Document): HTMLSelectElement | null {
  const open = documentStates.get(document)?.open ?? null
  if (open !== null && (!open.isConnected || open.disabled)) {
    closeSelectPicker(open)
    return null
  }
  return open
}

export function openSelectPicker(select: HTMLSelectElement): void {
  if (!select.isConnected) throw domError("InvalidStateError", "Select picker requires a connected control")
  if (select.disabled) throw domError("InvalidStateError", "Disabled select cannot show a picker")
  if (select.multiple || select.size > 1) {
    throw domError("NotSupportedError", "Listbox select does not use the collapsed picker")
  }
  const document = select.ownerDocument!
  const state = documentStates.get(document) ?? {open: null}
  if (state.open === select) return
  document.transaction(() => {
    if (state.open !== null) publishOpen(state.open, true, false)
    state.open = select
    documentStates.set(document, state)
    publishOpen(select, false, true)
    select.focus()
  })
}

export function closeSelectPicker(select: HTMLSelectElement): void {
  const document = select.ownerDocument!
  const state = documentStates.get(document)
  if (state?.open !== select) return
  document.transaction(() => {
    state.open = null
    documentStates.delete(document)
    publishOpen(select, true, false)
  })
}

export function closeSelectPickerOutside(
  document: Document,
  target: import("./element.ts").Element | null,
): boolean {
  const open = readOpenSelectPicker(document)
  if (open === null || target !== null && open.contains(target)) return false
  closeSelectPicker(open)
  return true
}

export function closeSelectPickersInSubtree(root: Node): void {
  const document = root.nodeType === 9
    ? root as unknown as Document
    : root.ownerDocument
  const open = document === null ? null : documentStates.get(document)?.open ?? null
  if (open !== null && root.contains(open)) closeSelectPicker(open)
}

export function chooseSelectPickerOption(
  select: HTMLSelectElement,
  option: HTMLOptionElement,
): boolean {
  const options = [...select.options]
  const index = options.indexOf(option)
  if (index < 0 || option.disabled || select.disabled) return false
  const changed = select.selectedIndex !== index
  select.ownerDocument!.transaction(() => {
    if (changed) {
      select.selectedIndex = index
      select.dispatchEvent(new Event("input", {bubbles: true, composed: true}))
      select.dispatchEvent(new Event("change", {bubbles: true}))
    }
    closeSelectPicker(select)
    select.focus()
  })
  return true
}

export function applySelectKeyboardDefault(
  select: HTMLSelectElement,
  key: string,
): boolean {
  if (select.disabled || select.multiple || select.size > 1) return false
  if (key === "Escape") {
    if (getSelectPickerVisibilityState(select) === "closed") return false
    closeSelectPicker(select)
    select.focus()
    return true
  }
  if (key === "Enter" || key === " " || key === "Spacebar") {
    if (getSelectPickerVisibilityState(select) === "open") closeSelectPicker(select)
    else openSelectPicker(select)
    return true
  }
  const options = [...select.options]
  if (options.length === 0) return false
  const direction = key === "ArrowDown" || key === "ArrowRight"
    ? 1
    : key === "ArrowUp" || key === "ArrowLeft"
      ? -1
      : 0
  let index = select.selectedIndex
  if (key === "Home") index = firstEnabled(options)
  else if (key === "End") index = lastEnabled(options)
  else if (direction !== 0) index = nextEnabled(options, index, direction)
  else return false
  if (index < 0 || index === select.selectedIndex) return true
  select.ownerDocument!.transaction(() => {
    select.selectedIndex = index
    select.dispatchEvent(new Event("input", {bubbles: true, composed: true}))
    select.dispatchEvent(new Event("change", {bubbles: true}))
  })
  return true
}

const firstEnabled = (options: readonly HTMLOptionElement[]): number =>
  options.findIndex(option => !option.disabled)

const lastEnabled = (options: readonly HTMLOptionElement[]): number => {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]!.disabled) return index
  }
  return -1
}

const nextEnabled = (
  options: readonly HTMLOptionElement[],
  selectedIndex: number,
  direction: -1 | 1,
): number => {
  for (
    let index = selectedIndex < 0 ? direction > 0 ? 0 : options.length - 1 : selectedIndex + direction;
    index >= 0 && index < options.length;
    index += direction
  ) {
    if (!options[index]!.disabled) return index
  }
  return selectedIndex
}

const publishOpen = (
  select: HTMLSelectElement,
  oldValue: boolean,
  newValue: boolean,
): void => {
  if (oldValue === newValue || !select.isConnected) return
  select.ownerDocument![recordSelectPickerStateChange](Object.freeze({
    type: "select-picker",
    target: select,
    property: "open",
    oldValue,
    newValue,
  }))
}
