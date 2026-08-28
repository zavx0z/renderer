import type {Document} from "./document.ts"
import {DOMRectReadOnly} from "./dom-rect.ts"
import type {Element} from "./element.ts"
import {domError} from "./internal/errors.ts"

export type DocumentRenderReadAdapter = Readonly<{
  getBoundingClientRect(element: Element): DOMRectReadOnly
}>

const adapters = new WeakMap<Document, DocumentRenderReadAdapter>()

/**
 * Attaches one external derived-state reader to one semantic Document.
 *
 * The adapter is intentionally not renderer storage: it is a realm-local hook
 * whose result is pulled only when an application performs a geometry read.
 */
export function attachDocumentRenderReadAdapter(
  document: Document,
  adapter: DocumentRenderReadAdapter
): () => void {
  if (adapters.has(document)) {
    throw domError("InvalidStateError", "The Document already has a render read adapter")
  }
  if (!adapter || typeof adapter.getBoundingClientRect !== "function") {
    throw new TypeError("A render read adapter with getBoundingClientRect() is required")
  }
  adapters.set(document, adapter)
  let attached = true
  return () => {
    if (!attached) return
    attached = false
    if (adapters.get(document) === adapter) adapters.delete(document)
  }
}

export function readElementBoundingClientRect(element: Element): DOMRectReadOnly {
  const document = element.ownerDocument
  const adapter = document ? adapters.get(document) : undefined
  if (!adapter) {
    throw domError(
      "NotSupportedError",
      "getBoundingClientRect() requires a renderer-backed Document adapter"
    )
  }
  const rect = adapter.getBoundingClientRect(element)
  if (!(rect instanceof DOMRectReadOnly)) {
    throw new TypeError("The render read adapter must return this DOM realm's DOMRectReadOnly")
  }
  return rect
}
