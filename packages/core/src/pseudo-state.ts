import type {Document, Element} from "@zavx0z/dom"

export type DocumentInteractionStateChange = Readonly<{
  elements: readonly Element[]
}>

export type DocumentInteractionStateSubscriber = (
  change: DocumentInteractionStateChange,
) => void

/**
 * Renderer-owned pointer state shared by one document renderer and interaction
 * controller. Semantic focus and control state remain owned by the DOM.
 */
export interface DocumentInteractionState {
  readonly document: Document
  isActive(element: Element): boolean
  isHovered(element: Element): boolean
  setActiveElement(element: Element | null): void
  setHoveredElement(element: Element | null): void
  subscribe(subscriber: DocumentInteractionStateSubscriber): () => void
}

export const createDocumentInteractionState = (
  document: Document,
): DocumentInteractionState => {
  if (document === null || typeof document !== "object") {
    throw new TypeError("Document interaction state requires a semantic Document")
  }

  let hovered = new Set<Element>()
  let active = new Set<Element>()
  let hoveredTarget: Element | null = null
  let activeTarget: Element | null = null
  const subscribers = new Set<DocumentInteractionStateSubscriber>()

  const state: DocumentInteractionState = {
    document,
    isActive: (element: Element) => active.has(element),
    isHovered: (element: Element) => hovered.has(element),
    setActiveElement(element: Element | null) {
      if (element === activeTarget) return
      const replacement = replaceChain(active, element, document)
      activeTarget = element
      active = replacement.next
      publish(replacement.changed, subscribers)
    },
    setHoveredElement(element: Element | null) {
      if (element === hoveredTarget) return
      const replacement = replaceChain(hovered, element, document)
      hoveredTarget = element
      hovered = replacement.next
      publish(replacement.changed, subscribers)
    },
    subscribe(subscriber: DocumentInteractionStateSubscriber) {
      if (typeof subscriber !== "function") {
        throw new TypeError("Interaction state subscriber must be a function")
      }
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    },
  }
  return Object.freeze(state)
}

const replaceChain = (
  previous: ReadonlySet<Element>,
  target: Element | null,
  document: Document,
): Readonly<{next: Set<Element>; changed: readonly Element[]}> => {
  if (target !== null && target.ownerDocument !== document) {
    throw new TypeError("Interaction target belongs to another Document")
  }
  const next = elementChain(target)
  const changed: Element[] = []
  for (const element of previous) {
    if (!next.has(element)) changed.push(element)
  }
  for (const element of next) {
    if (!previous.has(element)) changed.push(element)
  }
  return Object.freeze({
    next: changed.length === 0 && previous instanceof Set ? previous : next,
    changed: Object.freeze(changed),
  })
}

const publish = (
  elements: readonly Element[],
  subscribers: ReadonlySet<DocumentInteractionStateSubscriber>,
): void => {
  if (elements.length === 0) return
  const change = Object.freeze({elements})
  for (const subscriber of subscribers) subscriber(change)
}

const elementChain = (target: Element | null): Set<Element> => {
  const elements = new Set<Element>()
  for (let element = target; element; element = element.parentElement) {
    elements.add(element)
  }
  return elements
}
