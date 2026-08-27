import type {Document} from "./document.ts"
import {Element} from "./element.ts"
import {HTMLElement} from "./html-element.ts"
import {HTMLOptionElement} from "./html-option-element.ts"
import {isProgrammaticallyFocusable} from "./internal/focus.ts"
import {disabledByAncestorFieldSet} from "./internal/disabled.ts"
import {
  getOptionSelectedness,
  normalizeSelectSelection,
  selectOption,
  setOptionSelectedness
} from "./internal/select.ts"
import {parseHTMLInteger, toLong} from "./internal/web-idl.ts"
import {createStaticNodeList} from "./node-list.ts"
import type {NodeList} from "./node-list.ts"

type SelectState = {
  allowEmpty: boolean
  options: readonly HTMLOptionElement[]
}

const selectStates = new WeakMap<HTMLSelectElement, SelectState>()

function normalizeAttributeName(name: string): string {
  return String(name).replace(/[A-Z]/g, character => character.toLowerCase())
}

function sameOptions(left: readonly HTMLOptionElement[], right: readonly HTMLOptionElement[]): boolean {
  return left.length === right.length && left.every((option, index) => option === right[index])
}

export class HTMLSelectElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "select")
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled")
  }

  set disabled(value: boolean) {
    if (value) this.setAttribute("disabled", "")
    else this.removeAttribute("disabled")
  }

  get multiple(): boolean {
    return this.hasAttribute("multiple")
  }

  set multiple(value: boolean) {
    if (value) this.setAttribute("multiple", "")
    else this.removeAttribute("multiple")
  }

  get size(): number {
    const parsed = parseHTMLInteger(this.getAttribute("size") ?? "")
    return parsed !== null && parsed >= 0 ? parsed : 0
  }

  set size(value: number) {
    this.setAttribute("size", String(toLong(value, 32, true)))
  }

  get options(): NodeList<HTMLOptionElement> {
    const options = this.optionSnapshot()
    this.normalizeOptions(options, false)
    return createStaticNodeList(options)
  }

  get selectedIndex(): number {
    const options = this.optionSnapshot()
    this.normalizeOptions(options, false)
    return options.findIndex(option => option[getOptionSelectedness]())
  }

  set selectedIndex(value: number) {
    this.ownerDocument!.transaction(() => {
      const options = this.optionSnapshot()
      const state = this.synchronizeOptions(options)
      const index = toLong(value)
      const selected = options[index] ?? null
      for (const option of options) {
        option[setOptionSelectedness](option === selected, option === selected, true)
      }
      state.allowEmpty = selected === null
    })
  }

  get value(): string {
    const options = this.optionSnapshot()
    this.normalizeOptions(options, false)
    return options.find(option => option[getOptionSelectedness]())?.value ?? ""
  }

  set value(value: string) {
    const requested = String(value)
    this.ownerDocument!.transaction(() => {
      const options = this.optionSnapshot()
      const state = this.synchronizeOptions(options)
      const selected = options.find(option => option.value === requested) ?? null
      for (const option of options) {
        option[setOptionSelectedness](option === selected, option === selected, true)
      }
      state.allowEmpty = selected === null
    })
  }

  override setAttribute(name: string, value: string): void {
    if (normalizeAttributeName(name) !== "multiple") {
      super.setAttribute(name, value)
      return
    }
    this.ownerDocument!.transaction(() => {
      const wasMultiple = this.multiple
      super.setAttribute(name, value)
      if (wasMultiple || !this.multiple) return
      this[normalizeSelectSelection](true, true)
    })
  }

  override removeAttribute(name: string): void {
    if (normalizeAttributeName(name) !== "multiple") {
      super.removeAttribute(name)
      return
    }
    this.ownerDocument!.transaction(() => {
      const wasMultiple = this.multiple
      super.removeAttribute(name)
      if (!wasMultiple || this.multiple) return
      this[normalizeSelectSelection](true, true)
    })
  }

  [normalizeSelectSelection](publish: boolean, resetFallback = false): void {
    const options = this.optionSnapshot()
    const state = this.synchronizeOptions(options)
    if (resetFallback) state.allowEmpty = false
    this.normalizeOptions(options, publish)
  }

  [selectOption](option: HTMLOptionElement, selected: boolean): void {
    this.ownerDocument!.transaction(() => {
      const options = this.optionSnapshot()
      const state = this.synchronizeOptions(options)
      if (!options.includes(option)) {
        option[setOptionSelectedness](selected, true, true)
        return
      }
      if (selected && !this.multiple) {
        for (const candidate of options) {
          candidate[setOptionSelectedness](candidate === option, candidate === option, true)
        }
        state.allowEmpty = false
        return
      }
      option[setOptionSelectedness](selected, true, true)
      if (!selected && !this.multiple && !options.some(candidate => candidate[getOptionSelectedness]())) {
        state.allowEmpty = true
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

  private optionSnapshot(): HTMLOptionElement[] {
    const options: HTMLOptionElement[] = []
    const visit = (element: Element): void => {
      for (const child of element.children) {
        if (child instanceof HTMLOptionElement) {
          options.push(child)
          continue
        }
        if (child.localName !== "select") visit(child)
      }
    }
    visit(this)
    return options
  }

  private synchronizeOptions(options: readonly HTMLOptionElement[]): SelectState {
    const current = selectStates.get(this)
    if (!current) {
      const state = {allowEmpty: false, options: Object.freeze([...options])}
      selectStates.set(this, state)
      return state
    }
    if (!sameOptions(current.options, options)) {
      current.allowEmpty = false
      current.options = Object.freeze([...options])
    }
    return current
  }

  private normalizeOptions(options: readonly HTMLOptionElement[], publish: boolean): void {
    const state = this.synchronizeOptions(options)
    if (this.multiple) return
    const selected = options.filter(option => option[getOptionSelectedness]())
    if (selected.length > 1) {
      const retained = selected.at(-1)!
      for (const option of selected) {
        if (option !== retained) option[setOptionSelectedness](false, false, publish)
      }
      state.allowEmpty = false
      return
    }
    if (selected.length === 0 && !state.allowEmpty) {
      const fallback = options.find(option => !option.disabled)
      fallback?.[setOptionSelectedness](true, false, publish)
    }
  }
}
