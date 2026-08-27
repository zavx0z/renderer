import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"
import {
  getOptionSelectedness,
  normalizeSelectSelection,
  selectOption,
  setOptionSelectedness
} from "./internal/select.ts"
import {recordOptionStateChange} from "./internal/state-change.ts"

type OptionState = {
  dirty: boolean
  selected: boolean
}

type SelectionOwner = HTMLElement & {
  [normalizeSelectSelection](publish: boolean, resetFallback?: boolean): void
  [selectOption](option: HTMLOptionElement, selected: boolean): void
}

function normalizeAttributeName(name: string): string {
  return String(name).replace(/[A-Z]/g, character => character.toLowerCase())
}

function optionText(option: HTMLOptionElement): string {
  return option.textContent.trim().replace(/[\t\n\f\r ]+/g, " ")
}

export class HTMLOptionElement extends HTMLElement {
  private optionState: OptionState | null = null

  constructor(ownerDocument: Document) {
    super(ownerDocument, "option")
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled")
  }

  set disabled(value: boolean) {
    if (value) this.setAttribute("disabled", "")
    else this.removeAttribute("disabled")
  }

  get label(): string {
    const label = this.getAttribute("label")
    return label ? label : optionText(this)
  }

  set label(value: string) {
    this.setAttribute("label", value)
  }

  get value(): string {
    return this.getAttribute("value") ?? optionText(this)
  }

  set value(value: string) {
    this.setAttribute("value", value)
  }

  get selected(): boolean {
    this.selectionOwner()?.[normalizeSelectSelection](false)
    return this[getOptionSelectedness]()
  }

  set selected(value: boolean) {
    const selected = Boolean(value)
    const owner = this.selectionOwner()
    if (owner) owner[selectOption](this, selected)
    else this[setOptionSelectedness](selected, true, true)
  }

  get defaultSelected(): boolean {
    return this.hasAttribute("selected")
  }

  set defaultSelected(value: boolean) {
    if (value) this.setAttribute("selected", "")
    else this.removeAttribute("selected")
  }

  override setAttribute(name: string, value: string): void {
    if (normalizeAttributeName(name) !== "selected") {
      super.setAttribute(name, value)
      return
    }
    this.ownerDocument!.transaction(() => {
      const followsDefault = !this.optionState?.dirty
      const oldSelected = this[getOptionSelectedness]()
      super.setAttribute(name, value)
      if (!followsDefault) return
      const state = this.optionState ??= {dirty: false, selected: oldSelected}
      state.selected = oldSelected
      this[setOptionSelectedness](true, false, true)
      this.selectionOwner()?.[normalizeSelectSelection](true, true)
    })
  }

  override removeAttribute(name: string): void {
    if (normalizeAttributeName(name) !== "selected") {
      super.removeAttribute(name)
      return
    }
    this.ownerDocument!.transaction(() => {
      const followsDefault = !this.optionState?.dirty
      const oldSelected = this[getOptionSelectedness]()
      super.removeAttribute(name)
      if (!followsDefault) return
      const state = this.optionState ??= {dirty: false, selected: oldSelected}
      state.selected = oldSelected
      this[setOptionSelectedness](false, false, true)
      this.selectionOwner()?.[normalizeSelectSelection](true, true)
    })
  }

  [getOptionSelectedness](): boolean {
    return this.optionState?.selected ?? this.defaultSelected
  }

  [setOptionSelectedness](selected: boolean, dirty: boolean, publish: boolean): void {
    const oldValue = this[getOptionSelectedness]()
    const defaultSelected = this.defaultSelected
    if (oldValue === selected && !dirty) {
      if (this.optionState && !this.optionState.dirty && selected === defaultSelected) {
        this.optionState = null
      }
      return
    }
    const state = this.optionState ??= {dirty: false, selected: oldValue}
    state.selected = selected
    if (dirty) state.dirty = true
    if (!state.dirty && state.selected === defaultSelected) this.optionState = null
    if (!publish || oldValue === selected || !this.isConnected) return
    this.ownerDocument![recordOptionStateChange](Object.freeze({
      type: "option",
      target: this,
      property: "selected",
      oldValue,
      newValue: selected
    }))
  }

  private selectionOwner(): SelectionOwner | null {
    for (let current = this.parentElement; current; current = current.parentElement) {
      if (current.localName !== "select") continue
      return typeof (current as Partial<SelectionOwner>)[selectOption] === "function"
        ? current as SelectionOwner
        : null
    }
    return null
  }
}
