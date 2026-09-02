import type {Document} from "../document.ts"
import type {HTMLElement} from "../html-element.ts"
import type {Node} from "../node.ts"
import type {
  PopoverValue,
  PopoverVisibilityState
} from "../popover-state.ts"
import {ToggleEvent} from "../toggle-event.ts"
import {domError} from "./errors.ts"
import {recordPopoverStateChange} from "./state-change.ts"

type OpenPopoverState = Readonly<{
  mode: Exclude<PopoverValue, null>
  source: HTMLElement | null
  focusReturn: HTMLElement | null
}>

type DocumentPopoverState = {
  autoStack: HTMLElement[]
  hidingCount: number
  openCount: number
  showing: boolean
}

type ToggleState = "closed" | "open"

type ToggleTaskTracker = Readonly<{
  oldState: ToggleState
  revision: number
}>

const documentStates = new WeakMap<Document, DocumentPopoverState>()
const hidingPopovers = new WeakSet<HTMLElement>()
const openPopovers = new WeakMap<HTMLElement, OpenPopoverState>()
const toggleTaskTrackers = new WeakMap<HTMLElement, ToggleTaskTracker>()
let toggleTaskRevision = 0

export function reflectedPopoverValue(value: string | null): PopoverValue {
  if (value === null) return null
  const normalized = value.toLowerCase()
  if (normalized === "" || normalized === "auto") return "auto"
  if (normalized === "manual") return "manual"
  return "manual"
}

export function readPopoverVisibilityState(element: HTMLElement): PopoverVisibilityState {
  return openPopovers.has(element) ? "showing" : "hidden"
}

export function readPopoverSource(element: HTMLElement): HTMLElement | null {
  return openPopovers.get(element)?.source ?? null
}

export function showPopover(element: HTMLElement, source: HTMLElement | null): void {
  const document = element.ownerDocument!
  document.transaction(() => showPopoverSteps(element, source))
}

export function hidePopover(element: HTMLElement): void {
  const document = element.ownerDocument!
  document.transaction(() => hidePopoverSteps(element, true, true, null, false, true))
}

export function togglePopover(
  element: HTMLElement,
  force: boolean | null,
  source: HTMLElement | null
): boolean {
  const document = element.ownerDocument!
  return document.transaction(() => {
    const showing = openPopovers.has(element)
    if (showing && (force === null || force === false)) {
      hidePopoverSteps(element, true, true, null, false, true)
    } else if (force === null || force === true) {
      showPopoverSteps(element, source)
    } else {
      checkPopoverValidity(element, showing)
    }
    return openPopovers.has(element)
  })
}

export function popoverAttributeChanged(
  element: HTMLElement,
  oldValue: string | null,
  newValue: string | null
): void {
  if (!openPopovers.has(element)) return
  if (reflectedPopoverValue(oldValue) === reflectedPopoverValue(newValue)) return
  hidePopoverSteps(element, true, false, null, true, false)
}

export function lightDismissPopovers(
  document: Document,
  target: import("../element.ts").Element | null
): boolean {
  const documentState = documentStates.get(document)
  if (!documentState || documentState.autoStack.length === 0) return false
  let retainedIndex = -1
  if (target !== null) {
    for (let index = documentState.autoStack.length - 1; index >= 0; index -= 1) {
      const candidate = documentState.autoStack[index]
      const source = candidate ? openPopovers.get(candidate)?.source ?? null : null
      if (
        candidate &&
        (candidate.contains(target) || source?.contains(target) === true)
      ) {
        retainedIndex = index
        break
      }
    }
  }
  const popovers = documentState.autoStack.slice(retainedIndex + 1).reverse()
  if (popovers.length === 0) return false
  document.transaction(() => {
    for (let index = 0; index < popovers.length; index += 1) {
      hidePopoverSteps(
        popovers[index]!,
        true,
        false,
        null,
        false,
        index === popovers.length - 1,
      )
    }
  })
  return true
}

export function dismissTopmostAutoPopover(document: Document): boolean {
  const popover = documentStates.get(document)?.autoStack.at(-1) ?? null
  if (popover === null) return false
  document.transaction(() => {
    hidePopoverSteps(popover, true, false, null, false, true)
  })
  return true
}

export function closePopoversInSubtree(root: Node): void {
  const document = root.nodeType === 9
    ? root as unknown as Document
    : root.ownerDocument
  if (document === null || (documentStates.get(document)?.openCount ?? 0) === 0) return
  const visit = (node: Node): void => {
    if (node.nodeType === 1) {
      const element = node as HTMLElement
      if (openPopovers.has(element)) closePopoverWithoutEvents(element)
    }
    for (const child of node.childNodes) visit(child)
  }
  visit(root)
}

function showPopoverSteps(element: HTMLElement, source: HTMLElement | null): void {
  const document = element.ownerDocument!
  const currentDocumentState = documentStates.get(document)
  if (currentDocumentState?.showing || (currentDocumentState?.hidingCount ?? 0) !== 0) {
    throw domError("InvalidStateError", "A popover cannot be shown during another popover transition")
  }
  if (!validityResult(element, false, true)) return
  const documentState = currentDocumentState ?? ensureDocumentState(document)

  documentState.showing = true
  try {
    const beforeToggle = new ToggleEvent("beforetoggle", {
      cancelable: true,
      oldState: "closed",
      newState: "open",
      source
    })
    if (!element.dispatchEvent(beforeToggle)) return
    if (!validityResult(element, false, true)) return

    const mode = reflectedPopoverValue(element.getAttribute("popover"))!
    if (mode === "auto") {
      hideUnrelatedAutoPopovers(documentState, element, source)
      if (!validityResult(element, false, true)) return
    }

    const active = document.activeElement
    const focusReturn = active !== null && typeof (active as Partial<HTMLElement>).focus === "function"
      ? active as HTMLElement
      : null
    openPopovers.set(element, Object.freeze({
      mode,
      source,
      focusReturn,
    }))
    documentState.openCount += 1
    if (mode === "auto") documentState.autoStack.push(element)
    publishOpenState(element, false, true)
    queueToggleEvent(element, "closed", "open", source)
  } finally {
    documentState.showing = false
    releaseDocumentState(document, documentState)
  }
}

