import {
  HTMLElement,
  HTMLImageElement,
  HTMLInputElement,
  HTMLMeterElement,
  HTMLProgressElement,
  HTMLSelectElement,
  HTMLTextAreaElement,
  getPopoverVisibilityState,
  subscribeDocumentAuthorStyleSheets,
  subscribeDocumentCompiledStyleSheets,
  type Document,
  type Element,
  type MutationBatch,
  type Node,
  type StateChangeBatch,
  type Text,
} from "@zavx0z/dom"
import {
  EMPTY_CUSTOM_PROPERTIES,
  computeStyle,
  elementTag,
  resolveLength,
  resolveLineHeight,
  type ComputedStyle,
  type CSSLength,
  type StyleRuleIndex,
} from "./css.ts"
import { DirtyTracker } from "./dirty.ts"
import {
  cachedDocumentStyleRules,
  prepareHostStyleSheets
} from "./stylesheet-cache.ts"
import {
  immutableArray,
  replaceImmutableArray,
} from "./immutable-array.ts"
import type {
  CreateDocumentRendererOptions,
  DisplayItem,
  DocumentRenderer,
  HitMetadata,
  RenderBorder,
  RenderBorderColors,
  RenderClip,
  RenderClipCornerRadii,
  RenderCornerRadii,
  RenderEdges,
  RenderBox,
  RenderFrame,
  RenderPadding,
  RenderScrollMetrics,
  RenderTransform,
  RenderViewport,
} from "./types.ts"

type LayoutNode = {
  readonly node: Node
  parent: LayoutNode | null
  style: ComputedStyle
  readonly effectiveOpacity: number
  children: readonly LayoutNode[]
  text: string | null
  readonly tag: string | null
  readonly transparent: boolean
}

type Size = Readonly<{
  width: number
  height: number
}>

type FlexLine = Readonly<{
  indices: readonly number[]
  crossSize: number
}>

type ContainingBlock = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

type PlacementContext = Readonly<{
  absolute: ContainingBlock
  normal: ContainingBlock
  presentation: RenderTransform
}>

type BuildState = {
  readonly boxes: RenderBox[]
  readonly boxByNode: Map<Node, RenderBox>
  readonly displayList: DisplayItem[]
  readonly hits: Map<Node, HitMetadata>
  readonly hitOrder: Element[]
  readonly scrolls: Map<Element, RenderScrollMetrics>
  readonly transforms: Map<Node, RenderTransform>
  readonly measured: WeakMap<LayoutNode, Map<string, Size>>
}

type FrameCollectionIndexes = Readonly<{
  boxByNode: WeakMap<Node, number>
  displayByNode: WeakMap<Node, ReadonlyMap<string, number>>
}>

const collectionIndexesByFrame = new WeakMap<RenderFrame, FrameCollectionIndexes>()

const ZERO_EDGES: RenderEdges = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

const BLACK_EDGES: RenderBorderColors = Object.freeze({
  top: "#000000",
  right: "#000000",
  bottom: "#000000",
  left: "#000000",
})

const ZERO_RADII: RenderCornerRadii = Object.freeze({
  topLeft: 0,
  topRight: 0,
  bottomRight: 0,
  bottomLeft: 0,
})

const ZERO_BORDER: RenderBorder = Object.freeze({
  widths: ZERO_EDGES,
  colors: BLACK_EDGES,
  radii: ZERO_RADII,
})

const NO_CLIPS: readonly RenderClip[] = Object.freeze([])
const IDENTITY_TRANSFORM: RenderTransform = Object.freeze({
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
})
const INPUT_VALUE_TYPES = new Set([
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
])
const RANGE_TRACK_COLOR = "#d1d5db"
const RANGE_THUMB_COLOR = "#2563eb"
const RANGE_TRACK_THICKNESS = 4
const RANGE_THUMB_SIZE = 12
const SCROLLBAR_AUTO_THICKNESS = 10
const SCROLLBAR_THIN_THICKNESS = 4
const SCROLLBAR_TRACK_COLOR = "#1f2937"
const SCROLLBAR_THUMB_COLOR = "#9ca3af"
const GAUGE_TRACK_COLOR = "#d1d5db"
const PROGRESS_VALUE_COLOR = "#2563eb"
const PROGRESS_INDETERMINATE_COLOR = "#60a5fa"
const METER_OPTIMUM_COLOR = "#16a34a"
const METER_SUBOPTIMUM_COLOR = "#d97706"
const METER_EVEN_LESS_GOOD_COLOR = "#dc2626"
const rangeBoundaryPattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/
const graphemeSegmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, {granularity: "grapheme"})
  : null
const ZERO_CLIP_RADIUS = Object.freeze({x: 0, y: 0})
const ZERO_CLIP_RADII: RenderClipCornerRadii = Object.freeze({
  topLeft: ZERO_CLIP_RADIUS,
  topRight: ZERO_CLIP_RADIUS,
  bottomRight: ZERO_CLIP_RADIUS,
  bottomLeft: ZERO_CLIP_RADIUS,
})

const ROOT_STYLE: ComputedStyle = Object.freeze({
  customProperties: EMPTY_CUSTOM_PROPERTIES,
  display: "block",
  boxSizing: "content-box",
  flexDirection: "row",
  flexWrap: "nowrap",
  flexGrow: 0,
  flexShrink: 1,
  flexBasis: null,
  alignItems: "stretch",
  justifyContent: "flex-start",
  width: null,
  height: null,
  minWidth: null,
  minHeight: null,
  maxWidth: null,
  maxHeight: null,
  position: "static",
  left: null,
  top: null,
  right: null,
  bottom: null,
  transform: Object.freeze([]),
  transformOrigin: Object.freeze({
    x: Object.freeze({unit: "percent", value: 50}),
    y: Object.freeze({unit: "percent", value: 50}),
  }),
  boxShadow: null,
  gap: 0,
  margin: ZERO_EDGES,
  padding: ZERO_EDGES,
  borderWidths: ZERO_EDGES,
  borderColors: BLACK_EDGES,
  borderRadii: Object.freeze({
    topLeft: null,
    topRight: null,
    bottomRight: null,
    bottomLeft: null,
  }),
  background: null,
  color: "#000000",
  fontSize: 16,
  lineHeight: "normal",
  letterSpacing: 0,
  opacity: 1,
  overflowX: "visible",
  overflowY: "visible",
  scrollbarWidth: "auto",
  objectFit: "cover",
  textAlign: "start",
  textOverflow: "clip",
  whiteSpace: "normal",
  zIndex: "auto",
})

export const createDocumentRenderer = (
  options: CreateDocumentRendererOptions,
): DocumentRenderer => {
  const viewport = validateViewport(options.viewport)
  validateRoot(options.document, options.root)
  if (
    options.interactionState !== undefined &&
    options.interactionState.document !== options.document
  ) throw new TypeError("interactionState belongs to another Document")
  const hostStyleSheets = prepareHostStyleSheets(options.styleSheets ?? [])
  let styleRuleEntry = cachedDocumentStyleRules(options.document, hostStyleSheets)
  let rules = styleRuleEntry.rules
  const dirty = new DirtyTracker(options.root)
  const layoutCache = new WeakMap<Node, LayoutNode>()
  const subtreeDirty = new Set<Node>([options.root])
  const characterDataTargets = new Set<Text>()
  let frame: RenderFrame | null = null
  let revision = 0
  let disposed = false
  let fastPathBlocked = false
  let transformTarget: Element | null = null
  const unsubscribe = options.document.subscribeMutations(
    invalidateMutationBatch,
  )
  const unsubscribeState = options.document.subscribeStateChanges(
    invalidateStateBatch,
  )
  const invalidateStyleSheets = (): void => {
    if (disposed) return
    dirty.invalidate(options.root)
    subtreeDirty.add(options.root)
    blockFastPath()
  }
  const unsubscribeAuthorStyleSheets = subscribeDocumentAuthorStyleSheets(
    options.document,
    invalidateStyleSheets,
  )
  const unsubscribeCompiledStyleSheets = subscribeDocumentCompiledStyleSheets(
    options.document,
    invalidateStyleSheets,
  )
  const unsubscribeInteraction = options.interactionState?.subscribe(({elements}) => {
    if (disposed) return
    let affected = false
    for (const element of elements) {
      if (
        options.root.contains(element) ||
        element === options.root
      ) {
        affected = true
        dirty.invalidate(element)
        subtreeDirty.add(element)
      } else if (element.contains(options.root)) {
        affected = true
        dirty.invalidate(options.root)
        subtreeDirty.add(options.root)
      }
    }
    if (affected) blockFastPath()
  }) ?? (() => {})

  const renderer: DocumentRenderer = Object.freeze({
    document: options.document,
    root: options.root,
    viewport,
    invalidate(node: Node): void {
      assertActive()
      dirty.invalidate(node)
      subtreeDirty.add(node)
      blockFastPath()
    },
    render(node?: Node): RenderFrame {
      assertActive()
      if (node) {
        dirty.invalidate(node)
        subtreeDirty.add(node)
        blockFastPath()
      }
      return flush()
    },
    flush,
    dispose(): void {
      if (disposed) return
      disposed = true
      unsubscribe()
      unsubscribeState()
      unsubscribeAuthorStyleSheets()
      unsubscribeCompiledStyleSheets()
      unsubscribeInteraction()
    },
  })

  return renderer

  function flush(): RenderFrame {
    assertActive()
    const nextStyleRuleEntry = cachedDocumentStyleRules(options.document, hostStyleSheets)
    if (nextStyleRuleEntry !== styleRuleEntry) {
      styleRuleEntry = nextStyleRuleEntry
      rules = nextStyleRuleEntry.rules
      dirty.invalidate(options.root)
      subtreeDirty.add(options.root)
      blockFastPath()
    }
    if (frame && !dirty.dirty) return frame
    if (frame !== null && transformTarget !== null) {
      const incremental = tryBuildTransformFrame(
        frame,
        transformTarget,
        layoutCache,
        rules,
        options.interactionState,
        projectionRootInheritedStyle(options.root, rules, options.interactionState),
        revision + 1,
      )
      if (incremental !== null) {
        revision++
        frame = incremental
        dirty.clear()
        subtreeDirty.clear()
        resetFastPath()
        return incremental
      }
    }
    if (
      frame !== null &&
      !fastPathBlocked &&
      characterDataTargets.size === 1
    ) {
      const target = characterDataTargets.values().next().value
      const incremental = target === undefined
        ? null
        : tryBuildCharacterDataFrame(
            frame,
            target,
            layoutCache,
            revision + 1,
          )
      if (incremental !== null) {
        revision++
        frame = incremental
        dirty.clear()
        subtreeDirty.clear()
        resetFastPath()
        return incremental
      }
    }
    const next = buildFrame(
      options.document,
      options.root,
      viewport,
      rules,
      revision + 1,
      new Set(dirty.snapshot()),
      subtreeDirty,
      layoutCache,
      options.interactionState,
    )
    revision++
    frame = next
    dirty.clear()
    subtreeDirty.clear()
    resetFastPath()
    return next
  }

  function invalidateMutationBatch(batch: MutationBatch): void {
    if (disposed || batch.document !== options.document) return
    for (const record of batch.records) {
      if (
        options.root.contains(record.target) ||
        record.target === options.root
      ) {
        dirty.invalidate(record.target)
        if (isTransformOnlyStyleMutation(record)) {
          subtreeDirty.add(record.target)
          if (transformTarget === null || transformTarget === record.target) {
            transformTarget = record.target
            fastPathBlocked = true
            characterDataTargets.clear()
          } else {
            blockFastPath()
          }
        } else if (
          record.type === "characterData" &&
          isText(record.target) &&
          !fastPathBlocked &&
          !hasLineBreak(record.oldValue) &&
          !hasLineBreak(record.newValue) &&
          (record.oldValue.length === 0) === (record.newValue.length === 0)
        ) {
          characterDataTargets.add(record.target)
          if (characterDataTargets.size > 1) blockFastPath()
        } else {
          subtreeDirty.add(record.target)
          blockFastPath()
        }
      } else if (mutationAffectsProjectionAncestry(record, options.root)) {
        dirty.invalidate(options.root)
        subtreeDirty.add(options.root)
        blockFastPath()
      }
    }
  }

  function invalidateStateBatch(batch: StateChangeBatch): void {
    if (disposed || batch.document !== options.document) return
    for (const record of batch.records) {
      if (
        options.root.contains(record.target) ||
        record.target === options.root
      ) {
        dirty.invalidate(record.target)
        subtreeDirty.add(record.target)
        blockFastPath()
      } else if (record.target.contains(options.root)) {
        dirty.invalidate(options.root)
        subtreeDirty.add(options.root)
        blockFastPath()
      }
    }
  }

  function blockFastPath(): void {
    fastPathBlocked = true
    characterDataTargets.clear()
    transformTarget = null
  }

  function resetFastPath(): void {
    fastPathBlocked = false
    characterDataTargets.clear()
    transformTarget = null
  }

  function assertActive(): void {
    if (disposed) throw new Error("Cannot use a disposed document renderer")
  }
}

const tryBuildCharacterDataFrame = (
  previous: RenderFrame,
  target: Text,
  layoutCache: WeakMap<Node, LayoutNode>,
  revision: number,
): RenderFrame | null => {
  const layoutNode = layoutCache.get(target)
  if (!layoutNode || layoutNode.text === null || layoutNode.transparent)
    return null
  const parent = layoutNode.parent
  if (!isStableTextContainer(layoutNode, parent, target)) return null

  const previousBox = previous.boxByNode.get(target)
  if (!previousBox) return null
  const indexes = collectionIndexes(previous)
  const boxIndex = indexes.boxByNode.get(target) ?? -1
  if (boxIndex < 0 || previous.boxes[boxIndex] !== previousBox) return null
  const displayIndex = indexes.displayByNode.get(target)?.get("text") ?? -1
  if (displayIndex < 0) return null
  const previousItem = previous.displayList[displayIndex]
  if (previousItem?.kind !== "text") return null

  const nextText = readText(target, layoutNode.style)
  if (
    previousItem.text.length === 0 ||
    nextText.length === 0 ||
    hasLineBreak(layoutNode.text) ||
    hasLineBreak(nextText)
  )
    return null
  const metrics = measureText(nextText, layoutNode.style)
  const width = metrics.width
  const height = metrics.height
  if (height !== previousBox.height) return null
  const parentBox = previous.boxByNode.get(parent.node)
  const displayText = parentBox
    ? ellipsizeSingleLine(nextText, parent.style, parentBox.contentWidth)
    : nextText
  if (displayText === "" || !hasPaintableText(displayText)) return null

  const nextBox: RenderBox = Object.freeze({
    ...previousBox,
    width,
    contentWidth: width,
  })
  const nextItem: DisplayItem = Object.freeze({
    ...previousItem,
    text: displayText,
    x: parentBox
      ? alignedTextX(
          layoutNode.style,
          parentBox.contentX,
          parentBox.contentWidth,
          textAdvance(displayText, layoutNode.style),
        )
      : previousItem.x,
  })
  const boxes = replaceImmutableArray(previous.boxes, boxIndex, nextBox)
  const displayList = replaceImmutableArray(
    previous.displayList,
    displayIndex,
    nextItem,
  )
  const boxByNode = replaceImmutableNodeMap(
    previous.boxByNode,
    target,
    nextBox,
  )
  const next: RenderFrame = Object.freeze({
    revision,
    document: previous.document,
    root: previous.root,
    viewport: previous.viewport,
    boxes,
    boxByNode,
    displayList,
    hits: previous.hits,
    scrolls: previous.scrolls,
  })
  collectionIndexesByFrame.set(next, indexes)
  layoutNode.text = nextText
  return next
}

