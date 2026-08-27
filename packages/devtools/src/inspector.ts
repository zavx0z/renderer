import {
  HTMLElement,
  HTMLInputElement,
  HTMLTextAreaElement,
  Node,
  type Document,
  type Element,
  type MutationBatch,
  type StateChangeBatch,
} from "@zavx0z/dom"
import type {
  DisplayItem,
  HitMetadata,
  RenderBorder,
  RenderBox,
  RenderClip,
} from "@zavx0z/renderer"
import type {
  CreateDomInspectorOptions,
  DomInspector,
  DomInspectorAttribute,
  DomInspectorBox,
  DomInspectorChange,
  DomInspectorDisplay,
  DomInspectorHit,
  DomInspectorNode,
  DomInspectorSnapshot,
  DomInspectorSubscriber,
} from "./types.ts"

export const createDomInspector = (
  options: CreateDomInspectorOptions,
): DomInspector => {
  const {document, renderer} = options
  if (renderer && renderer.document !== document)
    throw new TypeError("DOM inspector renderer belongs to another Document")

  const idsByNode = new WeakMap<Node, number>()
  const nodesById = new Map<number, Node>()
  const subscribers = new Set<DomInspectorSubscriber>()
  let nextId = 1
  let disposed = false
  const unsubscribeMutations = document.subscribeMutations(onMutationBatch)
  const unsubscribeState = document.subscribeStateChanges(onStateChangeBatch)

  return Object.freeze({
    document,
    idForNode,
    nodeForId,
    snapshot,
    subscribe,
    dispose,
  })

  function idForNode(node: Node): number {
    assertActive()
    validateNode(document, node)
    const existing = idsByNode.get(node)
    if (existing !== undefined) {
      nodesById.set(existing, node)
      return existing
    }
    if (!Number.isSafeInteger(nextId))
      throw new RangeError("DOM inspector exhausted safe numeric node IDs")
    const id = nextId++
    idsByNode.set(node, id)
    nodesById.set(id, node)
    return id
  }

  function nodeForId(id: number): Node | null {
    if (disposed || !Number.isSafeInteger(id) || id <= 0) return null
    return nodesById.get(id) ?? null
  }

  function snapshot(root: Node = document): DomInspectorSnapshot {
    assertActive()
    validateNode(document, root)
    const frame = renderer?.flush() ?? null
    const displayByNode = frame ? indexDisplay(frame.displayList) : null
    const nodes: DomInspectorNode[] = []
    const rootId = idForNode(root)

    visit(root, null)
    return Object.freeze({
      mutationVersion: document.version,
      stateVersion: document.stateVersion,
      root: rootId,
      nodes: Object.freeze(nodes),
    })

    function visit(node: Node, parent: number | null): void {
      const id = idForNode(node)
      const children = Object.freeze(
        node.childNodes.map((child) => idForNode(child)),
      )
      const base = {
        id,
        nodeType: node.nodeType,
        nodeName: node.nodeName,
        localName: localName(node),
        nodeValue: node.nodeValue,
        attributes: attributes(node),
        parent,
        children,
      }
      const state = liveState(document, node)
      const stateProjection = state ? {state} : {}
      const record: DomInspectorNode = frame
        ? Object.freeze({
            ...base,
            ...stateProjection,
            box: projectBox(frame.boxByNode.get(node) ?? null),
            hit: projectHit(frame.hits.get(node) ?? null),
            display: Object.freeze(displayByNode?.get(node) ?? []),
          })
        : Object.freeze({...base, ...stateProjection})
      nodes.push(record)
      for (const child of node.childNodes) visit(child, id)
    }
  }

  function subscribe(subscriber: DomInspectorSubscriber): () => void {
    assertActive()
    subscribers.add(subscriber)
    let subscribed = true
    return () => {
      if (!subscribed) return
      subscribed = false
      subscribers.delete(subscriber)
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    unsubscribeMutations()
    unsubscribeState()
    subscribers.clear()
    nodesById.clear()
  }

  function onMutationBatch(batch: MutationBatch): void {
    if (disposed || batch.document !== document) return
    const changedNodeIds: number[] = []
    const changed = new Set<number>()
    const removedRoots: Node[] = []
    const mark = (node: Node): void => {
      const id = idForNode(node)
      if (changed.has(id)) return
      changed.add(id)
      changedNodeIds.push(id)
    }

    for (const record of batch.records) {
      mark(record.target)
      if (record.type !== "childList") continue
      for (const node of record.addedNodes) mark(node)
      for (const node of record.removedNodes) {
        mark(node)
        removedRoots.push(node)
      }
    }

    const change: DomInspectorChange = Object.freeze({
      kind: "mutation",
      mutationVersion: batch.version,
      stateVersion: document.stateVersion,
      changedNodeIds: Object.freeze(changedNodeIds),
    })
    try {
      for (const subscriber of [...subscribers]) {
        if (disposed) break
        subscriber(change)
      }
    } finally {
      for (const root of removedRoots) {
        if (!document.contains(root)) releaseReverseSubtree(root)
      }
    }
  }

  function onStateChangeBatch(batch: StateChangeBatch): void {
    if (disposed || batch.document !== document) return
    const changedNodeIds: number[] = []
    const changed = new Set<number>()
    for (const record of batch.records) {
      const id = idForNode(record.target)
      if (changed.has(id)) continue
      changed.add(id)
      changedNodeIds.push(id)
    }
    const change: DomInspectorChange = Object.freeze({
      kind: "state",
      mutationVersion: document.version,
      stateVersion: batch.version,
      changedNodeIds: Object.freeze(changedNodeIds),
    })
    for (const subscriber of [...subscribers]) {
      if (disposed) break
      subscriber(change)
    }
  }

  function releaseReverseSubtree(root: Node): void {
    const id = idsByNode.get(root)
    if (id !== undefined) nodesById.delete(id)
    for (const child of root.childNodes) releaseReverseSubtree(child)
  }

  function assertActive(): void {
    if (disposed) throw new Error("DOM inspector is disposed")
  }
}

const validateNode = (document: Document, node: Node): void => {
  if (!(node instanceof Node))
    throw new TypeError("DOM inspector requires the configured @zavx0z/dom realm")
  if (node !== document && node.ownerDocument !== document)
    throw new TypeError("DOM inspector node belongs to another Document")
}

const localName = (node: Node): string | null =>
  node.nodeType === Node.ELEMENT_NODE ? (node as Element).localName : null

const attributes = (node: Node): readonly DomInspectorAttribute[] => {
  if (node.nodeType !== Node.ELEMENT_NODE) return Object.freeze([])
  const element = node as Element
  return Object.freeze(
    element.getAttributeNames().map((name) =>
      Object.freeze({name, value: element.getAttribute(name) ?? ""}),
    ),
  )
}

const liveState = (
  document: Document,
  node: Node,
): DomInspectorNode["state"] => {
  if (!(node instanceof HTMLElement)) return undefined
  const base = {
    focused: document.activeElement === node,
    scrollLeft: node.scrollLeft,
    scrollTop: node.scrollTop,
  }
  if (node instanceof HTMLInputElement) return Object.freeze({
      ...base,
      type: node.type,
      value: node.value,
      checked: node.checked,
      selectionStart: node.selectionStart,
      selectionEnd: node.selectionEnd,
      selectionDirection: node.selectionDirection,
    })
  if (node instanceof HTMLTextAreaElement) return Object.freeze({
    ...base,
    value: node.value,
    rows: node.rows,
    cols: node.cols,
    selectionStart: node.selectionStart,
    selectionEnd: node.selectionEnd,
    selectionDirection: node.selectionDirection,
  })
  return Object.freeze(base)
}

const indexDisplay = (
  items: readonly DisplayItem[],
): ReadonlyMap<Node, readonly DomInspectorDisplay[]> => {
  const mutable = new Map<Node, DomInspectorDisplay[]>()
  for (const item of items) {
    const entries = mutable.get(item.node) ?? []
    if (!mutable.has(item.node)) mutable.set(item.node, entries)
    entries.push(Object.freeze({key: item.key, kind: item.kind}))
  }
  const output = new Map<Node, readonly DomInspectorDisplay[]>()
  for (const [node, entries] of mutable)
    output.set(node, Object.freeze(entries))
  return output
}

const projectBox = (box: RenderBox | null): DomInspectorBox | null => {
  if (!box) return null
  return Object.freeze({
    depth: box.depth,
    display: box.display,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    contentX: box.contentX,
    contentY: box.contentY,
    contentWidth: box.contentWidth,
    contentHeight: box.contentHeight,
    margin: copyEdges(box.margin),
    padding: copyEdges(box.padding),
    border: copyBorder(box.border),
    transform: copyTransform(box.transform),
  })
}

const projectHit = (hit: HitMetadata | null): DomInspectorHit | null => {
  if (!hit) return null
  return Object.freeze({
    x: hit.x,
    y: hit.y,
    width: hit.width,
    height: hit.height,
    interactive: hit.interactive,
    disabled: hit.disabled,
    role: hit.role,
    clips: Object.freeze(hit.clips.map(copyClip)),
    transform: copyTransform(hit.transform),
  })
}

const copyEdges = (edges: RenderBox["margin"]) =>
  Object.freeze({
    top: edges.top,
    right: edges.right,
    bottom: edges.bottom,
    left: edges.left,
  })

const copyBorder = (border: RenderBorder): RenderBorder =>
  Object.freeze({
    widths: copyEdges(border.widths),
    colors: Object.freeze({
      top: border.colors.top,
      right: border.colors.right,
      bottom: border.colors.bottom,
      left: border.colors.left,
    }),
    radii: Object.freeze({
      topLeft: border.radii.topLeft,
      topRight: border.radii.topRight,
      bottomRight: border.radii.bottomRight,
      bottomLeft: border.radii.bottomLeft,
    }),
  })

const copyClip = (clip: RenderClip): RenderClip =>
  Object.freeze({
    x: clip.x,
    y: clip.y,
    width: clip.width,
    height: clip.height,
    radii: Object.freeze({
      topLeft: Object.freeze({...clip.radii.topLeft}),
      topRight: Object.freeze({...clip.radii.topRight}),
      bottomRight: Object.freeze({...clip.radii.bottomRight}),
      bottomLeft: Object.freeze({...clip.radii.bottomLeft}),
    }),
    clipX: clip.clipX,
    clipY: clip.clipY,
    transform: copyTransform(clip.transform),
  })

const copyTransform = (transform: Readonly<{
  scaleX: number
  scaleY: number
  translateX: number
  translateY: number
}>) => Object.freeze({
  scaleX: transform.scaleX,
  scaleY: transform.scaleY,
  translateX: transform.translateX,
  translateY: transform.translateY,
})