function hidePopoverSteps(
  element: HTMLElement,
  fireEvents: boolean,
  throwExceptions: boolean,
  source: HTMLElement | null,
  attributeChange: boolean,
  restoreFocus: boolean
): void {
  if (!attributeChange && !validityResult(element, true, throwExceptions)) return
  if (attributeChange && !openPopovers.has(element)) return

  const document = element.ownerDocument!
  const documentState = ensureDocumentState(document)
  const nestedHide = hidingPopovers.has(element)
  if (!nestedHide) hidingPopovers.add(element)
  if (nestedHide) fireEvents = false
  documentState.hidingCount += 1

  try {
    if (fireEvents) {
      element.dispatchEvent(new ToggleEvent("beforetoggle", {
        oldState: "open",
        newState: "closed",
        source
      }))
      if (attributeChange) {
        if (!openPopovers.has(element)) return
      } else if (!validityResult(element, true, throwExceptions)) {
        return
      }
    }

    if (!openPopovers.has(element)) return
    closePopoverState(element, restoreFocus)
    if (fireEvents) queueToggleEvent(element, "open", "closed", source)
  } finally {
    documentState.hidingCount -= 1
    if (!nestedHide) hidingPopovers.delete(element)
    releaseDocumentState(document, documentState)
  }
}

function closePopoverWithoutEvents(element: HTMLElement): void {
  if (!openPopovers.has(element)) return
  closePopoverState(element, false)
}

function closePopoverState(element: HTMLElement, restoreFocus: boolean): void {
  const openState = openPopovers.get(element)
  if (!openState) return
  openPopovers.delete(element)
  const document = element.ownerDocument!
  const documentState = documentStates.get(document)
  if (documentState) documentState.openCount = Math.max(0, documentState.openCount - 1)
  if (openState.mode === "auto") {
    if (documentState) {
      documentState.autoStack = documentState.autoStack.filter(candidate => candidate !== element)
    }
  }
  if (documentState) releaseDocumentState(document, documentState)
  publishOpenState(element, true, false)
  if (restoreFocus) openState.focusReturn?.focus({preventScroll: true})
}

function checkPopoverValidity(element: HTMLElement, expectedToBeShowing: boolean): boolean {
  if (reflectedPopoverValue(element.getAttribute("popover")) === null) {
    throw domError("NotSupportedError", "The element does not have a popover attribute")
  }
  if (openPopovers.has(element) !== expectedToBeShowing) return false
  if (!element.isConnected) {
    throw domError("InvalidStateError", "A popover must be connected to its Document")
  }
  return true
}

function validityResult(
  element: HTMLElement,
  expectedToBeShowing: boolean,
  throwExceptions: boolean
): boolean {
  try {
    return checkPopoverValidity(element, expectedToBeShowing)
  } catch (error) {
    if (throwExceptions) throw error
    return false
  }
}

function ensureDocumentState(document: Document): DocumentPopoverState {
  const current = documentStates.get(document)
  if (current) return current
  const state: DocumentPopoverState = {
    autoStack: [],
    hidingCount: 0,
    openCount: 0,
    showing: false
  }
  documentStates.set(document, state)
  return state
}

function releaseDocumentState(document: Document, state: DocumentPopoverState): void {
  if (state.openCount === 0 && state.autoStack.length === 0 && state.hidingCount === 0 && !state.showing) {
    documentStates.delete(document)
  }
}

function hideUnrelatedAutoPopovers(
  documentState: DocumentPopoverState,
  element: HTMLElement,
  source: HTMLElement | null
): void {
  let ancestorIndex = -1
  for (let index = documentState.autoStack.length - 1; index >= 0; index -= 1) {
    const candidate = documentState.autoStack[index]
    if (candidate && (candidate.contains(element) || (source !== null && candidate.contains(source)))) {
      ancestorIndex = index
      break
    }
  }

  const popoversToHide = documentState.autoStack.slice(ancestorIndex + 1).reverse()
  for (const popover of popoversToHide) {
    hidePopoverSteps(popover, true, false, null, false, false)
  }
}

function publishOpenState(element: HTMLElement, oldValue: boolean, newValue: boolean): void {
  if (oldValue === newValue || !element.isConnected) return
  element.ownerDocument![recordPopoverStateChange](Object.freeze({
    type: "popover",
    target: element,
    property: "open",
    oldValue,
    newValue
  }))
}

function queueToggleEvent(
  element: HTMLElement,
  oldState: ToggleState,
  newState: ToggleState,
  source: HTMLElement | null
): void {
  const previous = toggleTaskTrackers.get(element)
  const revision = ++toggleTaskRevision
  const tracker = Object.freeze({
    oldState: previous?.oldState ?? oldState,
    revision
  })
  toggleTaskTrackers.set(element, tracker)

  setTimeout(() => {
    if (toggleTaskTrackers.get(element)?.revision !== revision) return
    toggleTaskTrackers.delete(element)
    element.dispatchEvent(new ToggleEvent("toggle", {
      oldState: tracker.oldState,
      newState,
      source
    }))
  }, 0)
}