const tryBuildTransformFrame = (
  previous: RenderFrame,
  target: Element,
  layoutCache: WeakMap<Node, LayoutNode>,
  rules: StyleRuleIndex,
  interactionState: CreateDocumentRendererOptions["interactionState"],
  projectionInheritedStyle: ComputedStyle,
  revision: number,
): RenderFrame | null => {
  if (previous.scrolls.size > 0 || target instanceof HTMLElement && target.popover !== null) {
    return null
  }
  const layoutNode = layoutCache.get(target)
  const targetBox = previous.boxByNode.get(target)
  if (!layoutNode || !targetBox || subtreeOwnsOverflowClip(layoutNode)) return null
  const nextStyle = computeStyle(
    target,
    layoutNode.parent?.style ?? projectionInheritedStyle,
    rules,
    interactionState,
  )
  if (!sameStyleExceptTransform(layoutNode.style, nextStyle)) return null
  layoutNode.style = nextStyle

  const nextTransforms = new Map<Node, RenderTransform>()
  const parentTransform = nearestBoxTransform(layoutNode.parent, previous)
  collectSubtreeTransforms(layoutNode, parentTransform, previous, nextTransforms)
  if (!nextTransforms.has(target)) return null

  const boxes = immutableArray(previous.boxes.map((box) => {
    const transform = nextTransforms.get(box.node)
    return transform === undefined || transform === box.transform
      ? box
      : Object.freeze({...box, transform})
  }))
  const boxByNode = new Map<Node, RenderBox>()
  for (const box of boxes) boxByNode.set(box.node, box)
  const displayList = immutableArray(previous.displayList.map((item) => {
    const transform = nextTransforms.get(item.node)
    return transform === undefined || transform === item.transform
      ? item
      : Object.freeze({...item, transform})
  }))
  const mutableHits = new Map<Element, HitMetadata>()
  for (const [node, hit] of previous.hits) {
    const transform = nextTransforms.get(node)
    mutableHits.set(
      hit.node,
      transform === undefined || transform === hit.transform
        ? hit
        : Object.freeze({...hit, transform}),
    )
  }
  const next: RenderFrame = Object.freeze({
    revision,
    document: previous.document,
    root: previous.root,
    viewport: previous.viewport,
    boxes,
    boxByNode: immutableNodeMap(boxByNode),
    displayList,
    hits: immutableNodeMap(mutableHits),
    scrolls: previous.scrolls,
  })
  collectionIndexesByFrame.set(next, collectionIndexes(previous))
  return next
}

const collectSubtreeTransforms = (
  layoutNode: LayoutNode,
  inherited: RenderTransform,
  frame: RenderFrame,
  output: Map<Node, RenderTransform>,
): void => {
  const box = frame.boxByNode.get(layoutNode.node)
  const transform = box === undefined
    ? inherited
    : composeTransform(
        inherited,
        resolveElementTransform(layoutNode.style, box.x, box.y, box.width, box.height),
      )
  if (box !== undefined) output.set(layoutNode.node, transform)
  for (const child of layoutNode.children) {
    collectSubtreeTransforms(child, transform, frame, output)
  }
}

const nearestBoxTransform = (
  layoutNode: LayoutNode | null,
  frame: RenderFrame,
): RenderTransform => {
  for (let current = layoutNode; current !== null; current = current.parent) {
    const box = frame.boxByNode.get(current.node)
    if (box !== undefined) return box.transform
  }
  return IDENTITY_TRANSFORM
}

const subtreeOwnsOverflowClip = (layoutNode: LayoutNode): boolean => {
  if (layoutNode.style.overflowX !== "visible" || layoutNode.style.overflowY !== "visible") {
    return true
  }
  return layoutNode.children.some(subtreeOwnsOverflowClip)
}

const sameStyleExceptTransform = (left: ComputedStyle, right: ComputedStyle): boolean => {
  const {
    customProperties: leftCustomProperties,
    transform: _leftTransform,
    transformOrigin: _leftOrigin,
    ...leftComparable
  } = left
  const {
    customProperties: rightCustomProperties,
    transform: _rightTransform,
    transformOrigin: _rightOrigin,
    ...rightComparable
  } = right
  return leftCustomProperties === rightCustomProperties &&
    JSON.stringify(leftComparable) === JSON.stringify(rightComparable)
}

const isTransformOnlyStyleMutation = (
  record: MutationBatch["records"][number],
): record is Extract<MutationBatch["records"][number], {type: "attributes"}> => {
  if (record.type !== "attributes" || record.attributeName !== "style") return false
  const oldSignatures = styleMutationSignatures(record.oldValue ?? "")
  const newSignatures = styleMutationSignatures(record.newValue ?? "")
  return oldSignatures.other === newSignatures.other &&
    oldSignatures.transform !== newSignatures.transform
}

const styleMutationSignatures = (
  value: string,
): Readonly<{other: string; transform: string}> => {
  const other: string[] = []
  const transform: string[] = []
  for (const entry of value.split(";")) {
    const separator = entry.indexOf(":")
    if (separator < 0) continue
    const sourceProperty = entry.slice(0, separator).trim()
    const property = sourceProperty.startsWith("--")
      ? sourceProperty
      : sourceProperty.replace(/([A-Z])/g, "-$1").toLowerCase()
    const declaration = `${property}:${entry.slice(separator + 1).trim()}`
    if (property === "transform" || property === "transform-origin") transform.push(declaration)
    else other.push(declaration)
  }
  return Object.freeze({other: other.join(";"), transform: transform.join(";")})
}

const collectionIndexes = (frame: RenderFrame): FrameCollectionIndexes => {
  const existing = collectionIndexesByFrame.get(frame)
  if (existing) return existing
  const indexes = indexCollections(frame.boxes, frame.displayList)
  collectionIndexesByFrame.set(frame, indexes)
  return indexes
}

const indexCollections = (
  boxes: readonly RenderBox[],
  displayList: readonly DisplayItem[],
): FrameCollectionIndexes => {
  const boxByNode = new WeakMap<Node, number>()
  const mutableDisplay = new WeakMap<Node, Map<string, number>>()
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index]
    if (box) boxByNode.set(box.node, index)
  }
  for (let index = 0; index < displayList.length; index += 1) {
    const item = displayList[index]
    if (!item) continue
    let keys = mutableDisplay.get(item.node)
    if (!keys) {
      keys = new Map()
      mutableDisplay.set(item.node, keys)
    }
    keys.set(item.key, keys.has(item.key) ? -1 : index)
  }
  return Object.freeze({
    boxByNode,
    displayByNode: mutableDisplay as WeakMap<Node, ReadonlyMap<string, number>>,
  })
}

const isStableTextContainer = (
  text: LayoutNode,
  parent: LayoutNode | null,
  target: Text,
): parent is LayoutNode => {
  if (
    parent === null ||
    parent.transparent ||
    parent.style.display !== "block" ||
    parent.style.height?.unit !== "px" ||
    parent.children.length !== 1 ||
    parent.children[0] !== text ||
    target.parentNode !== parent.node ||
    parent.node.firstChild !== target ||
    parent.node.lastChild !== target
  )
    return false

  for (let ancestor: LayoutNode | null = parent; ancestor; ancestor = ancestor.parent) {
    if (
      scrollableOverflow(ancestor.style.overflowX) ||
      scrollableOverflow(ancestor.style.overflowY)
    )
      return false
  }

  if (parent.style.width !== null) return true
  const owner = parent.parent
  if (owner === null || owner.transparent) return true
  return owner.style.display === "block" ||
    (owner.style.display === "flex" && owner.style.flexDirection === "column")
}

const buildFrame = (
  document: Document,
  root: Node,
  viewport: RenderViewport,
  rules: StyleRuleIndex,
  revision: number,
  dirtyNodes: ReadonlySet<Node>,
  subtreeDirty: ReadonlySet<Node>,
  layoutCache: WeakMap<Node, LayoutNode>,
  interactionState: CreateDocumentRendererOptions["interactionState"],
): RenderFrame => {
  const popoverInheritedStyles = new WeakMap<HTMLElement, ComputedStyle>()
  const inheritedStyle = projectionRootInheritedStyle(root, rules, interactionState)
  const tree = buildLayoutTree(
    root,
    null,
    inheritedStyle,
    1,
    rules,
    dirtyNodes,
    subtreeDirty,
    layoutCache,
    false,
    null,
    popoverInheritedStyles,
    interactionState,
  )
  const state: BuildState = {
    boxes: [],
    boxByNode: new Map(),
    displayList: [],
    hits: new Map(),
    hitOrder: [],
    scrolls: new Map(),
    transforms: new Map(),
    measured: new WeakMap(),
  }
  const margin = tree.style.margin
  const availableWidth = Math.max(0, viewport.width - horizontal(margin))
  const availableHeight = Math.max(0, viewport.height - vertical(margin))
  const viewportBlock: ContainingBlock = Object.freeze({
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  })
  const viewportContext: PlacementContext = Object.freeze({
    absolute: viewportBlock,
    normal: viewportBlock,
    presentation: IDENTITY_TRANSFORM,
  })

  measure(tree, availableWidth, availableHeight, state)
  if (tree.style.position === "absolute") {
    placeAbsoluteChild(
      tree,
      margin.left,
      margin.top,
      NO_CLIPS,
      0,
      state,
      viewportContext,
    )
  } else {
    place(
      tree,
      margin.left,
      margin.top,
      availableWidth,
      availableHeight,
      undefined,
      undefined,
      NO_CLIPS,
      0,
      state,
      viewportContext,
    )
  }

  for (const popover of showingPopovers(root)) {
    const inheritedStyle = popoverInheritedStyles.get(popover) ??
      layoutCache.get(popover)?.parent?.style ??
      ROOT_STYLE
    const topTree = buildLayoutTree(
      popover,
      null,
      inheritedStyle,
      1,
      rules,
      new Set([popover]),
      new Set([popover]),
      new WeakMap(),
      true,
      popover,
      popoverInheritedStyles,
      interactionState,
    )
    const size = measure(topTree, viewport.width, viewport.height, state)
    const width = Math.min(viewport.width, size.width)
    const height = Math.min(viewport.height, size.height)
    place(
      topTree,
      (viewport.width - width) / 2,
      (viewport.height - height) / 2,
      viewport.width,
      viewport.height,
      width,
      height,
      NO_CLIPS,
      0,
      state,
      viewportContext,
      false,
    )
  }

  const boxes = immutableArray(state.boxes)
  const displayList = immutableArray(state.displayList)
  const boxByNode = immutableNodeMap(state.boxByNode)
  const orderedHits = new Map<Element, HitMetadata>()
  for (const node of state.hitOrder) {
    const hit = state.hits.get(node)
    if (hit) orderedHits.set(node, hit)
  }
  const hits = immutableNodeMap(orderedHits)
  const scrolls = immutableNodeMap(state.scrolls)

  const frame: RenderFrame = Object.freeze({
    revision,
    document,
    root,
    viewport,
    boxes,
    boxByNode,
    displayList,
    hits,
    scrolls,
  })
  return frame
}

const projectionRootInheritedStyle = (
  root: Node,
  rules: StyleRuleIndex,
  interactionState: CreateDocumentRendererOptions["interactionState"],
): ComputedStyle => {
  const ancestors: Element[] = []
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
    ancestors.push(ancestor)
  }
  let inherited = ROOT_STYLE
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    inherited = computeStyle(ancestors[index]!, inherited, rules, interactionState)
  }
  return inherited
}

const mutationAffectsProjectionAncestry = (
  record: MutationBatch["records"][number],
  root: Node,
): boolean => {
  if (record.target.contains(root)) return true
  if (record.type !== "childList") return false
  return [...record.addedNodes, ...record.removedNodes].some((node) =>
    node === root || node.contains(root)
  )
}

const buildLayoutTree = (
  node: Node,
  parent: LayoutNode | null,
  inheritedStyle: ComputedStyle,
  inheritedOpacity: number,
  rules: StyleRuleIndex,
  dirtyNodes: ReadonlySet<Node>,
  subtreeDirty: ReadonlySet<Node>,
  layoutCache: WeakMap<Node, LayoutNode>,
  force: boolean,
  allowedPopover: HTMLElement | null,
  popoverInheritedStyles: WeakMap<HTMLElement, ComputedStyle>,
  interactionState: CreateDocumentRendererOptions["interactionState"],
): LayoutNode => {
  if (node instanceof HTMLElement && node.popover !== null) {
    popoverInheritedStyles.set(node, inheritedStyle)
  }
  const cached = layoutCache.get(node)
  if (!force && cached && !dirtyNodes.has(node)) {
    cached.parent = parent
    return cached
  }

  if (isText(node)) {
    const style = textStyle(inheritedStyle)
    const layoutNode: LayoutNode = {
      node,
      parent,
      style,
      effectiveOpacity: inheritedOpacity,
      children: Object.freeze([]),
      text: readText(node, style),
      tag: null,
      transparent: false,
    }
    layoutCache.set(node, layoutNode)
    return layoutNode
  }

  if (isElement(node)) {
    const computedStyle = computeStyle(node, inheritedStyle, rules, interactionState)
    const popoverExcluded = node instanceof HTMLElement &&
      node.popover !== null &&
      (node !== allowedPopover || node[getPopoverVisibilityState]() !== "showing")
    const style = popoverExcluded
      ? Object.freeze({...computedStyle, display: "none" as const})
      : computedStyle
    const tag = elementTag(node)
    const effectiveOpacity = inheritedOpacity * style.opacity
    const inheritedChanged =
      cached !== undefined &&
      (cached.style.color !== style.color ||
        cached.style.fontSize !== style.fontSize ||
        !sameLineHeight(cached.style.lineHeight, style.lineHeight) ||
        cached.style.letterSpacing !== style.letterSpacing ||
        cached.style.textAlign !== style.textAlign ||
        cached.style.whiteSpace !== style.whiteSpace ||
        cached.style.customProperties !== style.customProperties ||
        cached.effectiveOpacity !== effectiveOpacity)
    const forceChildren = force || subtreeDirty.has(node) || inheritedChanged
    const layoutNode: LayoutNode = {
      node,
      parent,
      style,
      effectiveOpacity,
      children: [],
      text: null,
      tag,
      transparent: false,
    }
    const children =
      style.display === "none" ||
        tag === "input" ||
        tag === "img" ||
        tag === "select" ||
        tag === "progress" ||
        tag === "meter" ||
        tag === "textarea"
        ? Object.freeze([])
        : Object.freeze(
            layoutChildNodes(node).map((child) =>
              buildLayoutTree(
                child,
                layoutNode,
                style,
                effectiveOpacity,
                rules,
                dirtyNodes,
                subtreeDirty,
                layoutCache,
                forceChildren,
                allowedPopover,
                popoverInheritedStyles,
                interactionState,
              ),
            ),
          )
    layoutNode.children = children
    layoutCache.set(node, layoutNode)
    return layoutNode
  }

  const layoutNode: LayoutNode = {
    node,
    parent,
    style: inheritedStyle,
    effectiveOpacity: inheritedOpacity,
    children: [],
    text: null,
    tag: null,
    transparent: true,
  }
  const children = Object.freeze(
    layoutChildNodes(node).map((child) =>
      buildLayoutTree(
        child,
        layoutNode,
        inheritedStyle,
        inheritedOpacity,
        rules,
        dirtyNodes,
        subtreeDirty,
        layoutCache,
        force || subtreeDirty.has(node),
        allowedPopover,
        popoverInheritedStyles,
        interactionState,
      ),
    ),
  )
  layoutNode.children = children
  layoutCache.set(node, layoutNode)
  return layoutNode
}

