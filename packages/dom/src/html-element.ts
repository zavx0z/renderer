import type {Document} from "./document.ts"
import {Element} from "./element.ts"
import {domError} from "./internal/errors.ts"
import {changeFocus, isProgrammaticallyFocusable} from "./internal/focus.ts"
import {
  hidePopover,
  popoverAttributeChanged,
  readPopoverSource,
  readPopoverVisibilityState,
  reflectedPopoverValue,
  showPopover,
  togglePopover
} from "./internal/popover.ts"
import {recordScrollStateChange} from "./internal/state-change.ts"
import {parseHTMLInteger, toLong} from "./internal/web-idl.ts"
import {
  getPopoverVisibilityState
} from "./popover-state.ts"
import {getPopoverSource} from "./popover-state.ts"
import type {
  PopoverValue,
  PopoverVisibilityState
} from "./popover-state.ts"

export type ScrollBehavior = "auto" | "instant"

export type ScrollToOptions = Readonly<{
  behavior?: ScrollBehavior
  left?: number
  top?: number
}>

type ScrollOffsets = Readonly<{
  left: number
  top: number
}>

const scrollOffsets = new WeakMap<HTMLElement, ScrollOffsets>()

function normalizeRequestedOffset(value: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

function validateScrollBehavior(behavior: unknown): void {
  if (behavior === undefined || behavior === "auto" || behavior === "instant") return
  if (behavior === "smooth") {
    throw domError("NotSupportedError", "Smooth scrolling is not implemented")
  }
  throw new TypeError(`Unsupported scroll behavior ${String(behavior)}`)
}

function scrollOptions(value: ScrollToOptions | null | undefined): ScrollToOptions {
  if (value === null || value === undefined) return {}
  if (typeof value !== "object") throw new TypeError("Scroll options must be an object")
  return value
}

export type FocusOptions = Readonly<{
  preventScroll?: boolean
  focusVisible?: boolean
}>

export type ShowPopoverOptions = Readonly<{
  source?: HTMLElement
}>

export type TogglePopoverOptions = ShowPopoverOptions & Readonly<{
  force?: boolean
}>

export class HTMLElement extends Element {
  constructor(ownerDocument: Document, localName = "unknown") {
    super(ownerDocument, localName)
  }

  get title(): string {
    return this.getAttribute("title") ?? ""
  }

  set title(value: string) {
    this.setAttribute("title", value)
  }

  get hidden(): boolean {
    return this.hasAttribute("hidden")
  }

  set hidden(value: boolean) {
    if (value) this.setAttribute("hidden", "")
    else this.removeAttribute("hidden")
  }

  get popover(): PopoverValue {
    return reflectedPopoverValue(this.getAttribute("popover"))
  }

  set popover(value: string | null) {
    if (value === null) this.removeAttribute("popover")
    else this.setAttribute("popover", String(value))
  }

  get tabIndex(): number {
    const attribute = this.getAttribute("tabindex")
    if (attribute !== null) {
      const parsed = parseHTMLInteger(attribute)
      if (parsed !== null) return parsed
    }
    return this.defaultTabIndex
  }

  set tabIndex(value: number) {
    this.setAttribute("tabindex", String(toLong(value)))
  }

  get scrollLeft(): number {
    return scrollOffsets.get(this)?.left ?? 0
  }

  set scrollLeft(value: number) {
    this.setRequestedScroll(normalizeRequestedOffset(value), this.scrollTop)
  }

  get scrollTop(): number {
    return scrollOffsets.get(this)?.top ?? 0
  }

  set scrollTop(value: number) {
    this.setRequestedScroll(this.scrollLeft, normalizeRequestedOffset(value))
  }

  scrollTo(options?: ScrollToOptions): void
  scrollTo(x: number, y: number): void
  scrollTo(optionsOrX: ScrollToOptions | number = {}, y?: number): void {
    if (typeof optionsOrX === "number") {
      if (y === undefined) throw new TypeError("scrollTo(x, y) requires two coordinates")
      this.setRequestedScroll(
        normalizeRequestedOffset(optionsOrX),
        normalizeRequestedOffset(y)
      )
      return
    }
    const options = scrollOptions(optionsOrX)
    validateScrollBehavior(options.behavior)
    this.setRequestedScroll(
      options.left === undefined ? this.scrollLeft : normalizeRequestedOffset(options.left),
      options.top === undefined ? this.scrollTop : normalizeRequestedOffset(options.top)
    )
  }

  scrollBy(options?: ScrollToOptions): void
  scrollBy(x: number, y: number): void
  scrollBy(optionsOrX: ScrollToOptions | number = {}, y?: number): void {
    if (typeof optionsOrX === "number") {
      if (y === undefined) throw new TypeError("scrollBy(x, y) requires two coordinates")
      this.setRequestedScroll(
        normalizeRequestedOffset(this.scrollLeft + normalizeRequestedDelta(optionsOrX)),
        normalizeRequestedOffset(this.scrollTop + normalizeRequestedDelta(y))
      )
      return
    }
    const options = scrollOptions(optionsOrX)
    validateScrollBehavior(options.behavior)
    this.setRequestedScroll(
      normalizeRequestedOffset(this.scrollLeft + normalizeRequestedDelta(options.left ?? 0)),
      normalizeRequestedOffset(this.scrollTop + normalizeRequestedDelta(options.top ?? 0))
    )
  }

  focus(_options: FocusOptions = {}): void {
    if (!this[isProgrammaticallyFocusable]()) return
    this.ownerDocument?.[changeFocus](this)
  }

  blur(): void {
    const document = this.ownerDocument
    if (document?.activeElement === this) document[changeFocus](null)
  }

  showPopover(options: ShowPopoverOptions | null = {}): void {
    const normalized = normalizePopoverOptions(options)
    showPopover(this, popoverSource(normalized))
  }

  hidePopover(): void {
    hidePopover(this)
  }

  togglePopover(options: TogglePopoverOptions | boolean | null = {}): boolean {
    if (typeof options === "boolean") return togglePopover(this, options, null)
    const normalized = normalizePopoverOptions(options)
    const force = Object.prototype.hasOwnProperty.call(normalized, "force")
      ? Boolean((normalized as TogglePopoverOptions).force)
      : null
    return togglePopover(this, force, popoverSource(normalized))
  }

  [getPopoverVisibilityState](): PopoverVisibilityState {
    return readPopoverVisibilityState(this)
  }

  [getPopoverSource](): HTMLElement | null {
    return readPopoverSource(this)
  }

  override setAttribute(name: string, value: string): void {
    if (normalizeAttributeName(name) !== "popover") {
      super.setAttribute(name, value)
      return
    }
    const oldValue = this.getAttribute("popover")
    this.ownerDocument!.transaction(() => {
      super.setAttribute(name, value)
      popoverAttributeChanged(this, oldValue, this.getAttribute("popover"))
    })
  }

  override removeAttribute(name: string): void {
    if (normalizeAttributeName(name) !== "popover") {
      super.removeAttribute(name)
      return
    }
    const oldValue = this.getAttribute("popover")
    if (oldValue === null) return
    this.ownerDocument!.transaction(() => {
      super.removeAttribute(name)
      popoverAttributeChanged(this, oldValue, null)
    })
  }

  [isProgrammaticallyFocusable](): boolean {
    if (!this.isConnected) return false
    for (let current: HTMLElement | null = this; current !== null;) {
      if (current.hidden) return false
      current = current.parentElement instanceof HTMLElement ? current.parentElement : null
    }
    const explicitTabIndex = this.hasAttribute("tabindex") &&
      parseHTMLInteger(this.getAttribute("tabindex") ?? "") !== null
    return explicitTabIndex || this.defaultTabIndex >= 0
  }

  protected get defaultTabIndex(): number {
    return -1
  }

  private setRequestedScroll(left: number, top: number): void {
    const oldScrollLeft = this.scrollLeft
    const oldScrollTop = this.scrollTop
    if (left === oldScrollLeft && top === oldScrollTop) return
    if (left === 0 && top === 0) scrollOffsets.delete(this)
    else scrollOffsets.set(this, Object.freeze({left, top}))

    const document = this.ownerDocument
    if (!document || !this.isConnected) return
    document[recordScrollStateChange](Object.freeze({
      type: "scroll",
      target: this,
      oldScrollLeft,
      oldScrollTop,
      scrollLeft: left,
      scrollTop: top
    }))
  }
}

function normalizeRequestedDelta(value: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalizeAttributeName(name: string): string {
  return String(name).replace(/[A-Z]/g, character => character.toLowerCase())
}

function normalizePopoverOptions(
  options: ShowPopoverOptions | TogglePopoverOptions | null
): ShowPopoverOptions | TogglePopoverOptions {
  if (options === null || options === undefined) return {}
  if (typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Popover options must be an object")
  }
  return options
}

function popoverSource(options: ShowPopoverOptions): HTMLElement | null {
  if (options.source === undefined) return null
  if (!(options.source instanceof HTMLElement)) {
    throw new TypeError("Popover source must be an HTMLElement from this DOM realm")
  }
  return options.source
}
