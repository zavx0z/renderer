import type {Document} from "./document.ts"
import type {Element} from "./element.ts"
import {domError} from "./internal/errors.ts"
import {toLong} from "./internal/web-idl.ts"
import {PointerEvent} from "./pointer-event.ts"

type PointerCaptureEntry = {
  active: boolean
  override: Element | null
  pending: Element | null
}

type DocumentPointerCaptureState = {
  pointers: Map<number, PointerCaptureEntry>
}

const documentStates = new WeakMap<Document, DocumentPointerCaptureState>()

const pointerId = (value: number): number => toLong(value)

const stateFor = (document: Document): DocumentPointerCaptureState => {
  const current = documentStates.get(document)
  if (current !== undefined) return current
  const state: DocumentPointerCaptureState = {pointers: new Map()}
  documentStates.set(document, state)
  return state
}

const connectedTarget = (target: Element | null, document: Document): Element | null =>
  target !== null && target.ownerDocument === document && target.isConnected ? target : null

const captureEvent = (type: "gotpointercapture" | "lostpointercapture", id: number): PointerEvent =>
  new PointerEvent(type, {
    bubbles: true,
    composed: true,
    pointerId: id,
  })

const releaseStateIfEmpty = (
  document: Document,
  state: DocumentPointerCaptureState,
): void => {
  if (state.pointers.size === 0) documentStates.delete(document)
}

/** Marks a host pointer active before its semantic `pointerdown` dispatch. */
export function beginDocumentPointer(document: Document, value: number): void {
  const id = pointerId(value)
  const state = stateFor(document)
  const previous = state.pointers.get(id)
  if (previous?.active) endDocumentPointer(document, id)
  state.pointers.set(id, {active: true, override: null, pending: null})
}

/** Processes the pending override and returns the exact semantic event target. */
export function readDocumentPointerCaptureTarget(
  document: Document,
  value: number,
): Element | null {
  const id = pointerId(value)
  const entry = documentStates.get(document)?.pointers.get(id)
  if (entry === undefined || !entry.active) return null
  processPending(document, id, entry)
  return entry.override
}

/** Runs implicit release after `pointerup` or `pointercancel`. */
export function endDocumentPointer(document: Document, value: number): void {
  const id = pointerId(value)
  const state = documentStates.get(document)
  const entry = state?.pointers.get(id)
  if (state === undefined || entry === undefined) return
  if (entry.active) processPending(document, id, entry)
  const previous = connectedTarget(entry.override, document) ?? entry.override
  entry.active = false
  entry.override = null
  entry.pending = null
  state.pointers.delete(id)
  if (previous !== null) previous.dispatchEvent(captureEvent("lostpointercapture", id))
  releaseStateIfEmpty(document, state)
}

/** Releases every host pointer owned by a disposed interaction boundary. */
export function endAllDocumentPointers(document: Document): void {
  const state = documentStates.get(document)
  if (state === undefined) return
  for (const id of [...state.pointers.keys()]) endDocumentPointer(document, id)
}

export function setElementPointerCapture(element: Element, value: number): void {
  const id = pointerId(value)
  const document = element.ownerDocument
  const entry = document === null ? undefined : documentStates.get(document)?.pointers.get(id)
  if (document === null || entry === undefined || !entry.active) {
    throw domError("NotFoundError", `Pointer ${id} is not active`)
  }
  if (!element.isConnected) {
    throw domError("InvalidStateError", "Pointer capture target must be connected")
  }
  entry.pending = element
}

export function releaseElementPointerCapture(element: Element, value: number): void {
  const id = pointerId(value)
  const document = element.ownerDocument
  const entry = document === null ? undefined : documentStates.get(document)?.pointers.get(id)
  if (entry === undefined || !entry.active || !hasElementPointerCapture(element, id)) return
  entry.pending = null
}

export function hasElementPointerCapture(element: Element, value: number): boolean {
  const id = pointerId(value)
  const document = element.ownerDocument
  const entry = document === null ? undefined : documentStates.get(document)?.pointers.get(id)
  if (entry === undefined || !entry.active || !element.isConnected) return false
  return entry.pending === element
}

const processPending = (
  document: Document,
  id: number,
  entry: PointerCaptureEntry,
): void => {
  const previous = connectedTarget(entry.override, document)
  const next = connectedTarget(entry.pending, document)
  entry.pending = next
  if (previous === next) {
    entry.override = next
    return
  }
  entry.override = next
  previous?.dispatchEvent(captureEvent("lostpointercapture", id))
  next?.dispatchEvent(captureEvent("gotpointercapture", id))
}