const measure = (
  layoutNode: LayoutNode,
  availableWidth: number,
  availableHeight: number,
  state: BuildState,
): Size => {
  const cached = measuredSize(layoutNode, availableWidth, availableHeight, state)
  if (cached) return cached

  if (layoutNode.style.display === "none")
    return rememberSize(layoutNode, availableWidth, availableHeight, 0, 0, state)

  if (layoutNode.text !== null) {
    const {width, height} = measureText(layoutNode.text, layoutNode.style)
    return rememberSize(
      layoutNode,
      availableWidth,
      availableHeight,
      width,
      height,
      state,
    )
  }

  if (layoutNode.transparent) {
    let width = 0
    let height = 0
    for (const child of flowChildren(layoutNode)) {
      const margin = child.style.margin
      const size = measure(
        child,
        Math.max(0, availableWidth - horizontal(margin)),
        Math.max(0, availableHeight - vertical(margin)),
        state,
      )
      width = Math.max(width, size.width + horizontal(margin))
      height += size.height + vertical(margin)
    }
    return rememberSize(
      layoutNode,
      availableWidth,
      availableHeight,
      width,
      height,
      state,
    )
  }

  const edgeWidth = horizontal(layoutNode.style.padding) +
    horizontal(layoutNode.style.borderWidths)
  const edgeHeight = vertical(layoutNode.style.padding) +
    vertical(layoutNode.style.borderWidths)
  const explicitWidth = resolveLength(layoutNode.style.width, availableWidth)
  const explicitHeight = resolveLength(layoutNode.style.height, availableHeight)
  const contentConstraintWidth = Math.max(
    0,
    explicitWidth === null
      ? availableWidth - edgeWidth
      : layoutNode.style.boxSizing === "content-box"
        ? explicitWidth
        : explicitWidth - edgeWidth,
  )
  const contentConstraintHeight = Math.max(
    0,
    explicitHeight === null
      ? availableHeight - edgeHeight
      : layoutNode.style.boxSizing === "content-box"
        ? explicitHeight
        : explicitHeight - edgeHeight,
  )
  const children = flowChildren(layoutNode)
  const rowFlex = layoutNode.style.display === "flex" &&
    layoutNode.style.flexDirection === "row"
  const wrappingMainAvailable = layoutNode.style.display === "flex" &&
    layoutNode.style.flexWrap !== "nowrap"
    ? definiteFlexMainSize(
        layoutNode,
        rowFlex,
        availableWidth,
        availableHeight,
        explicitWidth,
        explicitHeight,
        edgeWidth,
        edgeHeight,
      )
    : null
  const childConstraintWidth = rowFlex && wrappingMainAvailable !== null
    ? wrappingMainAvailable
    : contentConstraintWidth
  const childConstraintHeight = !rowFlex && wrappingMainAvailable !== null
    ? wrappingMainAvailable
    : contentConstraintHeight
  const childSizes = children.map((child) => {
    const margin = child.style.margin
    return measure(
      child,
      Math.max(0, childConstraintWidth - horizontal(margin)),
      Math.max(0, childConstraintHeight - vertical(margin)),
      state,
    )
  })

  let naturalContentWidth = 0
  let naturalContentHeight = 0
  const gap = layoutNode.style.display === "flex" ? layoutNode.style.gap : 0
  const gaps = Math.max(0, childSizes.length - 1) * gap

  if (
    layoutNode.style.display === "flex" &&
    layoutNode.style.flexWrap !== "nowrap" &&
    wrappingMainAvailable !== null
  ) {
    const wrappedContent = wrappedFlexContentSize(
      children,
      childSizes,
      rowFlex,
      wrappingMainAvailable,
      childConstraintWidth,
      childConstraintHeight,
      gap,
      state,
    )
    naturalContentWidth = wrappedContent.width
    naturalContentHeight = wrappedContent.height
  } else if (
    layoutNode.style.display === "inline" ||
    (layoutNode.style.display === "flex" &&
      layoutNode.style.flexDirection === "row")
  ) {
    naturalContentWidth = childSizes.reduce(
      (sum, child, index) =>
        sum + child.width + horizontal(children[index]?.style.margin ?? ZERO_EDGES),
      0,
    ) + gaps
    naturalContentHeight = childSizes.reduce(
      (height, child, index) =>
        Math.max(
          height,
          child.height + vertical(children[index]?.style.margin ?? ZERO_EDGES),
        ),
      0,
    )
  } else {
    naturalContentWidth = childSizes.reduce(
      (width, child, index) =>
        Math.max(
          width,
          child.width + horizontal(children[index]?.style.margin ?? ZERO_EDGES),
        ),
      0,
    )
    naturalContentHeight = childSizes.reduce(
      (sum, child, index) =>
        sum + child.height + vertical(children[index]?.style.margin ?? ZERO_EDGES),
      0,
    ) + gaps
  }

  const fillsAvailableWidth =
    layoutNode.style.display === "block" || layoutNode.style.display === "flex"
  const naturalBorderWidth = explicitWidth === null && fillsAvailableWidth
    ? availableWidth
    : borderBoxSize(explicitWidth, naturalContentWidth, edgeWidth, layoutNode.style.boxSizing)
  const naturalBorderHeight = borderBoxSize(
    explicitHeight,
    naturalContentHeight,
    edgeHeight,
    layoutNode.style.boxSizing,
  )
  const width = clampAxis(
    naturalBorderWidth,
    layoutNode.style.minWidth,
    layoutNode.style.maxWidth,
    availableWidth,
    edgeWidth,
    layoutNode.style.boxSizing,
  )
  const height = clampAxis(
    naturalBorderHeight,
    layoutNode.style.minHeight,
    layoutNode.style.maxHeight,
    availableHeight,
    edgeHeight,
    layoutNode.style.boxSizing,
  )

  return rememberSize(
    layoutNode,
    availableWidth,
    availableHeight,
    width,
    height,
    state,
  )
}

const flowChildren = (layoutNode: LayoutNode): readonly LayoutNode[] => {
  const children = layoutNode.children
  return children.some((child) => child.style.position === "absolute")
    ? children.filter((child) => child.style.position !== "absolute")
    : children
}

const definiteFlexMainSize = (
  node: LayoutNode,
  row: boolean,
  availableWidth: number,
  availableHeight: number,
  explicitWidth: number | null,
  explicitHeight: number | null,
  edgeWidth: number,
  edgeHeight: number,
): number | null => {
  if (!row && explicitHeight === null) return null
  const available = row ? availableWidth : availableHeight
  const explicit = row ? explicitWidth : explicitHeight
  const edge = row ? edgeWidth : edgeHeight
  const borderSize = explicit === null
    ? available
    : node.style.boxSizing === "content-box"
      ? explicit + edge
      : explicit
  const clamped = clampAxis(
    borderSize,
    row ? node.style.minWidth : node.style.minHeight,
    row ? node.style.maxWidth : node.style.maxHeight,
    available,
    edge,
    node.style.boxSizing,
  )
  return Math.max(0, clamped - edge)
}

const createFlexLines = (
  children: readonly LayoutNode[],
  childSizes: readonly Size[],
  baseSizes: readonly number[],
  row: boolean,
  mainAvailable: number,
  gap: number,
  wrap: boolean,
): readonly FlexLine[] => {
  const lines: FlexLine[] = []
  let indices: number[] = []
  let usedMain = 0
  let crossSize = 0

  const commit = (): void => {
    if (indices.length === 0) return
    lines.push(Object.freeze({
      indices: Object.freeze(indices),
      crossSize,
    }))
    indices = []
    usedMain = 0
    crossSize = 0
  }

  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    const measured = childSizes[index]
    if (!child || !measured) continue
    const margin = child.style.margin
    const mainOuter = (baseSizes[index] ?? 0) +
      (row ? horizontal(margin) : vertical(margin))
    const nextMain = indices.length === 0
      ? mainOuter
      : usedMain + gap + mainOuter
    if (wrap && indices.length > 0 && nextMain > mainAvailable) commit()
    usedMain = indices.length === 0 ? mainOuter : usedMain + gap + mainOuter
    indices.push(index)
    crossSize = Math.max(
      crossSize,
      (row ? measured.height : measured.width) +
        (row ? vertical(margin) : horizontal(margin)),
    )
  }
  commit()
  return Object.freeze(lines)
}

const wrappedFlexContentSize = (
  children: readonly LayoutNode[],
  childSizes: readonly Size[],
  row: boolean,
  mainAvailable: number,
  availableWidth: number,
  availableHeight: number,
  gap: number,
  state: BuildState,
): Size => {
  const baseSizes = children.map((child, index) =>
    flexBaseSize(
      child,
      row,
      mainAvailable,
      availableWidth,
      availableHeight,
      childSizes[index] ?? Object.freeze({width: 0, height: 0}),
      state,
    ),
  )
  const lines = createFlexLines(
    children,
    childSizes,
    baseSizes,
    row,
    mainAvailable,
    gap,
    true,
  )
  const naturalMain = lines.reduce((maximum, line) => {
    const lineMain = line.indices.reduce((sum, index, lineIndex) => {
      const child = children[index]
      const margin = child?.style.margin ?? ZERO_EDGES
      return sum +
        (baseSizes[index] ?? 0) +
        (row ? horizontal(margin) : vertical(margin)) +
        (lineIndex === 0 ? 0 : gap)
    }, 0)
    return Math.max(maximum, lineMain)
  }, 0)
  const naturalCross = lines.reduce(
    (sum, line, index) => sum + line.crossSize + (index === 0 ? 0 : gap),
    0,
  )
  return Object.freeze({
    width: row ? naturalMain : naturalCross,
    height: row ? naturalCross : naturalMain,
  })
}

const relativeAxisOffset = (
  start: CSSLength | null,
  end: CSSLength | null,
  basis: number,
): number => {
  const resolvedStart = resolveLength(start, basis)
  if (resolvedStart !== null) return resolvedStart
  const resolvedEnd = resolveLength(end, basis)
  return resolvedEnd === null ? 0 : -resolvedEnd
}

const composeTransform = (
  parent: RenderTransform,
  local: RenderTransform,
): RenderTransform => {
  if (local === IDENTITY_TRANSFORM) return parent
  const result = Object.freeze({
    scaleX: parent.scaleX * local.scaleX,
    scaleY: parent.scaleY * local.scaleY,
    translateX: parent.scaleX * local.translateX + parent.translateX,
    translateY: parent.scaleY * local.translateY + parent.translateY,
  })
  return isIdentityTransform(result) ? IDENTITY_TRANSFORM : result
}

const resolveElementTransform = (
  style: ComputedStyle,
  x: number,
  y: number,
  width: number,
  height: number,
): RenderTransform => {
  if (style.transform.length === 0) return IDENTITY_TRANSFORM
  let transform = IDENTITY_TRANSFORM
  for (const operation of style.transform) {
    const operationTransform: RenderTransform = operation.kind === "translate"
      ? Object.freeze({
          scaleX: 1,
          scaleY: 1,
          translateX: resolveLength(operation.x, width) ?? 0,
          translateY: resolveLength(operation.y, height) ?? 0,
        })
      : Object.freeze({
          scaleX: operation.x,
          scaleY: operation.y,
          translateX: 0,
          translateY: 0,
        })
    transform = composeTransform(transform, operationTransform)
  }
  const originX = x + (resolveLength(style.transformOrigin.x, width) ?? width / 2)
  const originY = y + (resolveLength(style.transformOrigin.y, height) ?? height / 2)
  const result = Object.freeze({
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    translateX: transform.translateX + originX - transform.scaleX * originX,
    translateY: transform.translateY + originY - transform.scaleY * originY,
  })
  return isIdentityTransform(result) ? IDENTITY_TRANSFORM : result
}

const isIdentityTransform = (transform: RenderTransform): boolean =>
  transform.scaleX === 1 && transform.scaleY === 1 &&
  transform.translateX === 0 && transform.translateY === 0

const sameLineHeight = (
  left: ComputedStyle["lineHeight"],
  right: ComputedStyle["lineHeight"],
): boolean => left === right || (
  left !== "normal" && right !== "normal" &&
  left.kind === right.kind && left.value === right.value
)

const transformPoint = (
  transform: RenderTransform,
  x: number,
  y: number,
): Readonly<{x: number; y: number}> => Object.freeze({
  x: transform.scaleX * x + transform.translateX,
  y: transform.scaleY * y + transform.translateY,
})

const transformBounds = (
  transform: RenderTransform,
  x: number,
  y: number,
  width: number,
  height: number,
): Readonly<{x: number; y: number; width: number; height: number}> => {
  const first = transformPoint(transform, x, y)
  const second = transformPoint(transform, x + width, y + height)
  return Object.freeze({
    x: Math.min(first.x, second.x),
    y: Math.min(first.y, second.y),
    width: Math.abs(second.x - first.x),
    height: Math.abs(second.y - first.y),
  })
}

const childPlacementContext = (
  layoutNode: LayoutNode,
  box: RenderBox,
  parent: PlacementContext,
  presentation: RenderTransform,
): PlacementContext => {
  const establishesAbsolute = layoutNode.style.position !== "static" &&
    (layoutNode.style.display === "block" || layoutNode.style.display === "flex")
  const hasRelativeChild = layoutNode.children.some(
    (child) => child.style.position === "relative",
  )
  if (!establishesAbsolute && !hasRelativeChild && presentation === parent.presentation) {
    return parent
  }
  const normal: ContainingBlock = Object.freeze({
    x: box.contentX,
    y: box.contentY,
    width: box.contentWidth,
    height: box.contentHeight,
  })
  const absolute = establishesAbsolute
    ? Object.freeze({
        x: box.x + box.border.widths.left,
        y: box.y + box.border.widths.top,
        width: Math.max(0, box.width - horizontal(box.border.widths)),
        height: Math.max(0, box.height - vertical(box.border.widths)),
      })
    : parent.absolute
  return Object.freeze({absolute, normal, presentation})
}

const placeAbsoluteChild = (
  child: LayoutNode,
  staticX: number,
  staticY: number,
  clips: readonly RenderClip[],
  depth: number,
  state: BuildState,
  context: PlacementContext,
): Size => {
  const containing = context.absolute
  const margin = child.style.margin
  const availableWidth = Math.max(0, containing.width - horizontal(margin))
  const availableHeight = Math.max(0, containing.height - vertical(margin))
  const left = resolveLength(child.style.left, containing.width)
  const right = resolveLength(child.style.right, containing.width)
  const top = resolveLength(child.style.top, containing.height)
  const bottom = resolveLength(child.style.bottom, containing.height)
  const measured = measure(child, availableWidth, availableHeight, state)
  const edgeWidth = horizontalBoxEdges(child.style)
  const edgeHeight = verticalBoxEdges(child.style)
  const width = child.style.width === null && left !== null && right !== null
    ? clampAxis(
        Math.max(0, containing.width - left - right - horizontal(margin)),
        child.style.minWidth,
        child.style.maxWidth,
        containing.width,
        edgeWidth,
        child.style.boxSizing,
      )
    : child.style.width === null
      ? intrinsicWidth(child, availableWidth, availableHeight, state)
      : measured.width
  const height = child.style.height === null && top !== null && bottom !== null
    ? clampAxis(
        Math.max(0, containing.height - top - bottom - vertical(margin)),
        child.style.minHeight,
        child.style.maxHeight,
        containing.height,
        edgeHeight,
        child.style.boxSizing,
      )
    : child.style.height === null
      ? intrinsicHeight(child, availableWidth, availableHeight, state)
      : measured.height
  const x = left !== null
    ? containing.x + left + margin.left
    : right !== null
      ? containing.x + containing.width - right - margin.right - width
      : staticX
  const y = top !== null
    ? containing.y + top + margin.top
    : bottom !== null
      ? containing.y + containing.height - bottom - margin.bottom - height
      : staticY
  return place(
    child,
    x,
    y,
    availableWidth,
    availableHeight,
    width,
    height,
    clips,
    depth,
    state,
    context,
  )
}

const place = (
  layoutNode: LayoutNode,
  x: number,
  y: number,
  availableWidth: number,
  availableHeight: number,
  forcedWidth: number | undefined,
  forcedHeight: number | undefined,
  clips: readonly RenderClip[],
  depth: number,
  state: BuildState,
  context: PlacementContext,
  applyRelativeOffset = true,
): Size => {
  if (layoutNode.style.display === "none")
    return Object.freeze({ width: 0, height: 0 })

  const measured = measure(layoutNode, availableWidth, availableHeight, state)
  const width = Math.max(0, forcedWidth ?? measured.width)
  const height = Math.max(0, forcedHeight ?? measured.height)
  if (applyRelativeOffset && layoutNode.style.position === "relative") {
    x += relativeAxisOffset(layoutNode.style.left, layoutNode.style.right, context.normal.width)
    y += relativeAxisOffset(layoutNode.style.top, layoutNode.style.bottom, context.normal.height)
  }
  const presentation = composeTransform(
    context.presentation,
    resolveElementTransform(layoutNode.style, x, y, width, height),
  )
  state.transforms.set(layoutNode.node, presentation)

  if (layoutNode.text !== null) {
    const box = createBox(
      layoutNode,
      x,
      y,
      width,
      height,
      ZERO_EDGES,
      ZERO_BORDER,
      depth,
      "inline",
      presentation,
    )
    state.boxes.push(box)
    state.boxByNode.set(layoutNode.node, box)
    emitTextItems(
      layoutNode,
      x,
      y,
      layoutNode.parent?.style.display === "block" ? availableWidth : width,
      clips,
      state,
    )
    return Object.freeze({ width, height })
  }

  if (layoutNode.transparent) {
    let childY = y
    let usedWidth = 0
    for (const child of layoutNode.children) {
      const margin = child.style.margin
      if (child.style.position === "absolute") {
        placeAbsoluteChild(
          child,
          x + margin.left,
          childY + margin.top,
          clips,
          depth,
          state,
          context,
        )
        continue
      }
      const childAvailableWidth = Math.max(0, availableWidth - horizontal(margin))
      const childAvailableHeight = Math.max(0, availableHeight - vertical(margin))
      const childSize = measure(child, childAvailableWidth, childAvailableHeight, state)
      const size = place(
        child,
        x + margin.left,
        childY + margin.top,
        childAvailableWidth,
        childAvailableHeight,
        childSize.width,
        childSize.height,
        clips,
        depth,
        state,
        context,
      )
      childY += margin.top + size.height + margin.bottom
      usedWidth = Math.max(usedWidth, margin.left + size.width + margin.right)
    }
    return Object.freeze({ width: usedWidth, height: childY - y })
  }

  const border = resolveBorder(layoutNode.style, width, height)
  const padding = layoutNode.style.padding
  const contentX = x + border.widths.left + padding.left
  const contentY = y + border.widths.top + padding.top
  const contentWidth = Math.max(
    0,
    width - horizontal(border.widths) - horizontal(padding),
  )
  const contentHeight = Math.max(
    0,
    height - vertical(border.widths) - vertical(padding),
  )
  const display =
    layoutNode.style.display === "inline" ? "inline" : layoutNode.style.display
  const box = createBox(
    layoutNode,
    x,
    y,
    width,
    height,
    padding,
    border,
    depth,
    display,
    presentation,
  )
  state.boxes.push(box)
  state.boxByNode.set(layoutNode.node, box)

  emitBoxShadow(layoutNode, box, clips, state)
  if (hasRectPaint(layoutNode.style.background, border) && width > 0 && height > 0) {
    state.displayList.push(
      Object.freeze({
        kind: "rect",
        key: "background",
        node: layoutNode.node,
        x,
        y,
        width,
        height,
        color: layoutNode.style.background ?? "transparent",
        opacity: layoutNode.effectiveOpacity,
        border,
        shadow: null,
        clips,
        transform: presentation,
      }),
    )
  }

  if (isElement(layoutNode.node)) {
    state.hits.set(
      layoutNode.node,
      createHit(
        layoutNode.node,
        layoutNode.tag ?? "",
        x,
        y,
        width,
        height,
        clips,
        presentation,
      ),
    )
    state.hitOrder.push(layoutNode.node)
  }

  const descendantClips = appendOverflowClip(
    clips,
    layoutNode.style,
    x,
    y,
    width,
    height,
    border,
    presentation,
  )
  const descendantBoxStart = state.boxes.length
  const descendantDisplayStart = state.displayList.length
  emitReplacedControlPresentation(layoutNode, box, descendantClips, state)
  const childrenContext = childPlacementContext(layoutNode, box, context, presentation)

  if (layoutNode.style.display === "flex") {
    placeFlexChildren(
      layoutNode,
      contentX,
      contentY,
      contentWidth,
      contentHeight,
      descendantClips,
      depth + 1,
      state,
      childrenContext,
    )
  } else if (layoutNode.style.display === "inline") {
    let childX = contentX
    const stackSlices: StackSlice[] | null = requiresChildStackingReorder(layoutNode)
      ? []
      : null
    for (let index = 0; index < layoutNode.children.length; index++) {
      const child = layoutNode.children[index]
      if (!child) continue
      const margin = child.style.margin
      const displayStart = stackSlices === null ? 0 : state.displayList.length
      const hitStart = stackSlices === null ? 0 : state.hitOrder.length
      if (child.style.position === "absolute") {
        placeAbsoluteChild(
          child,
          childX + margin.left,
          contentY + margin.top,
          descendantClips,
          depth + 1,
          state,
          childrenContext,
        )
        stackSlices?.push(childStackSlice(layoutNode, child, index, displayStart, hitStart, state))
        continue
      }
      const childAvailableWidth = Math.max(0, contentWidth - horizontal(margin))
      const childAvailableHeight = Math.max(0, contentHeight - vertical(margin))
      const childSize = measure(child, childAvailableWidth, childAvailableHeight, state)
      place(
        child,
        childX + margin.left,
        contentY + margin.top,
        childAvailableWidth,
        childAvailableHeight,
        childSize.width,
        childSize.height,
        descendantClips,
        depth + 1,
        state,
        childrenContext,
      )
      stackSlices?.push(childStackSlice(layoutNode, child, index, displayStart, hitStart, state))
      childX += margin.left + childSize.width + margin.right
    }
    if (stackSlices !== null) reorderChildStacking(stackSlices, state)
  } else {
    let childY = contentY
    const stackSlices: StackSlice[] | null = requiresChildStackingReorder(layoutNode)
      ? []
      : null
    for (let index = 0; index < layoutNode.children.length; index++) {
      const child = layoutNode.children[index]
      if (!child) continue
      const margin = child.style.margin
      const displayStart = stackSlices === null ? 0 : state.displayList.length
      const hitStart = stackSlices === null ? 0 : state.hitOrder.length
      if (child.style.position === "absolute") {
        placeAbsoluteChild(
          child,
          contentX + margin.left,
          childY + margin.top,
          descendantClips,
          depth + 1,
          state,
          childrenContext,
        )
        stackSlices?.push(childStackSlice(layoutNode, child, index, displayStart, hitStart, state))
        continue
      }
      const childAvailableWidth = Math.max(0, contentWidth - horizontal(margin))
      const childAvailableHeight = Math.max(0, contentHeight - vertical(margin))
      const childSize = measure(child, childAvailableWidth, childAvailableHeight, state)
      place(
        child,
        contentX + margin.left,
        childY + margin.top,
        childAvailableWidth,
        childAvailableHeight,
        childSize.width,
        childSize.height,
        descendantClips,
        depth + 1,
        state,
        childrenContext,
      )
      stackSlices?.push(childStackSlice(layoutNode, child, index, displayStart, hitStart, state))
      childY += margin.top + childSize.height + margin.bottom
    }
    if (stackSlices !== null) reorderChildStacking(stackSlices, state)
  }

  projectElementScroll(
    layoutNode,
    x,
    y,
    width,
    height,
    border,
    clips,
    descendantClips,
    descendantBoxStart,
    descendantDisplayStart,
    state,
  )

  return Object.freeze({ width, height })
}

const placeFlexChildren = (
  layoutNode: LayoutNode,
  x: number,
  y: number,
  width: number,
  height: number,
  clips: readonly RenderClip[],
  depth: number,
  state: BuildState,
  context: PlacementContext,
): void => {
  const stackSlices: StackSlice[] | null = requiresChildStackingReorder(layoutNode)
    ? []
    : null
  const row = layoutNode.style.flexDirection === "row"
  const mainAvailable = row ? width : height
  const crossAvailable = row ? height : width
  const baseGap = layoutNode.style.gap
  const wrap = layoutNode.style.flexWrap !== "nowrap"
  const wrapReverse = layoutNode.style.flexWrap === "wrap-reverse"
  const children = flowChildren(layoutNode)
  const childSizes = children.map((child) => {
    const margin = child.style.margin
    return measure(
      child,
      Math.max(0, width - horizontal(margin)),
      Math.max(0, height - vertical(margin)),
      state,
    )
  })
  const baseSizes = children.map((child, index) =>
    flexBaseSize(
      child,
      row,
      mainAvailable,
      width,
      height,
      childSizes[index] ?? Object.freeze({ width: 0, height: 0 }),
      state,
    ),
  )
  const lines = createFlexLines(
    children,
    childSizes,
    baseSizes,
    row,
    mainAvailable,
    baseGap,
    wrap,
  )
  let crossCursor = wrapReverse
    ? (row ? y : x) + crossAvailable
    : row ? y : x
  let treeCursor = 0
  for (const line of lines) {
    const lineChildren = line.indices.map((index) => children[index]!)
    const lineBases = line.indices.map((index) => baseSizes[index] ?? 0)
    const lineMainMargins = lineChildren.map((child) =>
      row ? horizontal(child.style.margin) : vertical(child.style.margin),
    )
    const baseOuter = lineBases.reduce(
      (sum, size, index) => sum + size + (lineMainMargins[index] ?? 0),
      0,
    )
    const gapTotal = Math.max(0, lineChildren.length - 1) * baseGap
    const freeSpace = mainAvailable - baseOuter - gapTotal
    const mainSizes = distributeFlexSpace(
      lineChildren,
      lineBases,
      freeSpace,
      row,
      mainAvailable,
      width,
      height,
      state,
    )
    const usedOuter = mainSizes.reduce(
      (sum, size, index) => sum + size + (lineMainMargins[index] ?? 0),
      0,
    ) + gapTotal
    const justify = justifyOffsets(
      layoutNode.style.justifyContent,
      Math.max(0, mainAvailable - usedOuter),
      lineChildren.length,
    )
    const lineCrossSize = wrap ? line.crossSize : crossAvailable
    const lineCrossStart = wrapReverse
      ? crossCursor - lineCrossSize
      : crossCursor
    let mainCursor = (row ? x : y) + justify.offset

    for (let lineIndex = 0; lineIndex < line.indices.length; lineIndex++) {
      const index = line.indices[lineIndex]
      if (index === undefined) continue
      const child = children[index]
      const measured = childSizes[index]
      const mainSize = mainSizes[lineIndex]
      if (!child || !measured || mainSize === undefined) continue
      const margin = child.style.margin
      const crossMargins = row
        ? margin.top + margin.bottom
        : margin.left + margin.right
      const measuredCross = row ? measured.height : measured.width
      const stretch = layoutNode.style.alignItems === "stretch" &&
        crossSizeIsAuto(child, row)
      const crossSize = stretch
        ? clampCrossSize(
            child,
            row,
            Math.max(0, lineCrossSize - crossMargins),
            lineCrossSize,
          )
        : measuredCross
      const crossPosition = alignCrossPosition(
        layoutNode.style.alignItems,
        lineCrossStart,
        lineCrossSize,
        crossSize,
        row ? margin.top : margin.left,
        row ? margin.bottom : margin.right,
      )
      const mainStartMargin = row ? margin.left : margin.top
      const mainEndMargin = row ? margin.right : margin.bottom
      mainCursor += mainStartMargin
      while (layoutNode.children[treeCursor] !== child) treeCursor += 1
      const treeIndex = treeCursor++

      const displayStart = stackSlices === null ? 0 : state.displayList.length
      const hitStart = stackSlices === null ? 0 : state.hitOrder.length
      place(
        child,
        row ? mainCursor : crossPosition,
        row ? crossPosition : mainCursor,
        Math.max(0, width - horizontal(margin)),
        Math.max(0, height - vertical(margin)),
        row ? mainSize : crossSize,
        row ? crossSize : mainSize,
        clips,
        depth,
        state,
        context,
      )
      stackSlices?.push({
        treeIndex,
        level: stackingLevel(layoutNode, child),
        displayStart,
        displayEnd: state.displayList.length,
        hitStart,
        hitEnd: state.hitOrder.length,
      })
      mainCursor += mainSize + mainEndMargin + baseGap + justify.extraGap
    }
    crossCursor = wrapReverse
      ? lineCrossStart - baseGap
      : lineCrossStart + lineCrossSize + baseGap
  }

  for (let index = 0; index < layoutNode.children.length; index++) {
    const child = layoutNode.children[index]
    if (!child || child.style.position !== "absolute") continue
    const staticPosition = flexAbsoluteStaticPosition(child, layoutNode, x, y, width, height, state)
    const displayStart = stackSlices === null ? 0 : state.displayList.length
    const hitStart = stackSlices === null ? 0 : state.hitOrder.length
    placeAbsoluteChild(
      child,
      staticPosition.x,
      staticPosition.y,
      clips,
      depth,
      state,
      context,
    )
    stackSlices?.push({
      treeIndex: index,
      level: stackingLevel(layoutNode, child),
      displayStart,
      displayEnd: state.displayList.length,
      hitStart,
      hitEnd: state.hitOrder.length,
    })
  }
  if (stackSlices !== null) reorderChildStacking(stackSlices, state)
}

const requiresChildStackingReorder = (parent: LayoutNode): boolean => {
  if (
    parent.style.display === "flex" &&
    parent.children.some((child) => child.style.position === "absolute")
  ) return true
  return parent.children.some((child) => {
    const applies = parent.style.display === "flex" || child.style.position !== "static"
    return applies && child.style.zIndex !== "auto" && child.style.zIndex !== 0
  })
}

const stackingLevel = (parent: LayoutNode, child: LayoutNode): number => {
  const zIndexApplies = parent.style.display === "flex" || child.style.position !== "static"
  return zIndexApplies && child.style.zIndex !== "auto" ? child.style.zIndex : 0
}

const flexAbsoluteStaticPosition = (
  child: LayoutNode,
  parent: LayoutNode,
  x: number,
  y: number,
  width: number,
  height: number,
  state: BuildState,
): Readonly<{x: number; y: number}> => {
  const margin = child.style.margin
  const availableWidth = Math.max(0, width - horizontal(margin))
  const availableHeight = Math.max(0, height - vertical(margin))
  const measured = measure(child, availableWidth, availableHeight, state)
  const childWidth = child.style.width === null
    ? intrinsicWidth(child, availableWidth, availableHeight, state)
    : measured.width
  const childHeight = child.style.height === null
    ? intrinsicHeight(child, availableWidth, availableHeight, state)
    : measured.height
  const row = parent.style.flexDirection === "row"
  const mainAvailable = row ? width : height
  const mainSize = row ? childWidth : childHeight
  const mainMargins = row ? horizontal(margin) : vertical(margin)
  const mainOffset = justifyOffsets(
    parent.style.justifyContent,
    Math.max(0, mainAvailable - mainSize - mainMargins),
    1,
  ).offset
  const crossPosition = alignCrossPosition(
    parent.style.alignItems,
    row ? y : x,
    row ? height : width,
    row ? childHeight : childWidth,
    row ? margin.top : margin.left,
    row ? margin.bottom : margin.right,
  )
  return row
    ? Object.freeze({x: x + mainOffset + margin.left, y: crossPosition})
    : Object.freeze({x: crossPosition, y: y + mainOffset + margin.top})
}

type StackSlice = Readonly<{
  treeIndex: number
  level: number
  displayStart: number
  displayEnd: number
  hitStart: number
  hitEnd: number
}>

const childStackSlice = (
  parent: LayoutNode,
  child: LayoutNode,
  treeIndex: number,
  displayStart: number,
  hitStart: number,
  state: BuildState,
): StackSlice => Object.freeze({
  treeIndex,
  level: stackingLevel(parent, child),
  displayStart,
  displayEnd: state.displayList.length,
  hitStart,
  hitEnd: state.hitOrder.length,
})

const reorderChildStacking = (
  slices: readonly StackSlice[],
  state: BuildState,
): void => {
  if (slices.length < 2) return
  const ordered = [...slices].sort((left, right) =>
    left.level - right.level || left.treeIndex - right.treeIndex
  )
  if (ordered.every((slice, index) => slice === slices[index])) return

  const displayStart = slices[0]!.displayStart
  const displayEnd = slices.at(-1)!.displayEnd
  const nextDisplay = ordered.flatMap((slice) =>
    state.displayList.slice(slice.displayStart, slice.displayEnd)
  )
  state.displayList.splice(
    displayStart,
    displayEnd - displayStart,
    ...nextDisplay,
  )

  const hitStart = slices[0]!.hitStart
  const hitEnd = slices.at(-1)!.hitEnd
  const nextHits = ordered.flatMap((slice) =>
    state.hitOrder.slice(slice.hitStart, slice.hitEnd)
  )
  state.hitOrder.splice(hitStart, hitEnd - hitStart, ...nextHits)
}

const flexBaseSize = (
  node: LayoutNode,
  row: boolean,
  mainAvailable: number,
  availableWidth: number,
  availableHeight: number,
  measured: Size,
  state: BuildState,
): number => {
  const basis = resolveLength(node.style.flexBasis, mainAvailable)
  if (basis !== null) {
    const edge = row ? horizontalBoxEdges(node.style) : verticalBoxEdges(node.style)
    const borderSize = node.style.boxSizing === "content-box" ? basis + edge : basis
    return clampMainSize(node, row, borderSize, mainAvailable)
  }
  if (row && node.style.width === null)
    return intrinsicWidth(node, availableWidth, availableHeight, state)
  if (!row && node.style.height === null)
    return intrinsicHeight(node, availableWidth, availableHeight, state)
  return row ? measured.width : measured.height
}

const distributeFlexSpace = (
  children: readonly LayoutNode[],
  bases: readonly number[],
  freeSpace: number,
  row: boolean,
  mainAvailable: number,
  availableWidth: number,
  availableHeight: number,
  state: BuildState,
): readonly number[] => {
  const automaticMinimums = children.map((child) =>
    automaticMainMinimum(
      child,
      row,
      availableWidth,
      availableHeight,
      state,
    ),
  )
  if (freeSpace >= 0) {
    const totalGrow = children.reduce((sum, child) => sum + child.style.flexGrow, 0)
    return Object.freeze(
      bases.map((base, index) => {
        const child = children[index]
        const growth = child && totalGrow > 0
          ? freeSpace * (child.style.flexGrow / totalGrow)
          : 0
        return child
          ? clampMainSize(
              child,
              row,
              base + growth,
              mainAvailable,
              automaticMinimums[index] ?? 0,
            )
          : base
      }),
    )
  }

  const target = Math.max(0, bases.reduce((sum, base) => sum + base, 0) + freeSpace)
  const sizes = [...bases]
  for (let pass = 0; pass <= children.length; pass++) {
    const deficit = sizes.reduce((sum, size) => sum + size, 0) - target
    if (deficit <= 1e-9) break
    const weights = sizes.map((size, index) => {
      const minimum = automaticMinimums[index] ?? 0
      const child = children[index]
      return child && size > minimum
        ? size * child.style.flexShrink
        : 0
    })
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    if (totalWeight <= 0) break
    let changed = false
    for (let index = 0; index < sizes.length; index++) {
      const child = children[index]
      const size = sizes[index]
      if (!child || size === undefined) continue
      const shrink = deficit * ((weights[index] ?? 0) / totalWeight)
      const next = clampMainSize(
        child,
        row,
        Math.max(0, size - shrink),
        mainAvailable,
        automaticMinimums[index] ?? 0,
      )
      if (next !== size) changed = true
      sizes[index] = next
    }
    if (!changed) break
  }
  return Object.freeze(sizes)
}

const automaticMainMinimum = (
  node: LayoutNode,
  row: boolean,
  availableWidth: number,
  availableHeight: number,
  state: BuildState,
): number => {
  const explicitMinimum = row ? node.style.minWidth : node.style.minHeight
  if (explicitMinimum !== null) return 0
  return row
    ? intrinsicWidth(node, availableWidth, availableHeight, state)
    : intrinsicHeight(node, availableWidth, availableHeight, state)
}

const intrinsicWidth = (
  node: LayoutNode,
  availableWidth: number,
  availableHeight: number,
  state: BuildState,
): number => {
  if (node.text !== null)
    return measure(node, availableWidth, availableHeight, state).width
  if (node.transparent) {
    return flowChildren(node).reduce(
      (maximum, child) =>
        Math.max(
          maximum,
          intrinsicWidth(child, availableWidth, availableHeight, state) +
            horizontal(child.style.margin),
        ),
      0,
    )
  }

  const explicit = resolveLength(node.style.width, availableWidth)
  const edge = horizontalBoxEdges(node.style)
  if (explicit !== null) {
    const borderSize = node.style.boxSizing === "content-box" ? explicit + edge : explicit
    return clampAxis(
      borderSize,
      node.style.minWidth,
      node.style.maxWidth,
      availableWidth,
      edge,
      node.style.boxSizing,
    )
  }

  const wrappedContent = intrinsicWrappedFlexContent(
    node,
    availableWidth,
    availableHeight,
    state,
  )
  if (wrappedContent !== null) {
    return clampAxis(
      wrappedContent.width + edge,
      node.style.minWidth,
      node.style.maxWidth,
      availableWidth,
      edge,
      node.style.boxSizing,
    )
  }

  const children = flowChildren(node)
  const childWidths = children.map(
    (child) =>
      intrinsicWidth(child, availableWidth, availableHeight, state) +
      horizontal(child.style.margin),
  )
  const content =
    node.style.display === "inline" ||
    (node.style.display === "flex" && node.style.flexDirection === "row")
      ? childWidths.reduce((sum, value) => sum + value, 0) +
        Math.max(0, childWidths.length - 1) * node.style.gap
      : childWidths.reduce((maximum, value) => Math.max(maximum, value), 0)
  return clampAxis(
    content + edge,
    node.style.minWidth,
    node.style.maxWidth,
    availableWidth,
    edge,
    node.style.boxSizing,
  )
}

const intrinsicHeight = (
  node: LayoutNode,
  availableWidth: number,
  availableHeight: number,
  state: BuildState,
): number => {
  if (node.text !== null)
    return measure(node, availableWidth, availableHeight, state).height
  if (node.transparent) {
    return flowChildren(node).reduce(
      (sum, child) =>
        sum +
        intrinsicHeight(child, availableWidth, availableHeight, state) +
        vertical(child.style.margin),
      0,
    )
  }

  const declared = node.style.height
  const explicit = declared?.unit === "percent"
    ? null
    : resolveLength(declared, availableHeight)
  const edge = verticalBoxEdges(node.style)
  if (explicit !== null) {
    const borderSize = node.style.boxSizing === "content-box" ? explicit + edge : explicit
    return clampAxis(
      borderSize,
      node.style.minHeight,
      node.style.maxHeight,
      availableHeight,
      edge,
      node.style.boxSizing,
    )
  }

  const wrappedContent = intrinsicWrappedFlexContent(
    node,
    availableWidth,
    availableHeight,
    state,
  )
  if (wrappedContent !== null) {
    return clampAxis(
      wrappedContent.height + edge,
      node.style.minHeight,
      node.style.maxHeight,
      availableHeight,
      edge,
      node.style.boxSizing,
    )
  }

  const children = flowChildren(node)
  const childHeights = children.map(
    (child) =>
      intrinsicHeight(child, availableWidth, availableHeight, state) +
      vertical(child.style.margin),
  )
  const content =
    node.style.display === "inline" ||
    (node.style.display === "flex" && node.style.flexDirection === "row")
      ? childHeights.reduce((maximum, value) => Math.max(maximum, value), 0)
      : childHeights.reduce((sum, value) => sum + value, 0) +
        Math.max(0, childHeights.length - 1) * node.style.gap
  return clampAxis(
    content + edge,
    node.style.minHeight,
    node.style.maxHeight,
    availableHeight,
    edge,
    node.style.boxSizing,
  )
}

const intrinsicWrappedFlexContent = (
  node: LayoutNode,
  availableWidth: number,
  availableHeight: number,
  state: BuildState,
): Size | null => {
  if (node.style.display !== "flex" || node.style.flexWrap === "nowrap") return null
  const row = node.style.flexDirection === "row"
  const edgeWidth = horizontalBoxEdges(node.style)
  const edgeHeight = verticalBoxEdges(node.style)
  const explicitWidth = resolveLength(node.style.width, availableWidth)
  const explicitHeight = resolveLength(node.style.height, availableHeight)
  const mainAvailable = definiteFlexMainSize(
    node,
    row,
    availableWidth,
    availableHeight,
    explicitWidth,
    explicitHeight,
    edgeWidth,
    edgeHeight,
  )
  if (mainAvailable === null) return null
  const contentWidth = row
    ? mainAvailable
    : Math.max(
        0,
        explicitWidth === null
          ? availableWidth - edgeWidth
          : node.style.boxSizing === "content-box"
            ? explicitWidth
            : explicitWidth - edgeWidth,
      )
  const contentHeight = row
    ? Math.max(
        0,
        explicitHeight === null
          ? availableHeight - edgeHeight
          : node.style.boxSizing === "content-box"
            ? explicitHeight
            : explicitHeight - edgeHeight,
      )
    : mainAvailable
  const children = flowChildren(node)
  const childSizes = children.map((child) => {
    const margin = child.style.margin
    return measure(
      child,
      Math.max(0, contentWidth - horizontal(margin)),
      Math.max(0, contentHeight - vertical(margin)),
      state,
    )
  })
  return wrappedFlexContentSize(
    children,
    childSizes,
    row,
    mainAvailable,
    contentWidth,
    contentHeight,
    node.style.gap,
    state,
  )
}

const justifyOffsets = (
  justify: ComputedStyle["justifyContent"],
  free: number,
  count: number,
): Readonly<{ offset: number; extraGap: number }> => {
  switch (justify) {
    case "center":
      return Object.freeze({ offset: free / 2, extraGap: 0 })
    case "flex-end":
      return Object.freeze({ offset: free, extraGap: 0 })
    case "space-between":
      return Object.freeze({
        offset: 0,
        extraGap: count > 1 ? free / (count - 1) : 0,
      })
    case "space-around": {
      const space = count > 0 ? free / count : 0
      return Object.freeze({ offset: space / 2, extraGap: space })
    }
    case "space-evenly": {
      const space = free / (count + 1)
      return Object.freeze({ offset: space, extraGap: space })
    }
    default:
      return Object.freeze({ offset: 0, extraGap: 0 })
  }
}

const alignCrossPosition = (
  align: ComputedStyle["alignItems"],
  start: number,
  available: number,
  size: number,
  startMargin: number,
  endMargin: number,
): number => {
  const free = available - size - startMargin - endMargin
  switch (align) {
    case "center":
      return start + startMargin + free / 2
    case "flex-end":
      return start + available - endMargin - size
    default:
      return start + startMargin
  }
}

const crossSizeIsAuto = (node: LayoutNode, row: boolean): boolean =>
  !node.transparent && node.text === null &&
  (row ? node.style.height === null : node.style.width === null)

const clampCrossSize = (
  node: LayoutNode,
  row: boolean,
  size: number,
  available: number,
): number =>
  row
    ? clampAxis(
        size,
        node.style.minHeight,
        node.style.maxHeight,
        available,
        verticalBoxEdges(node.style),
        node.style.boxSizing,
      )
    : clampAxis(
        size,
        node.style.minWidth,
        node.style.maxWidth,
        available,
        horizontalBoxEdges(node.style),
        node.style.boxSizing,
      )

const clampMainSize = (
  node: LayoutNode,
  row: boolean,
  size: number,
  available: number,
  automaticMinimum = 0,
): number =>
  Math.max(
    automaticMinimum,
    row
    ? clampAxis(
        size,
        node.style.minWidth,
        node.style.maxWidth,
        available,
        horizontalBoxEdges(node.style),
        node.style.boxSizing,
      )
    : clampAxis(
        size,
        node.style.minHeight,
        node.style.maxHeight,
        available,
        verticalBoxEdges(node.style),
        node.style.boxSizing,
      )
  )

const borderBoxSize = (
  explicit: number | null,
  naturalContent: number,
  edge: number,
  boxSizing: ComputedStyle["boxSizing"],
): number => {
  if (explicit === null) return naturalContent + edge
  return boxSizing === "content-box" ? explicit + edge : Math.max(0, explicit)
}

const clampAxis = (
  size: number,
  minimum: CSSLength | null,
  maximum: CSSLength | null,
  available: number,
  edge: number,
  boxSizing: ComputedStyle["boxSizing"],
): number => {
  const resolvedMinimum = resolveLength(minimum, available)
  const resolvedMaximum = resolveLength(maximum, available)
  const minimumBorder = resolvedMinimum === null
    ? 0
    : boxSizing === "content-box"
      ? resolvedMinimum + edge
      : resolvedMinimum
  const maximumBorder = resolvedMaximum === null
    ? Number.POSITIVE_INFINITY
    : boxSizing === "content-box"
      ? resolvedMaximum + edge
      : resolvedMaximum
  return Math.max(minimumBorder, Math.min(Math.max(0, maximumBorder), Math.max(0, size)))
}

const resolveBorder = (
  style: ComputedStyle,
  width: number,
  height: number,
): RenderBorder => {
  const basis = Math.min(width, height)
  const raw = {
    topLeft: resolveLength(style.borderRadii.topLeft, basis) ?? 0,
    topRight: resolveLength(style.borderRadii.topRight, basis) ?? 0,
    bottomRight: resolveLength(style.borderRadii.bottomRight, basis) ?? 0,
    bottomLeft: resolveLength(style.borderRadii.bottomLeft, basis) ?? 0,
  }
  const radii = normalizeCornerRadii(width, height, raw)
  return Object.freeze({
    widths: style.borderWidths,
    colors: style.borderColors,
    radii,
  })
}

const normalizeCornerRadii = (
  width: number,
  height: number,
  raw: RenderCornerRadii,
): RenderCornerRadii => {
  const factor = Math.min(
    1,
    radiusFactor(width, raw.topLeft + raw.topRight),
    radiusFactor(width, raw.bottomLeft + raw.bottomRight),
    radiusFactor(height, raw.topLeft + raw.bottomLeft),
    radiusFactor(height, raw.topRight + raw.bottomRight),
  )
  const radii = Object.freeze({
    topLeft: raw.topLeft * factor,
    topRight: raw.topRight * factor,
    bottomRight: raw.bottomRight * factor,
    bottomLeft: raw.bottomLeft * factor,
  })
  return radii
}

const radiusFactor = (available: number, sum: number): number =>
  sum > 0 ? available / sum : 1

const appendOverflowClip = (
  inherited: readonly RenderClip[],
  style: ComputedStyle,
  x: number,
  y: number,
  width: number,
  height: number,
  border: RenderBorder,
  transform: RenderTransform,
): readonly RenderClip[] => {
  const clipX = style.overflowX !== "visible"
  const clipY = style.overflowY !== "visible"
  if (!clipX && !clipY) return inherited

  const clipWidth = Math.max(0, width - horizontal(border.widths))
  const clipHeight = Math.max(0, height - vertical(border.widths))
  const rawRadii: RenderClipCornerRadii = clipX && clipY
    ? Object.freeze({
        topLeft: Object.freeze({
          x: Math.max(0, border.radii.topLeft - border.widths.left),
          y: Math.max(0, border.radii.topLeft - border.widths.top),
        }),
        topRight: Object.freeze({
          x: Math.max(0, border.radii.topRight - border.widths.right),
          y: Math.max(0, border.radii.topRight - border.widths.top),
        }),
        bottomRight: Object.freeze({
          x: Math.max(0, border.radii.bottomRight - border.widths.right),
          y: Math.max(0, border.radii.bottomRight - border.widths.bottom),
        }),
        bottomLeft: Object.freeze({
          x: Math.max(0, border.radii.bottomLeft - border.widths.left),
          y: Math.max(0, border.radii.bottomLeft - border.widths.bottom),
        }),
      })
    : ZERO_CLIP_RADII
  const clip: RenderClip = Object.freeze({
    x: x + border.widths.left,
    y: y + border.widths.top,
    width: clipWidth,
    height: clipHeight,
    radii: normalizeClipRadii(clipWidth, clipHeight, rawRadii),
    clipX,
    clipY,
    transform,
  })
  return Object.freeze([...inherited, clip])
}

const normalizeClipRadii = (
  width: number,
  height: number,
  raw: RenderClipCornerRadii,
): RenderClipCornerRadii => {
  const factor = Math.min(
    1,
    radiusFactor(width, raw.topLeft.x + raw.topRight.x),
    radiusFactor(width, raw.bottomLeft.x + raw.bottomRight.x),
    radiusFactor(height, raw.topLeft.y + raw.bottomLeft.y),
    radiusFactor(height, raw.topRight.y + raw.bottomRight.y),
  )
  const scale = (radius: RenderClipCornerRadii["topLeft"]) =>
    Object.freeze({x: radius.x * factor, y: radius.y * factor})
  return Object.freeze({
    topLeft: scale(raw.topLeft),
    topRight: scale(raw.topRight),
    bottomRight: scale(raw.bottomRight),
    bottomLeft: scale(raw.bottomLeft),
  })
}

const projectElementScroll = (
  layoutNode: LayoutNode,
  x: number,
  y: number,
  width: number,
  height: number,
  border: RenderBorder,
  chromeClips: readonly RenderClip[],
  descendantClips: readonly RenderClip[],
  descendantBoxStart: number,
  descendantDisplayStart: number,
  state: BuildState,
): void => {
  if (!isElement(layoutNode.node) || !(layoutNode.node instanceof HTMLElement))
    return
  const scrollableX = scrollableOverflow(layoutNode.style.overflowX)
  const scrollableY = scrollableOverflow(layoutNode.style.overflowY)
  if (!scrollableX && !scrollableY) return

  const clientX = x + border.widths.left
  const clientY = y + border.widths.top
  const clientWidth = Math.max(0, width - horizontal(border.widths))
  const clientHeight = Math.max(0, height - vertical(border.widths))
  const descendantRight = descendantOverflowEnd(
    layoutNode.children,
    "x",
    presentationFor(layoutNode.node, state),
    state,
  )
  const descendantBottom = descendantOverflowEnd(
    layoutNode.children,
    "y",
    presentationFor(layoutNode.node, state),
    state,
  )
  const contentRight = Math.max(
    clientX + clientWidth,
    descendantRight + layoutNode.style.padding.right,
  )
  const contentBottom = Math.max(
    clientY + clientHeight,
    descendantBottom + layoutNode.style.padding.bottom,
  )
  const scrollWidth = Math.max(clientWidth, contentRight - clientX)
  const scrollHeight = Math.max(clientHeight, contentBottom - clientY)
  const maxScrollLeft = scrollableX
    ? Math.max(0, scrollWidth - clientWidth)
    : 0
  const maxScrollTop = scrollableY
    ? Math.max(0, scrollHeight - clientHeight)
    : 0
  const requestedScrollLeft = layoutNode.node.scrollLeft
  const requestedScrollTop = layoutNode.node.scrollTop
  const scrollLeft = Math.min(maxScrollLeft, requestedScrollLeft)
  const scrollTop = Math.min(maxScrollTop, requestedScrollTop)
  const metrics: RenderScrollMetrics = Object.freeze({
    node: layoutNode.node,
    clientWidth,
    clientHeight,
    scrollWidth,
    scrollHeight,
    requestedScrollLeft,
    requestedScrollTop,
    scrollLeft,
    scrollTop,
    maxScrollLeft,
    maxScrollTop,
  })
  state.scrolls.set(layoutNode.node, metrics)
  if (scrollLeft !== 0 || scrollTop !== 0) {
    const ownClip = descendantClips.at(-1)
    if (ownClip) {
      const ownerTransform = presentationFor(layoutNode.node, state)
      shiftDescendantBoxes(
        descendantBoxStart,
        scrollLeft,
        scrollTop,
        ownerTransform,
        state,
      )
      shiftDescendantDisplay(
        descendantDisplayStart,
        ownClip,
        scrollLeft,
        scrollTop,
        ownerTransform,
        state,
      )
      shiftDescendantHits(
        layoutNode.node,
        ownClip,
        scrollLeft,
        scrollTop,
        ownerTransform,
        state,
      )
    }
  }
  emitScrollbars(
    layoutNode,
    clientX,
    clientY,
    metrics,
    chromeClips,
    state,
  )
}

const descendantOverflowEnd = (
  nodes: readonly LayoutNode[],
  axis: "x" | "y",
  ownerTransform: RenderTransform,
  state: BuildState,
): number => {
  let maximum = Number.NEGATIVE_INFINITY
  for (const node of nodes) {
    const box = state.boxByNode.get(node.node)
    if (box) {
      const bounds = transformBounds(
        transformRelativeTo(ownerTransform, box.transform),
        box.x,
        box.y,
        box.width,
        box.height,
      )
      maximum = Math.max(
        maximum,
        axis === "x"
          ? bounds.x + bounds.width + Math.max(0, box.margin.right)
          : bounds.y + bounds.height + Math.max(0, box.margin.bottom),
      )
    }
    const overflow = axis === "x" ? node.style.overflowX : node.style.overflowY
    if (node.transparent || overflow === "visible") {
      maximum = Math.max(
        maximum,
        descendantOverflowEnd(node.children, axis, ownerTransform, state),
      )
    }
  }
  return maximum
}

const transformRelativeTo = (
  owner: RenderTransform,
  descendant: RenderTransform,
): RenderTransform => {
  if (owner.scaleX === 0 || owner.scaleY === 0) return IDENTITY_TRANSFORM
  const result = Object.freeze({
    scaleX: descendant.scaleX / owner.scaleX,
    scaleY: descendant.scaleY / owner.scaleY,
    translateX: (descendant.translateX - owner.translateX) / owner.scaleX,
    translateY: (descendant.translateY - owner.translateY) / owner.scaleY,
  })
  return isIdentityTransform(result) ? IDENTITY_TRANSFORM : result
}

const scrollableOverflow = (value: ComputedStyle["overflowX"]): boolean =>
  value === "hidden" || value === "auto" || value === "scroll"

const visibleScrollbarOverflow = (value: ComputedStyle["overflowX"]): boolean =>
  value === "auto" || value === "scroll"

const emitScrollbars = (
  layoutNode: LayoutNode,
  clientX: number,
  clientY: number,
  metrics: RenderScrollMetrics,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  if (!isElement(layoutNode.node) || layoutNode.style.scrollbarWidth === "none") return
  const paintY = metrics.maxScrollTop > 0 && visibleScrollbarOverflow(layoutNode.style.overflowY)
  const paintX = metrics.maxScrollLeft > 0 && visibleScrollbarOverflow(layoutNode.style.overflowX)
  if (!paintX && !paintY) return
  const requestedThickness = layoutNode.style.scrollbarWidth === "thin"
    ? SCROLLBAR_THIN_THICKNESS
    : SCROLLBAR_AUTO_THICKNESS
  const verticalThickness = Math.min(requestedThickness, metrics.clientWidth)
  const horizontalThickness = Math.min(requestedThickness, metrics.clientHeight)

  if (paintY) {
    emitScrollbarAxis({
      axis: "y",
      node: layoutNode.node,
      trackX: clientX + metrics.clientWidth - verticalThickness,
      trackY: clientY,
      trackLength: Math.max(0, metrics.clientHeight - (paintX ? horizontalThickness : 0)),
      thickness: verticalThickness,
      clientLength: metrics.clientHeight,
      scrollLength: metrics.scrollHeight,
      offset: metrics.scrollTop,
      maximum: metrics.maxScrollTop,
      opacity: layoutNode.effectiveOpacity,
      clips,
      state,
    })
  }
  if (paintX) {
    emitScrollbarAxis({
      axis: "x",
      node: layoutNode.node,
      trackX: clientX,
      trackY: clientY + metrics.clientHeight - horizontalThickness,
      trackLength: Math.max(0, metrics.clientWidth - (paintY ? verticalThickness : 0)),
      thickness: horizontalThickness,
      clientLength: metrics.clientWidth,
      scrollLength: metrics.scrollWidth,
      offset: metrics.scrollLeft,
      maximum: metrics.maxScrollLeft,
      opacity: layoutNode.effectiveOpacity,
      clips,
      state,
    })
  }
}

const emitScrollbarAxis = (options: Readonly<{
  axis: "x" | "y"
  node: Element
  trackX: number
  trackY: number
  trackLength: number
  thickness: number
  clientLength: number
  scrollLength: number
  offset: number
  maximum: number
  opacity: number
  clips: readonly RenderClip[]
  state: BuildState
}>): void => {
  if (options.trackLength <= 0 || options.thickness <= 0 || options.scrollLength <= 0) return
  const minimumThumb = options.thickness * 2
  const proportionalThumb = options.trackLength * options.clientLength / options.scrollLength
  const thumbLength = Math.min(options.trackLength, Math.max(minimumThumb, proportionalThumb))
  const thumbTravel = Math.max(0, options.trackLength - thumbLength)
  const thumbOffset = options.maximum > 0
    ? thumbTravel * options.offset / options.maximum
    : 0
  const vertical = options.axis === "y"
  options.state.displayList.push(
    Object.freeze({
      kind: "rect",
      key: `ua:scrollbar-${options.axis}-track`,
      node: options.node,
      x: options.trackX,
      y: options.trackY,
      width: vertical ? options.thickness : options.trackLength,
      height: vertical ? options.trackLength : options.thickness,
      color: SCROLLBAR_TRACK_COLOR,
      opacity: options.opacity,
      border: roundRectPaintBorder(
        Math.min(options.thickness, options.trackLength) / 2,
        SCROLLBAR_TRACK_COLOR,
      ),
      shadow: null,
      clips: options.clips,
      transform: presentationFor(options.node, options.state),
    }),
    Object.freeze({
      kind: "rect",
      key: `ua:scrollbar-${options.axis}-thumb`,
      node: options.node,
      x: options.trackX + (vertical ? 0 : thumbOffset),
      y: options.trackY + (vertical ? thumbOffset : 0),
      width: vertical ? options.thickness : thumbLength,
      height: vertical ? thumbLength : options.thickness,
      color: SCROLLBAR_THUMB_COLOR,
      opacity: options.opacity,
      border: roundRectPaintBorder(
        Math.min(options.thickness, thumbLength) / 2,
        SCROLLBAR_THUMB_COLOR,
      ),
      shadow: null,
      clips: options.clips,
      transform: presentationFor(options.node, options.state),
    }),
  )
}

const shiftDescendantBoxes = (
  start: number,
  scrollLeft: number,
  scrollTop: number,
  ownerTransform: RenderTransform,
  state: BuildState,
): void => {
  for (let index = start; index < state.boxes.length; index++) {
    const box = state.boxes[index]
    if (!box) continue
    const shifted: RenderBox = Object.freeze({
      ...box,
      x: box.x - scrollLeft,
      y: box.y - scrollTop,
      contentX: box.contentX - scrollLeft,
      contentY: box.contentY - scrollTop,
      transform: shiftTransformForScroll(box.transform, ownerTransform, scrollLeft, scrollTop),
    })
    state.boxes[index] = shifted
    state.boxByNode.set(box.node, shifted)
    state.transforms.set(box.node, shifted.transform)
  }
}

const shiftDescendantDisplay = (
  start: number,
  ownClip: RenderClip,
  scrollLeft: number,
  scrollTop: number,
  ownerTransform: RenderTransform,
  state: BuildState,
): void => {
  for (let index = start; index < state.displayList.length; index++) {
    const item = state.displayList[index]
    if (!item) continue
    state.displayList[index] = Object.freeze({
      ...item,
      x: item.x - scrollLeft,
      y: item.y - scrollTop,
      clips: shiftInnerClips(item.clips, ownClip, scrollLeft, scrollTop, ownerTransform),
      transform: shiftTransformForScroll(item.transform, ownerTransform, scrollLeft, scrollTop),
    })
  }
}

const shiftDescendantHits = (
  owner: Element,
  ownClip: RenderClip,
  scrollLeft: number,
  scrollTop: number,
  ownerTransform: RenderTransform,
  state: BuildState,
): void => {
  for (const [node, hit] of state.hits) {
    if (node === owner || !owner.contains(node)) continue
    state.hits.set(
      node,
      Object.freeze({
        ...hit,
        x: hit.x - scrollLeft,
        y: hit.y - scrollTop,
        clips: shiftInnerClips(hit.clips, ownClip, scrollLeft, scrollTop, ownerTransform),
        transform: shiftTransformForScroll(hit.transform, ownerTransform, scrollLeft, scrollTop),
      }),
    )
  }
}

const shiftInnerClips = (
  clips: readonly RenderClip[],
  ownClip: RenderClip,
  scrollLeft: number,
  scrollTop: number,
  ownerTransform: RenderTransform,
): readonly RenderClip[] => {
  const ownIndex = clips.indexOf(ownClip)
  if (ownIndex < 0 || ownIndex === clips.length - 1) return clips
  return Object.freeze(
    clips.map((clip, index) =>
      index <= ownIndex
        ? clip
        : Object.freeze({
            ...clip,
            x: clip.x - scrollLeft,
            y: clip.y - scrollTop,
            transform: shiftTransformForScroll(
              clip.transform,
              ownerTransform,
              scrollLeft,
              scrollTop,
            ),
          }),
    ),
  )
}

const shiftTransformForScroll = (
  transform: RenderTransform,
  owner: RenderTransform,
  scrollLeft: number,
  scrollTop: number,
): RenderTransform => {
  const result = Object.freeze({
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    translateX: transform.translateX + (transform.scaleX - owner.scaleX) * scrollLeft,
    translateY: transform.translateY + (transform.scaleY - owner.scaleY) * scrollTop,
  })
  return isIdentityTransform(result) ? IDENTITY_TRANSFORM : result
}

const hasRectPaint = (
  background: string | null,
  border: RenderBorder,
): boolean =>
  (background !== null && background.trim().toLowerCase() !== "transparent") ||
  border.widths.top > 0 ||
  border.widths.right > 0 ||
  border.widths.bottom > 0 ||
  border.widths.left > 0

const emitBoxShadow = (
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  const shadow = layoutNode.style.boxShadow
  if (shadow === null || box.width <= 0 || box.height <= 0) return
  const contraction = Math.max(0, -shadow.spreadRadius)
  const width = Math.max(0, box.width - contraction * 2)
  const height = Math.max(0, box.height - contraction * 2)
  if (width <= 0 || height <= 0) return
  const radius = (value: number): number => Math.max(0, value - contraction)
  const border: RenderBorder = Object.freeze({
    widths: ZERO_EDGES,
    colors: Object.freeze({
      top: shadow.color,
      right: shadow.color,
      bottom: shadow.color,
      left: shadow.color,
    }),
    radii: Object.freeze({
      topLeft: radius(box.border.radii.topLeft),
      topRight: radius(box.border.radii.topRight),
      bottomRight: radius(box.border.radii.bottomRight),
      bottomLeft: radius(box.border.radii.bottomLeft),
    }),
  })
  state.displayList.push(Object.freeze({
    kind: "rect",
    key: "shadow",
    node: layoutNode.node,
    x: box.x + shadow.offsetX + contraction,
    y: box.y + shadow.offsetY + contraction,
    width,
    height,
    color: shadow.color,
    opacity: layoutNode.effectiveOpacity,
    border,
    shadow: Object.freeze({
      blurRadius: shadow.blurRadius,
      spreadRadius: Math.max(0, shadow.spreadRadius),
    }),
    clips,
    transform: box.transform,
  }))
}

const emitReplacedControlPresentation = (
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  if (layoutNode.node instanceof HTMLImageElement) {
    emitImagePresentation(layoutNode.node, layoutNode, box, clips, state)
    return
  }
  if (layoutNode.node instanceof HTMLSelectElement) {
    emitSelectPresentation(layoutNode.node, layoutNode, box, clips, state)
    return
  }
  if (layoutNode.node instanceof HTMLProgressElement) {
    emitProgressPresentation(layoutNode.node, layoutNode, box, clips, state)
    return
  }
  if (layoutNode.node instanceof HTMLMeterElement) {
    emitMeterPresentation(layoutNode.node, layoutNode, box, clips, state)
    return
  }
  if (layoutNode.node instanceof HTMLTextAreaElement) {
    emitTextAreaPresentation(layoutNode.node, layoutNode, box, clips, state)
    return
  }
  if (!(layoutNode.node instanceof HTMLInputElement)) return
  const input = layoutNode.node
  if (input.type === "range") {
    emitRangeInput(input, layoutNode, box, clips, state)
    return
  }
  if (input.type === "checkbox" || input.type === "radio") {
    emitInputIndicator(input, layoutNode, box, clips, state)
    return
  }
  if (!INPUT_VALUE_TYPES.has(input.type)) return
  const liveValue = input.value
  const placeholder = liveValue === "" ? input.placeholder : ""
  const source = liveValue || placeholder
  if (source === "" || box.contentWidth <= 0 || box.contentHeight <= 0) return
  const rawText = input.type === "password" && liveValue !== ""
    ? "•".repeat(graphemeCount(liveValue))
    : source.replace(/[\r\n]+/g, " ")
  const text = ellipsizeSingleLine(rawText, layoutNode.style, box.contentWidth, true)
  if (text === "" || !hasPaintableText(text)) return
  const lineHeight = resolveLineHeight(layoutNode.style)
  state.displayList.push(
    Object.freeze({
      kind: "text",
      key: "value",
      node: input,
      text,
      x: alignedTextX(
        layoutNode.style,
        box.contentX,
        box.contentWidth,
        textAdvance(text, layoutNode.style),
      ),
      y: box.contentY + Math.max(0, (box.contentHeight - lineHeight) / 2),
      color: layoutNode.style.color,
      fontSize: layoutNode.style.fontSize,
      letterSpacing: layoutNode.style.letterSpacing,
      opacity: layoutNode.effectiveOpacity * (placeholder ? 0.55 : 1),
      clips,
      transform: presentationFor(input, state),
    }),
  )
}

const presentationFor = (node: Node, state: BuildState): RenderTransform =>
  state.transforms.get(node) ?? IDENTITY_TRANSFORM

const emitImagePresentation = (
  image: HTMLImageElement,
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  if (image.src === "" || box.contentWidth <= 0 || box.contentHeight <= 0) return
  state.displayList.push(Object.freeze({
    kind: "image",
    key: "image",
    node: image,
    src: image.src,
    x: box.contentX,
    y: box.contentY,
    width: box.contentWidth,
    height: box.contentHeight,
    fit: layoutNode.style.objectFit,
    opacity: layoutNode.effectiveOpacity,
    clips,
    transform: presentationFor(image, state),
  }))
}

const emitSelectPresentation = (
  select: HTMLSelectElement,
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  if (select.multiple || select.size > 1) {
    throw new Error("Select listbox rendering is not implemented for multiple or size > 1")
  }
  const selectedIndex = select.selectedIndex
  const option = selectedIndex < 0 ? null : select.options.item(selectedIndex)
  const label = ellipsizeSingleLine(
    option?.label ?? "",
    layoutNode.style,
    box.contentWidth,
    true,
  )
  if (label === "" || !hasPaintableText(label) || box.contentWidth <= 0 || box.contentHeight <= 0) return
  const lineHeight = resolveLineHeight(layoutNode.style)
  state.displayList.push(
    Object.freeze({
      kind: "text",
      key: "value",
      node: select,
      text: label,
      x: alignedTextX(
        layoutNode.style,
        box.contentX,
        box.contentWidth,
        textAdvance(label, layoutNode.style),
      ),
      y: box.contentY + Math.max(0, (box.contentHeight - lineHeight) / 2),
      color: layoutNode.style.color,
      fontSize: layoutNode.style.fontSize,
      letterSpacing: layoutNode.style.letterSpacing,
      opacity: layoutNode.effectiveOpacity,
      clips,
      transform: presentationFor(select, state),
    }),
  )
}

const emitTextAreaPresentation = (
  textArea: HTMLTextAreaElement,
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  if (box.contentWidth <= 0 || box.contentHeight <= 0) return
  const liveValue = textArea.value
  const placeholder = liveValue === "" ? textArea.placeholder : ""
  const source = liveValue || placeholder
  if (source === "") return
  const capacity = textCapacity(layoutNode.style, box.contentWidth)
  const lines = textAreaVisualLines(
    source,
    layoutNode.style.whiteSpace,
    textArea.wrap,
    capacity,
  )
  const lineHeight = resolveLineHeight(layoutNode.style)
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!line || !hasPaintableText(line)) continue
    state.displayList.push(Object.freeze({
      kind: "text",
      key: `value:${index}`,
      node: textArea,
      text: line,
      x: alignedTextX(
        layoutNode.style,
        box.contentX,
        box.contentWidth,
        textAdvance(line, layoutNode.style),
      ),
      y: box.contentY + index * lineHeight,
      color: layoutNode.style.color,
      fontSize: layoutNode.style.fontSize,
      letterSpacing: layoutNode.style.letterSpacing,
      opacity: layoutNode.effectiveOpacity * (placeholder ? 0.55 : 1),
      clips,
      transform: presentationFor(textArea, state),
    }))
  }
}

const textAreaVisualLines = (
  source: string,
  whiteSpace: ComputedStyle["whiteSpace"],
  wrap: string,
  capacity: number,
): readonly string[] => {
  if (whiteSpace === "normal" || whiteSpace === "nowrap") {
    const collapsed = source.replace(/[\t\n\f\r ]+/g, " ").trim()
    return collapsed === ""
      ? Object.freeze([])
      : whiteSpace === "nowrap"
        ? Object.freeze([collapsed])
        : Object.freeze(wrapCollapsedLine(collapsed, capacity))
  }
  const wraps = wrap.trim().toLowerCase() !== "off"
  const lines: string[] = []
  for (const line of splitTextLines(source)) {
    if (!wraps) {
      lines.push(line)
      continue
    }
    lines.push(...wrapPreservedLine(line, capacity))
  }
  return Object.freeze(lines)
}

const wrapPreservedLine = (line: string, capacity: number): string[] => {
  const characters = Array.from(line)
  if (characters.length === 0) return [""]
  const lines: string[] = []
  for (let start = 0; start < characters.length; start += capacity) {
    lines.push(characters.slice(start, start + capacity).join(""))
  }
  return lines
}

const wrapCollapsedLine = (line: string, capacity: number): string[] => {
  const lines: string[] = []
  let remaining = line
  while (Array.from(remaining).length > capacity) {
    const characters = Array.from(remaining)
    const prefix = characters.slice(0, capacity + 1).join("")
    const breakAt = prefix.lastIndexOf(" ")
    if (breakAt > 0 && breakAt <= capacity) {
      lines.push(prefix.slice(0, breakAt))
      remaining = remaining.slice(breakAt + 1).trimStart()
    } else {
      lines.push(characters.slice(0, capacity).join(""))
      remaining = characters.slice(capacity).join("").trimStart()
    }
  }
  lines.push(remaining)
  return lines
}

const emitProgressPresentation = (
  progress: HTMLProgressElement,
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  if (box.contentWidth <= 0 || box.contentHeight <= 0) return
  emitGaugeTrack(progress, layoutNode, box, clips, state)
  const indeterminate = progress.position < 0
  const width = indeterminate
    ? box.contentWidth / 3
    : box.contentWidth * progress.position
  const x = indeterminate
    ? box.contentX + (box.contentWidth - width) / 2
    : box.contentX
  emitGaugeValue({
    node: progress,
    layoutNode,
    box,
    clips,
    state,
    x,
    width,
    color: indeterminate ? PROGRESS_INDETERMINATE_COLOR : PROGRESS_VALUE_COLOR,
  })
}

const emitMeterPresentation = (
  meter: HTMLMeterElement,
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  if (box.contentWidth <= 0 || box.contentHeight <= 0) return
  emitGaugeTrack(meter, layoutNode, box, clips, state)
  const range = meter.max - meter.min
  const ratio = range > 0 ? (meter.value - meter.min) / range : 0
  emitGaugeValue({
    node: meter,
    layoutNode,
    box,
    clips,
    state,
    x: box.contentX,
    width: box.contentWidth * ratio,
    color: meterTone(meter),
  })
}

const emitGaugeTrack = (
  node: HTMLProgressElement | HTMLMeterElement,
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  state.displayList.push(Object.freeze({
    kind: "rect",
    key: "track",
    node,
    x: box.contentX,
    y: box.contentY,
    width: box.contentWidth,
    height: box.contentHeight,
    color: GAUGE_TRACK_COLOR,
    opacity: layoutNode.effectiveOpacity,
    border: roundRectPaintBorder(
      Math.min(box.contentWidth, box.contentHeight) / 2,
      GAUGE_TRACK_COLOR,
    ),
    shadow: null,
    clips,
    transform: presentationFor(node, state),
  }))
}

const emitGaugeValue = (options: Readonly<{
  node: HTMLProgressElement | HTMLMeterElement
  layoutNode: LayoutNode
  box: RenderBox
  clips: readonly RenderClip[]
  state: BuildState
  x: number
  width: number
  color: string
}>): void => {
  options.state.displayList.push(Object.freeze({
    kind: "rect",
    key: "value",
    node: options.node,
    x: options.x,
    y: options.box.contentY,
    width: options.width,
    height: options.box.contentHeight,
    color: options.color,
    opacity: options.layoutNode.effectiveOpacity,
    border: roundRectPaintBorder(
      Math.min(options.width, options.box.contentHeight) / 2,
      options.color,
    ),
    shadow: null,
    clips: options.clips,
    transform: presentationFor(options.node, options.state),
  }))
}

const meterTone = (meter: HTMLMeterElement): string => {
  if (meter.optimum < meter.low) {
    if (meter.value < meter.low) return METER_OPTIMUM_COLOR
    return meter.value <= meter.high
      ? METER_SUBOPTIMUM_COLOR
      : METER_EVEN_LESS_GOOD_COLOR
  }
  if (meter.optimum > meter.high) {
    if (meter.value > meter.high) return METER_OPTIMUM_COLOR
    return meter.value >= meter.low
      ? METER_SUBOPTIMUM_COLOR
      : METER_EVEN_LESS_GOOD_COLOR
  }
  return meter.value >= meter.low && meter.value <= meter.high
    ? METER_OPTIMUM_COLOR
    : METER_SUBOPTIMUM_COLOR
}

const emitRangeInput = (
  input: HTMLInputElement,
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  if (box.contentWidth <= 0 || box.contentHeight <= 0) return
  const thumbSize = Math.min(
    RANGE_THUMB_SIZE,
    box.contentWidth,
    box.contentHeight,
  )
  const trackHeight = Math.min(RANGE_TRACK_THICKNESS, box.contentHeight)
  const travel = Math.max(0, box.contentWidth - thumbSize)
  const ratio = rangeValueRatio(input)
  const trackX = box.contentX + thumbSize / 2
  const trackWidth = travel

  state.displayList.push(
    Object.freeze({
      kind: "rect",
      key: "track",
      node: input,
      x: trackX,
      y: box.contentY + (box.contentHeight - trackHeight) / 2,
      width: trackWidth,
      height: trackHeight,
      color: RANGE_TRACK_COLOR,
      opacity: layoutNode.effectiveOpacity,
      border: roundRectPaintBorder(trackHeight / 2, RANGE_TRACK_COLOR),
      shadow: null,
      clips,
      transform: presentationFor(input, state),
    }),
    Object.freeze({
      kind: "rect",
      key: "thumb",
      node: input,
      x: box.contentX + travel * ratio,
      y: box.contentY + (box.contentHeight - thumbSize) / 2,
      width: thumbSize,
      height: thumbSize,
      color: RANGE_THUMB_COLOR,
      opacity: layoutNode.effectiveOpacity,
      border: roundRectPaintBorder(thumbSize / 2, RANGE_THUMB_COLOR),
      shadow: null,
      clips,
      transform: presentationFor(input, state),
    }),
  )
}

const rangeValueRatio = (input: HTMLInputElement): number => {
  const minimum = rangeBoundary(input.min) ?? 0
  const declaredMaximum = rangeBoundary(input.max) ?? 100
  const maximum = Math.max(minimum, declaredMaximum)
  if (maximum === minimum) return 0
  const value = Number.isFinite(input.valueAsNumber)
    ? input.valueAsNumber
    : minimum + (maximum - minimum) / 2
  return Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)))
}

const rangeBoundary = (value: string): number | null => {
  if (!rangeBoundaryPattern.test(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const roundRectPaintBorder = (radius: number, color: string): RenderBorder => {
  const colors: RenderBorderColors = Object.freeze({
    top: color,
    right: color,
    bottom: color,
    left: color,
  })
  return Object.freeze({
    widths: ZERO_EDGES,
    colors,
    radii: Object.freeze({
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius,
    }),
  })
}

const emitInputIndicator = (
  input: HTMLInputElement,
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  if (!input.checked) return
  const size = Math.max(0, Math.min(box.contentWidth, box.contentHeight) - 4)
  if (size <= 0) return
  const radius = input.type === "radio" ? size / 2 : Math.min(1, size / 2)
  const colors = Object.freeze({
    top: layoutNode.style.color,
    right: layoutNode.style.color,
    bottom: layoutNode.style.color,
    left: layoutNode.style.color,
  })
  const border: RenderBorder = Object.freeze({
    widths: ZERO_EDGES,
    colors,
    radii: Object.freeze({
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius,
    }),
  })
  state.displayList.push(
    Object.freeze({
      kind: "rect",
      key: "indicator",
      node: input,
      x: box.contentX + (box.contentWidth - size) / 2,
      y: box.contentY + (box.contentHeight - size) / 2,
      width: size,
      height: size,
      color: layoutNode.style.color,
      opacity: layoutNode.effectiveOpacity,
      border,
      shadow: null,
      clips,
      transform: presentationFor(input, state),
    }),
  )
}

const graphemeCount = (value: string): number => {
  if (graphemeSegmenter)
    return Array.from(graphemeSegmenter.segment(value)).length
  return Array.from(value.normalize("NFC")).length
}

const createBox = (
  layoutNode: LayoutNode,
  x: number,
  y: number,
  width: number,
  height: number,
  padding: RenderPadding,
  border: RenderBorder,
  depth: number,
  display: "block" | "inline" | "flex",
  transform: RenderTransform,
): RenderBox =>
  Object.freeze({
    node: layoutNode.node,
    parent: layoutNode.parent?.node ?? null,
    depth,
    display,
    x,
    y,
    width,
    height,
    contentX: x + border.widths.left + padding.left,
    contentY: y + border.widths.top + padding.top,
    contentWidth: Math.max(
      0,
      width - horizontal(border.widths) - horizontal(padding),
    ),
    contentHeight: Math.max(
      0,
      height - vertical(border.widths) - vertical(padding),
    ),
    margin: layoutNode.style.margin,
    padding,
    border,
    transform,
  })

const createHit = (
  node: Element,
  tag: string,
  x: number,
  y: number,
  width: number,
  height: number,
  clips: readonly RenderClip[],
  transform: RenderTransform,
): HitMetadata => {
  const disabled = node.hasAttribute("disabled")
  const tabIndex = Number.parseInt(node.getAttribute("tabindex") ?? "-1", 10)
  const inputRole = node instanceof HTMLInputElement
    ? defaultInputRole(node.type)
    : null
  const selectRole = node instanceof HTMLSelectElement ? "combobox" : null
  const textAreaRole = node instanceof HTMLTextAreaElement ? "textbox" : null
  const gaugeRole = node instanceof HTMLProgressElement
    ? "progressbar"
    : node instanceof HTMLMeterElement
      ? "meter"
      : null
  const role = node.getAttribute("role") ??
    (tag === "button" ? "button" : inputRole ?? selectRole ?? textAreaRole ?? gaugeRole)
  return Object.freeze({
    node,
    x,
    y,
    width,
    height,
    interactive: !disabled &&
      (tag === "button" ||
        tag === "input" ||
        tag === "select" ||
        tag === "textarea" ||
        tabIndex >= 0),
    disabled,
    role,
    clips,
    transform,
  })
}

const defaultInputRole = (type: string): string | null => {
  switch (type) {
    case "checkbox":
      return "checkbox"
    case "radio":
      return "radio"
    case "search":
      return "searchbox"
    case "range":
      return "slider"
    case "button":
    case "reset":
    case "submit":
      return "button"
    case "hidden":
      return null
    default:
      return "textbox"
  }
}

const measuredSize = (
  node: LayoutNode,
  availableWidth: number,
  availableHeight: number,
  state: BuildState,
): Size | undefined =>
  state.measured.get(node)?.get(measureKey(availableWidth, availableHeight))

const rememberSize = (
  node: LayoutNode,
  availableWidth: number,
  availableHeight: number,
  width: number,
  height: number,
  state: BuildState,
): Size => {
  const size = Object.freeze({
    width: Math.max(0, width),
    height: Math.max(0, height),
  })
  let values = state.measured.get(node)
  if (!values) {
    values = new Map()
    state.measured.set(node, values)
  }
  values.set(measureKey(availableWidth, availableHeight), size)
  return size
}

const measureKey = (width: number, height: number): string =>
  `${width}\u0000${height}`

const horizontal = (edges: RenderEdges): number => edges.left + edges.right
const vertical = (edges: RenderEdges): number => edges.top + edges.bottom

const horizontalBoxEdges = (style: ComputedStyle): number =>
  horizontal(style.padding) + horizontal(style.borderWidths)

const verticalBoxEdges = (style: ComputedStyle): number =>
  vertical(style.padding) + vertical(style.borderWidths)

const childNodes = (node: Node): Node[] => {
  const children = node.childNodes as unknown as ArrayLike<Node> &
    Iterable<Node>
  return Array.from(children)
}

const layoutChildNodes = (node: Node): Node[] =>
  childNodes(node).filter(child => child.nodeType !== 8)

const showingPopovers = (root: Node): readonly HTMLElement[] => {
  const popovers: HTMLElement[] = []
  const visit = (node: Node): void => {
    if (
      node instanceof HTMLElement &&
      node.popover !== null &&
      node[getPopoverVisibilityState]() === "showing"
    ) {
      popovers.push(node)
    }
    for (const child of childNodes(node)) visit(child)
  }
  visit(root)
  return popovers
}

const isElement = (node: Node): node is Element => node.nodeType === 1
const isText = (node: Node): node is Text => node.nodeType === 3

const readText = (node: Text, style: ComputedStyle): string => {
  const data = (node as Text & { data?: unknown }).data
  if (typeof data === "string") return normalizeText(data, style)
  const value = (node as Text & { nodeValue?: unknown }).nodeValue
  return normalizeText(
    typeof value === "string" ? value : (node.textContent ?? ""),
    style,
  )
}

const normalizeText = (value: string, style: ComputedStyle): string => {
  if (style.whiteSpace === "pre") return value
  const collapsed = value.replace(/[\t\n\f\r ]+/g, " ")
  return collapsed.trim() === "" ? "" : collapsed
}

const measureText = (value: string, style: ComputedStyle): Size => {
  if (value === "") return Object.freeze({width: 0, height: 0})
  const lines = splitTextLines(value)
  const width = lines.reduce(
    (maximum, line) => Math.max(maximum, textAdvance(line, style)),
    0,
  )
  return Object.freeze({
    width,
    height: lines.length * resolveLineHeight(style),
  })
}

const textAdvance = (value: string, style: ComputedStyle): number => {
  const count = Array.from(value).length
  if (count === 0) return 0
  return Math.max(
    0,
    count * style.fontSize * 0.6 + Math.max(0, count - 1) * style.letterSpacing,
  )
}

const textCapacity = (style: ComputedStyle, width: number): number => {
  const baseAdvance = style.fontSize * 0.6
  const perCharacter = baseAdvance + style.letterSpacing
  if (perCharacter <= 0) return Number.MAX_SAFE_INTEGER
  return Math.max(1, Math.floor((Math.max(0, width) + style.letterSpacing) / perCharacter))
}

const ellipsizeSingleLine = (
  value: string,
  style: ComputedStyle,
  availableWidth: number,
  singleLineControl = false,
): string => {
  if (
    style.textOverflow !== "ellipsis" ||
    style.overflowX !== "hidden" ||
    (!singleLineControl && style.whiteSpace !== "nowrap") ||
    textAdvance(value, style) <= availableWidth
  ) return value
  const ellipsis = "…"
  if (textAdvance(ellipsis, style) > availableWidth) return ""
  const characters = Array.from(value)
  let low = 0
  let high = characters.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const candidate = `${characters.slice(0, middle).join("")}${ellipsis}`
    if (textAdvance(candidate, style) <= availableWidth) low = middle
    else high = middle - 1
  }
  return `${characters.slice(0, low).join("")}${ellipsis}`
}

const alignedTextX = (
  style: ComputedStyle,
  contentX: number,
  contentWidth: number,
  textWidth: number,
): number => {
  const free = Math.max(0, contentWidth - textWidth)
  if (style.textAlign === "center") return contentX + free / 2
  if (style.textAlign === "right" || style.textAlign === "end") {
    return contentX + free
  }
  return contentX
}

const emitTextItems = (
  layoutNode: LayoutNode,
  x: number,
  y: number,
  alignmentWidth: number,
  clips: readonly RenderClip[],
  state: BuildState,
): void => {
  const value = layoutNode.text
  if (!value) return
  const lines = splitTextLines(value)
  const multiline = lines.length > 1
  const lineHeight = resolveLineHeight(layoutNode.style)
  const overflowStyle = layoutNode.parent?.style ?? layoutNode.style
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!line) continue
    const displayLine = !multiline
      ? ellipsizeSingleLine(line, overflowStyle, alignmentWidth)
      : line
    if (displayLine === "" || !hasPaintableText(displayLine)) continue
    state.displayList.push(
      Object.freeze({
        kind: "text",
        key: multiline ? `text:${index}` : "text",
        node: layoutNode.node,
        text: displayLine,
        x: alignedTextX(
          layoutNode.style,
          x,
          alignmentWidth,
          textAdvance(displayLine, layoutNode.style),
        ),
        y: y + index * lineHeight,
        color: layoutNode.style.color,
        fontSize: layoutNode.style.fontSize,
        letterSpacing: layoutNode.style.letterSpacing,
        opacity: layoutNode.effectiveOpacity,
        clips,
        transform: presentationFor(layoutNode.node, state),
      }),
    )
  }
}

const splitTextLines = (value: string): readonly string[] =>
  value.split(/\r\n|\r|\n/)

const hasPaintableText = (value: string): boolean => value.trim().length > 0

const hasLineBreak = (value: string): boolean => /[\r\n]/.test(value)

const textStyle = (inherited: ComputedStyle): ComputedStyle =>
  Object.freeze({
    customProperties: inherited.customProperties,
    display: "inline",
    boxSizing: "content-box",
    flexDirection: "row",
    flexWrap: "nowrap",
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: null,
    alignItems: "stretch",
    justifyContent: "flex-start",
    width: null,
    height: null,
    minWidth: null,
    minHeight: null,
    maxWidth: null,
    maxHeight: null,
    position: "static",
    left: null,
    top: null,
    right: null,
    bottom: null,
    transform: Object.freeze([]),
    transformOrigin: ROOT_STYLE.transformOrigin,
    boxShadow: null,
    gap: 0,
    margin: ZERO_EDGES,
    padding: ZERO_EDGES,
    borderWidths: ZERO_EDGES,
    borderColors: inherited.borderColors,
    borderRadii: ROOT_STYLE.borderRadii,
    background: null,
    color: inherited.color,
    fontSize: inherited.fontSize,
    lineHeight: inherited.lineHeight,
    letterSpacing: inherited.letterSpacing,
    opacity: 1,
    overflowX: "visible",
    overflowY: "visible",
    scrollbarWidth: "auto",
    objectFit: "cover",
    textAlign: inherited.textAlign,
    textOverflow: inherited.textOverflow,
    whiteSpace: inherited.whiteSpace,
    zIndex: "auto",
  })

const validateViewport = (viewport: RenderViewport): RenderViewport => {
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width < 0 ||
    viewport.height < 0
  ) {
    throw new RangeError(
      "Renderer viewport must contain finite non-negative dimensions",
    )
  }
  return Object.freeze({ width: viewport.width, height: viewport.height })
}

const validateRoot = (document: Document, root: Node): void => {
  const ownerDocument = root.nodeType === 9 ? root : root.ownerDocument
  if (ownerDocument !== document)
    throw new TypeError("Renderer root must belong to the supplied document")
}

class ImmutableNodeMap<Key extends Node, Value> implements ReadonlyMap<Key, Value> {
  readonly #base: ReadonlyMap<Key, Value>
  readonly #changes: ReadonlyMap<Key, Value>
  readonly #size: number

  constructor(
    values: ReadonlyMap<Key, Value>,
    changes: ReadonlyMap<Key, Value> = new Map(),
    adopt = false,
  ) {
    this.#base = adopt ? values : new Map(values)
    this.#changes = changes
    let size = this.#base.size
    for (const node of changes.keys()) {
      if (!this.#base.has(node)) size += 1
    }
    this.#size = size
    Object.freeze(this)
  }

  with(node: Key, value: Value): ImmutableNodeMap<Key, Value> {
    if (this.#changes.size >= 128 && !this.#changes.has(node)) {
      const compacted = new Map(this)
      compacted.set(node, value)
      return new ImmutableNodeMap(compacted, new Map(), true)
    }
    const changes = new Map(this.#changes)
    changes.set(node, value)
    return new ImmutableNodeMap(this.#base, changes, true)
  }

  get size(): number {
    return this.#size
  }

  get(node: Key): Value | undefined {
    return this.#changes.has(node)
      ? this.#changes.get(node)
      : this.#base.get(node)
  }

  has(node: Key): boolean {
    return this.#changes.has(node) || this.#base.has(node)
  }

  forEach(
    callback: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void,
    thisArg?: unknown,
  ): void {
    for (const [node, value] of this)
      callback.call(thisArg, value, node, this)
  }

  entries(): MapIterator<[Key, Value]> {
    return this.iterateEntries()
  }

  keys(): MapIterator<Key> {
    return this.iterateKeys()
  }

  values(): MapIterator<Value> {
    return this.iterateValues()
  }

  [Symbol.iterator](): MapIterator<[Key, Value]> {
    return this.entries()
  }

  private *iterateEntries(): MapIterator<[Key, Value]> {
    for (const [node, value] of this.#base) {
      yield [node, this.#changes.has(node) ? this.#changes.get(node)! : value]
    }
    for (const [node, value] of this.#changes) {
      if (!this.#base.has(node)) yield [node, value]
    }
  }

  private *iterateKeys(): MapIterator<Key> {
    for (const [node] of this) yield node
  }

  private *iterateValues(): MapIterator<Value> {
    for (const [, value] of this) yield value
  }
}

const immutableNodeMap = <Key extends Node, Value>(
  values: Map<Key, Value>,
): ReadonlyMap<Key, Value> => new ImmutableNodeMap(values)

const replaceImmutableNodeMap = <Key extends Node, Value>(
  values: ReadonlyMap<Key, Value>,
  node: Key,
  value: Value,
): ReadonlyMap<Key, Value> => {
  if (values instanceof ImmutableNodeMap) return values.with(node, value)
  const next = new Map(values)
  next.set(node, value)
  return new ImmutableNodeMap(next, new Map(), true)
}
