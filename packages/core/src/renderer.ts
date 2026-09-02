import {
  HTMLElement,
  HTMLImageElement,
  HTMLInputElement,
  HTMLMeterElement,
  HTMLProgressElement,
  HTMLSelectElement,
  HTMLTextAreaElement,
  HTMLVectorPathElement,
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
import {getPopoverSource} from "@zavx0z/dom/popover-state"
import {
  EMPTY_CUSTOM_PROPERTIES,
  computeStyle,
  elementTag,
  resolveLength,
  resolveLineHeight,
  styleRulesDependOnAttribute,
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
  moveImmutableArrayEntry,
  replaceImmutableArray,
  replaceImmutableArrayEntries,
} from "./immutable-array.ts"
import type {
  CreateDocumentRendererOptions,
  DisplayItem,
  DocumentRenderer,
  HitMetadata,
  PathDisplayItem,
  RenderBorder,
  RenderBorderColors,
  RenderClip,
  RenderClipCornerRadii,
  RenderCornerRadii,
  RenderEdges,
  RenderBox,
  RenderFrame,
  RenderPadding,
  RenderPathGeometry,
  RenderScrollMetrics,
  RenderTextMeasurer,
  RenderTransform,
  RenderViewport,
} from "./types.ts"
import {parseRenderPath} from "./path.ts"
import {
  readCanonicalRenderFrameChangeState,
  recordCanonicalRenderFrameChanges,
  type CanonicalRenderFrameOperation,
} from "./frame-change-state.ts"

type LayoutNode = {
  readonly node: Node
  parent: LayoutNode | null
  style: ComputedStyle
  effectiveOpacity: number
  children: readonly LayoutNode[]
  transformChildren: readonly LayoutNode[]
  ownsOverflowClipInSubtree: boolean
  vectorPathOnly: boolean
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
  presentationOwner: Element | null
}>

type BuildState = {
  readonly boxes: RenderBox[]
  readonly boxByNode: Map<Node, RenderBox>
  readonly displayList: DisplayItem[]
  readonly hits: Map<Node, HitMetadata>
  readonly hitOrder: Element[]
  readonly scrolls: Map<Element, RenderScrollMetrics>
  readonly transforms: Map<Node, RenderTransform>
  readonly presentationTransforms: Map<Element, RenderTransform>
  readonly measured: WeakMap<LayoutNode, Map<string, Size>>
  readonly textMeasurer: CreateDocumentRendererOptions["textMeasurer"]
}

type FrameCollectionIndexes = Readonly<{
  boxByNode: WeakMap<Node, number>
  displayByNode: WeakMap<Node, ReadonlyMap<string, number>>
  hitByRecord: WeakMap<HitMetadata, number>
  pathStackByParent: WeakMap<Element, PathStackBlock>
}>

type PathStackBlock = {
  readonly parent: Element
  readonly nodes: HTMLVectorPathElement[]
  readonly semanticIndexByNode: WeakMap<HTMLVectorPathElement, number>
  readonly displayStart: number
  hitStart: number
  readonly beforeDisplayNode: Node | null
  readonly afterDisplayNode: Node | null
  beforeHitNode: Node | null
  afterHitNode: Node | null
}

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
const TEXT_SELECTION_COLOR = "#2563eb"
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
const vectorPathGeometryCache = new WeakMap<
  HTMLVectorPathElement,
  Readonly<{source: string; geometry: RenderPathGeometry | null}>
>()

const checkboxIndicatorGeometry = (() => {
  const geometry = parseRenderPath("M 3 6.5 L 5.5 9 L 10 3.5")
  if (geometry === null) throw new Error("Checkbox indicator geometry is invalid")
  return geometry
})()

const readVectorPathGeometry = (path: HTMLVectorPathElement): RenderPathGeometry | null => {
  const source = path.d
  let cached = vectorPathGeometryCache.get(path)
  if (cached === undefined || cached.source !== source) {
    cached = Object.freeze({source, geometry: parseRenderPath(source)})
    vectorPathGeometryCache.set(path, cached)
  }
  return cached.geometry
}

const ROOT_STYLE: ComputedStyle = Object.freeze({
  customProperties: EMPTY_CUSTOM_PROPERTIES,
  display: "block",
  boxSizing: "content-box",
  flexDirection: "row",
  flexWrap: "nowrap",
  flexGrow: 0,
  flexShrink: 1,
  flexBasis: null,
  alignContent: "normal",
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
  rowGap: 0,
  columnGap: 0,
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
  stroke: "#000000",
  strokeWidth: 1,
  pointerHitWidth: 0,
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
  const inputValueTargets = new Set<HTMLInputElement>()
  const vectorPathTargets = new Set<HTMLVectorPathElement>()
  let projectionNeutralMutations = 0
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
    if (
      frame !== null &&
      !fastPathBlocked &&
      projectionNeutralMutations > 0
    ) {
      revision++
      frame = retainProjectionFrame(frame, revision)
      dirty.clear()
      subtreeDirty.clear()
      resetFastPath()
      return frame
    }
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
      vectorPathTargets.size > 0 &&
      vectorPathTargets.size <= 8
    ) {
      const incremental = tryBuildVectorPathFrames(
            frame,
            [...vectorPathTargets],
            layoutCache,
            rules,
            options.interactionState,
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
            options.textMeasurer,
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
      inputValueTargets.size === 1
    ) {
      const target = inputValueTargets.values().next().value
      const incremental = target === undefined
        ? null
        : tryBuildInputValueFrame(
            frame,
            target,
            layoutCache,
            options.textMeasurer,
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
      options.textMeasurer,
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
        if (isProjectionNeutralMutation(record, rules)) {
          subtreeDirty.add(record.target)
          if (
            fastPathBlocked ||
            characterDataTargets.size > 0 ||
            inputValueTargets.size > 0 ||
            vectorPathTargets.size > 0 ||
            transformTarget !== null
          ) blockFastPath()
          else projectionNeutralMutations += 1
        } else if (projectionNeutralMutations > 0) {
          subtreeDirty.add(record.target)
          blockFastPath()
        } else if (
          record.type === "attributes" &&
          record.target instanceof HTMLVectorPathElement
        ) {
          subtreeDirty.add(record.target)
          vectorPathTargets.add(record.target)
          characterDataTargets.clear()
        } else if (isTransformOnlyStyleMutation(record)) {
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
        if (
          !fastPathBlocked &&
          projectionNeutralMutations === 0 &&
          record.type === "input" &&
          (record.property === "value" || record.property === "selection") &&
          INPUT_VALUE_TYPES.has(record.target.type)
        ) {
          inputValueTargets.add(record.target)
          if (inputValueTargets.size > 1) blockFastPath()
        } else {
          blockFastPath()
        }
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
    inputValueTargets.clear()
    projectionNeutralMutations = 0
    transformTarget = null
    vectorPathTargets.clear()
  }

  function resetFastPath(): void {
    fastPathBlocked = false
    characterDataTargets.clear()
    inputValueTargets.clear()
    projectionNeutralMutations = 0
    transformTarget = null
    vectorPathTargets.clear()
  }

  function assertActive(): void {
    if (disposed) throw new Error("Cannot use a disposed document renderer")
  }
}

const retainProjectionFrame = (previous: RenderFrame, revision: number): RenderFrame => {
  const next: RenderFrame = Object.freeze({
    revision,
    document: previous.document,
    root: previous.root,
    viewport: previous.viewport,
    boxes: previous.boxes,
    boxByNode: previous.boxByNode,
    displayList: previous.displayList,
    hits: previous.hits,
    ...(previous.hitOrder === undefined ? {} : {hitOrder: previous.hitOrder}),
    scrolls: previous.scrolls,
    ...(previous.presentationTransforms === undefined
      ? {}
      : {presentationTransforms: previous.presentationTransforms}),
  })
  recordCanonicalRenderFrameChanges(next, previous, [])
  collectionIndexesByFrame.set(next, collectionIndexes(previous))
  return next
}

const isProjectionNeutralMutation = (
  record: MutationBatch["records"][number],
  rules: StyleRuleIndex,
): boolean => isSelectorIndependentDataMutation(record, rules) ||
  isInvisibleChildListInsertion(record)

const isSelectorIndependentDataMutation = (
  record: MutationBatch["records"][number],
  rules: StyleRuleIndex,
): boolean => record.type === "attributes" && record.attributeName.startsWith("data-") &&
  !styleRulesDependOnAttribute(rules, record.attributeName)

const isInvisibleChildListInsertion = (
  record: MutationBatch["records"][number],
): boolean => record.type === "childList" && record.removedNodes.length === 0 &&
  record.addedNodes.length > 0 && record.addedNodes.every((node) =>
    node.nodeType === 8 || isElement(node) && node.hasAttribute("hidden"))

const tryBuildInputValueFrame = (
  previous: RenderFrame,
  target: HTMLInputElement,
  layoutCache: WeakMap<Node, LayoutNode>,
  textMeasurer: CreateDocumentRendererOptions["textMeasurer"],
  revision: number,
): RenderFrame | null => {
  if (!INPUT_VALUE_TYPES.has(target.type)) return null
  const layoutNode = layoutCache.get(target)
  const box = previous.boxByNode.get(target)
  if (!layoutNode || layoutNode.transparent || !box) return null
  const indexes = collectionIndexes(previous)
  const displayIndex = indexedDisplayItem(indexes, target, "value")
  const previousItem = displayIndex < 0 ? undefined : previous.displayList[displayIndex]
  if (previousItem?.kind !== "text") return null

  const liveValue = target.value
  const placeholder = liveValue === "" ? target.placeholder : ""
  const source = liveValue || placeholder
  if (source === "" || box.contentWidth <= 0 || box.contentHeight <= 0) return null
  const rawText = target.type === "password" && liveValue !== ""
    ? "•".repeat(graphemeCount(liveValue))
    : source.replace(/[\r\n]+/g, " ")
  const text = ellipsizeSingleLine(
    rawText,
    layoutNode.style,
    box.contentWidth,
    true,
    textMeasurer,
  )
  if (text === "" || !hasPaintableText(text)) return null

  const nextItem: DisplayItem = Object.freeze({
    ...previousItem,
    text,
    x: alignedTextX(
      layoutNode.style,
      box.contentX,
      box.contentWidth,
      textAdvance(text, layoutNode.style, textMeasurer),
    ),
    opacity: layoutNode.effectiveOpacity * (placeholder ? 0.55 : 1),
  })
  const displayList = replaceImmutableArray(previous.displayList, displayIndex, nextItem)
  const next: RenderFrame = Object.freeze({
    revision,
    document: previous.document,
    root: previous.root,
    viewport: previous.viewport,
    boxes: previous.boxes,
    boxByNode: previous.boxByNode,
    displayList,
    hits: previous.hits,
    ...(previous.hitOrder === undefined ? {} : {hitOrder: previous.hitOrder}),
    scrolls: previous.scrolls,
    ...(previous.presentationTransforms === undefined
      ? {}
      : {presentationTransforms: previous.presentationTransforms}),
  })
  recordCanonicalRenderFrameChanges(next, previous, [displayIndex])
  collectionIndexesByFrame.set(next, indexes)
  return next
}

const tryBuildCharacterDataFrame = (
  previous: RenderFrame,
  target: Text,
  layoutCache: WeakMap<Node, LayoutNode>,
  textMeasurer: CreateDocumentRendererOptions["textMeasurer"],
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
  const metrics = measureText(nextText, layoutNode.style, textMeasurer)
  const width = metrics.width
  const height = metrics.height
  if (height !== previousBox.height) return null
  const parentBox = previous.boxByNode.get(parent.node)
  const displayText = parentBox
    ? ellipsizeSingleLine(nextText, parent.style, parentBox.contentWidth, false, textMeasurer)
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
          textAdvance(displayText, layoutNode.style, textMeasurer),
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
    ...(previous.hitOrder === undefined ? {} : {hitOrder: previous.hitOrder}),
    scrolls: previous.scrolls,
    ...(previous.presentationTransforms === undefined
      ? {}
      : {presentationTransforms: previous.presentationTransforms}),
  })
  recordCanonicalRenderFrameChanges(next, previous, [displayIndex])
  collectionIndexesByFrame.set(next, indexes)
  layoutNode.text = nextText
  return next
}

const tryBuildVectorPathFrames = (
  previous: RenderFrame,
  targets: readonly HTMLVectorPathElement[],
  layoutCache: WeakMap<Node, LayoutNode>,
  rules: StyleRuleIndex,
  interactionState: CreateDocumentRendererOptions["interactionState"],
  revision: number,
): RenderFrame | null => {
  if (targets.length === 0) return null
  if (targets.length === 1) {
    return tryBuildVectorPathFrame(
      previous,
      targets[0]!,
      layoutCache,
      rules,
      interactionState,
      revision,
    )
  }

  const layoutStates = targets.map((target) => {
    const layoutNode = layoutCache.get(target)
    return Object.freeze({
      target,
      layoutNode,
      style: layoutNode?.style,
      effectiveOpacity: layoutNode?.effectiveOpacity,
    })
  })
  const intermediateFrames: RenderFrame[] = []
  const operations: CanonicalRenderFrameOperation[] = []
  let current = previous
  const rollback = (): null => {
    for (const state of layoutStates) {
      if (
        state.layoutNode === undefined ||
        state.style === undefined ||
        state.effectiveOpacity === undefined
      ) continue
      state.layoutNode.style = state.style
      state.layoutNode.effectiveOpacity = state.effectiveOpacity
    }
    collectionIndexesByFrame.delete(previous)
    for (const intermediate of intermediateFrames) collectionIndexesByFrame.delete(intermediate)
    return null
  }

  for (const target of targets) {
    const next = tryBuildVectorPathFrame(
      current,
      target,
      layoutCache,
      rules,
      interactionState,
      revision,
    )
    if (next === null) return rollback()
    const changes = readCanonicalRenderFrameChangeState(next)
    if (changes === null || changes.previous !== current) return rollback()
    if (changes.operations !== undefined) {
      operations.push(...changes.operations)
    } else {
      if (changes.indexes.length !== 1) return rollback()
      const index = changes.indexes[0]!
      const replacement = next.displayList[index]
      if (replacement === undefined) return rollback()
      operations.push(Object.freeze({
        fromIndex: index,
        toIndex: index,
        count: 1,
        replacement,
      }))
    }
    intermediateFrames.push(next)
    current = next
  }

  const indexes = collectionIndexes(current)
  const changedIndexes: number[] = []
  for (const target of targets) {
    const index = indexedDisplayItem(indexes, target, "path")
    if (index < 0) return rollback()
    changedIndexes.push(index)
  }
  recordCanonicalRenderFrameChanges(current, previous, changedIndexes, operations)
  return current
}

const tryBuildVectorPathFrame = (
  previous: RenderFrame,
  target: HTMLVectorPathElement,
  layoutCache: WeakMap<Node, LayoutNode>,
  rules: StyleRuleIndex,
  interactionState: CreateDocumentRendererOptions["interactionState"],
  revision: number,
): RenderFrame | null => {
  const layoutNode = layoutCache.get(target)
  if (layoutNode === undefined || layoutNode.parent === null) return null
  const nextStyle = computeStyle(target, layoutNode.parent.style, rules, interactionState)
  if (!samePathStyleExceptPaint(layoutNode.style, nextStyle)) return null
  const geometry = readVectorPathGeometry(target)
  const indexes = collectionIndexes(previous)
  const displayIndex = indexedDisplayItem(indexes, target, "path")
  const previousItem = displayIndex < 0 ? undefined : previous.displayList[displayIndex]
  const previousHit = previous.hits.get(target)
  const opacity = layoutNode.parent.effectiveOpacity * nextStyle.opacity
  if (
    geometry === null ||
    previousItem?.kind !== "path" ||
    previousHit?.path === undefined ||
    nextStyle.strokeWidth <= 0 ||
    opacity <= 0
  ) return null

  const nextItem: PathDisplayItem = Object.freeze({
    ...previousItem,
    geometry,
    stroke: nextStyle.stroke,
    strokeWidth: nextStyle.strokeWidth,
    opacity,
  })
  const targetWidth = Math.max(nextStyle.strokeWidth, nextStyle.pointerHitWidth)
  if (targetWidth <= 0) return null
  const envelope = vectorPathHitEnvelope(
    geometry,
    previousItem.x,
    previousItem.y,
    targetWidth,
  )
  const hitBase = createHit(
    target,
    "vector-path",
    envelope.x,
    envelope.y,
    envelope.width,
    envelope.height,
    previousHit.clips,
    IDENTITY_TRANSFORM,
    nextStyle,
  )
  const nextHit: HitMetadata = Object.freeze({
    ...hitBase,
    path: Object.freeze({
      ...previousHit.path,
      geometry,
      strokeWidth: nextStyle.strokeWidth,
      pointerHitWidth: nextStyle.pointerHitWidth,
    }),
  })
  const hits = replaceImmutableNodeMap(previous.hits, target, nextHit)
  const zIndexChanged = layoutNode.style.zIndex !== nextStyle.zIndex
  let displayList: readonly DisplayItem[] = replaceImmutableArray(
    previous.displayList,
    displayIndex,
    nextItem,
  )
  let hitOrder = previous.hitOrder === undefined
    ? undefined
    : replaceIndexedHitOrder(previous.hitOrder, indexes, previousHit, nextHit)
  let displayChanges = [displayIndex]
  let displayOperation: CanonicalRenderFrameOperation | undefined
  let reorderedBlock: PathStackBlock | null = null
  let reorderedTargetIndex = -1
  if (zIndexChanged) {
    const parent = layoutNode.parent
    if (!isElement(parent.node)) return null
    const block = indexes.pathStackByParent.get(parent.node)
    if (block === undefined || block.hitStart < 0) return null
    const targetIndex = block.nodes.indexOf(target)
    if (targetIndex < 0) return null
    const stackLevel = (child: LayoutNode, style = child.style): number => {
      const applies = parent.style.display === "flex" || style.position !== "static"
      return applies && style.zIndex !== "auto" ? style.zIndex : 0
    }
    const targetLevel = stackLevel(layoutNode, nextStyle)
    const directSiblingLevelForNode = (source: Node | null): number | null => {
      let node = source ?? null
      while (node !== null && node.parentNode !== parent.node) node = node.parentNode
      if (node === null || node === parent.node) return null
      const sibling = layoutCache.get(node)
      return sibling === undefined ? null : stackLevel(sibling)
    }
    const beforeLevel = directSiblingLevelForNode(block.beforeDisplayNode)
    const afterLevel = directSiblingLevelForNode(block.afterDisplayNode)
    const beforeHitLevel = directSiblingLevelForNode(block.beforeHitNode)
    const afterHitLevel = directSiblingLevelForNode(block.afterHitNode)
    if (
      beforeLevel !== null && targetLevel < beforeLevel ||
      afterLevel !== null && targetLevel > afterLevel ||
      beforeHitLevel !== null && targetLevel < beforeHitLevel ||
      afterHitLevel !== null && targetLevel > afterHitLevel
    ) return null
    let insertion = block.nodes.length - 1
    const targetTreeIndex = block.semanticIndexByNode.get(target) ?? -1
    if (targetTreeIndex < 0) return null
    let compactIndex = 0
    for (const node of block.nodes) {
      if (node === target) continue
      const child = layoutCache.get(node)
      if (child === undefined) return null
      const level = stackLevel(child)
      const treeIndex = block.semanticIndexByNode.get(node) ?? -1
      if (treeIndex < 0) return null
      if (level > targetLevel || level === targetLevel && treeIndex > targetTreeIndex) {
        insertion = compactIndex
        break
      }
      compactIndex += 1
    }
    const nextTargetIndex = insertion
    const nextDisplayIndex = block.displayStart + nextTargetIndex
    displayList = moveImmutableArrayEntry(
      previous.displayList,
      displayIndex,
      nextDisplayIndex,
      nextItem,
    )
    displayChanges = [nextDisplayIndex]
    displayOperation = Object.freeze({
      fromIndex: displayIndex,
      toIndex: nextDisplayIndex,
      count: 1,
      replacement: nextItem,
    })

    if (previous.hitOrder !== undefined) {
      const previousHitIndex = block.hitStart + targetIndex
      const nextHitIndex = block.hitStart + nextTargetIndex
      hitOrder = moveImmutableArrayEntry(previous.hitOrder, previousHitIndex, nextHitIndex, nextHit)
    }
    reorderedBlock = block
    reorderedTargetIndex = nextTargetIndex
  }
  const next: RenderFrame = Object.freeze({
    revision,
    document: previous.document,
    root: previous.root,
    viewport: previous.viewport,
    boxes: previous.boxes,
    boxByNode: previous.boxByNode,
    displayList,
    hits,
    ...(hitOrder === undefined ? {} : {hitOrder}),
    scrolls: previous.scrolls,
    ...(previous.presentationTransforms === undefined
      ? {}
      : {presentationTransforms: previous.presentationTransforms}),
  })
  recordCanonicalRenderFrameChanges(
    next,
    previous,
    displayChanges,
    displayOperation === undefined ? undefined : [displayOperation],
  )
  if (zIndexChanged) {
    if (reorderedBlock !== null && reorderedTargetIndex >= 0) {
      const previousTargetIndex = reorderedBlock.nodes.indexOf(target)
      if (previousTargetIndex < 0) return null
      reorderedBlock.nodes.splice(previousTargetIndex, 1)
      reorderedBlock.nodes.splice(reorderedTargetIndex, 0, target)
    }
  }
  collectionIndexesByFrame.set(next, indexes)
  layoutNode.style = nextStyle
  layoutNode.effectiveOpacity = opacity
  return next
}

const samePathStyleExceptPaint = (left: ComputedStyle, right: ComputedStyle): boolean => {
  const {
    stroke: _leftStroke,
    strokeWidth: _leftStrokeWidth,
    pointerHitWidth: _leftPointerHitWidth,
    opacity: _leftOpacity,
    zIndex: _leftZIndex,
    ...leftComparable
  } = left
  const {
    stroke: _rightStroke,
    strokeWidth: _rightStrokeWidth,
    pointerHitWidth: _rightPointerHitWidth,
    opacity: _rightOpacity,
    zIndex: _rightZIndex,
    ...rightComparable
  } = right
  return JSON.stringify(leftComparable) === JSON.stringify(rightComparable)
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
  if (target instanceof HTMLElement && target.popover !== null) {
    return null
  }
  const layoutNode = layoutCache.get(target)
  const targetBox = previous.boxByNode.get(target)
  if (!layoutNode || !targetBox) return null
  const nextStyle = computeStyle(
    target,
    layoutNode.parent?.style ?? projectionInheritedStyle,
    rules,
    interactionState,
  )
  if (!sameStyleExceptTransform(layoutNode.style, nextStyle)) return null
  const targetPreviouslyOwnedPresentation = previous.presentationTransforms?.has(target) === true
  const targetOwnsNextPresentation = nextStyle.transform.length > 0
  if (
    targetPreviouslyOwnedPresentation !== targetOwnsNextPresentation &&
    previous.displayList.some((item) => item.kind === "path" && target.contains(item.node))
  ) return null
  layoutNode.style = nextStyle

  const nextTransforms = new Map<Node, RenderTransform>()
  const parentTransform = nearestBoxTransform(layoutNode.parent, previous)
  const targetTransform = composeTransform(
    parentTransform,
    resolveElementTransform(
      nextStyle,
      targetBox.x,
      targetBox.y,
      targetBox.width,
      targetBox.height,
    ),
  )
  const ownerTransforms = presentationOwnerTransformsAfterDelta(
    previous,
    target,
    targetBox.transform,
    targetTransform,
  )
  if (isVectorPathTransformGroup(layoutNode)) {
    if (ownerTransforms !== null) {
      return buildVectorPathTransformFrame(
        previous,
        target,
        targetBox,
        targetTransform,
        ownerTransforms,
        nextStyle.transform.length > 0,
        revision,
      )
    }
  }
  if (ownerTransforms === null) return null
  for (const [owner, transform] of ownerTransforms) nextTransforms.set(owner, transform)
  collectSubtreeTransforms(layoutNode, parentTransform, previous, nextTransforms)
  if (!nextTransforms.has(target)) return null

  const indexes = collectionIndexes(previous)
  const boxEntries: Array<{index: number; value: RenderBox}> = []
  const boxMapEntries: Array<{node: Node; value: RenderBox}> = []
  const displayEntries: Array<{index: number; value: DisplayItem}> = []
  const hitEntries: Array<{node: Node; value: HitMetadata}> = []
  const hitOrderEntries: Array<{index: number; value: HitMetadata}> = []
  for (const [node, transform] of nextTransforms) {
    const boxIndex = indexes.boxByNode.get(node)
    const previousBox = boxIndex === undefined ? undefined : previous.boxes[boxIndex]
    if (boxIndex !== undefined && previousBox !== undefined && previousBox.transform !== transform) {
      const nextBox = Object.freeze({...previousBox, transform})
      boxEntries.push({index: boxIndex, value: nextBox})
      boxMapEntries.push({node, value: nextBox})
    }
    const displayIndexes = node instanceof HTMLVectorPathElement
      ? [indexedDisplayItem(indexes, node, "path")]
      : indexes.displayByNode.get(node)?.values() ?? []
    for (const displayIndex of displayIndexes) {
      if (displayIndex < 0) return null
      const item = previous.displayList[displayIndex]
      if (
        item === undefined
        || item.kind === "path" && item.presentationOwner !== null
        || item.transform === transform
      ) continue
      displayEntries.push({index: displayIndex, value: Object.freeze({...item, transform})})
    }
    if (node.nodeType !== 1) continue
    const previousHit = previous.hits.get(node)
    if (
      previousHit === undefined
      || previousHit.path?.presentationOwner !== null && previousHit.path !== undefined
      || previousHit.transform === transform
    ) continue
    const nextHit = Object.freeze({...previousHit, transform})
    hitEntries.push({node, value: nextHit})
    const hitIndex = indexedHit(indexes, previousHit)
    if (previous.hitOrder !== undefined && hitIndex !== undefined) {
      hitOrderEntries.push({index: hitIndex, value: nextHit})
      indexes.hitByRecord.set(nextHit, hitIndex)
    }
  }
  const boxes = replaceImmutableArrayEntries(previous.boxes, boxEntries)
  const boxByNode = replaceImmutableNodeMapEntries(previous.boxByNode, boxMapEntries)
  const displayList = replaceImmutableArrayEntries(previous.displayList, displayEntries)
  const hits = replaceImmutableNodeMapEntries(previous.hits, hitEntries)
  const hitOrder = previous.hitOrder === undefined
    ? undefined
    : replaceImmutableArrayEntries(previous.hitOrder, hitOrderEntries)
  const next: RenderFrame = Object.freeze({
    revision,
    document: previous.document,
    root: previous.root,
    viewport: previous.viewport,
    boxes,
    boxByNode,
    displayList,
    hits,
    ...(hitOrder === undefined ? {} : {hitOrder}),
    scrolls: previous.scrolls,
    presentationTransforms: updatedPresentationTransforms(
      previous,
      nextTransforms,
      target,
      nextStyle.transform.length > 0,
    ),
  })
  recordCanonicalRenderFrameChanges(next, previous, displayEntries.map(({index}) => index))
  collectionIndexesByFrame.set(next, indexes)
  return next
}

const presentationOwnerTransformsAfterDelta = (
  previous: RenderFrame,
  target: Element,
  oldTarget: RenderTransform,
  newTarget: RenderTransform,
): ReadonlyMap<Node, RenderTransform> | null => {
  const output = new Map<Node, RenderTransform>([[target, newTarget]])
  for (const [owner, oldTransform] of previous.presentationTransforms ?? []) {
    if (owner === target || !target.contains(owner)) continue
    if (oldTarget.scaleX === 0 || oldTarget.scaleY === 0) return null
    const relativeScaleX = oldTransform.scaleX / oldTarget.scaleX
    const relativeScaleY = oldTransform.scaleY / oldTarget.scaleY
    const relativeTranslateX = (oldTransform.translateX - oldTarget.translateX) / oldTarget.scaleX
    const relativeTranslateY = (oldTransform.translateY - oldTarget.translateY) / oldTarget.scaleY
    output.set(owner, Object.freeze({
      scaleX: newTarget.scaleX * relativeScaleX,
      scaleY: newTarget.scaleY * relativeScaleY,
      translateX: newTarget.scaleX * relativeTranslateX + newTarget.translateX,
      translateY: newTarget.scaleY * relativeTranslateY + newTarget.translateY,
    }))
  }
  return output
}

const isVectorPathTransformGroup = (layoutNode: LayoutNode): boolean =>
  layoutNode.vectorPathOnly

const buildVectorPathTransformFrame = (
  previous: RenderFrame,
  target: Element,
  targetBox: RenderBox,
  transform: RenderTransform,
  nextTransforms: ReadonlyMap<Node, RenderTransform>,
  targetOwnsTransform: boolean,
  revision: number,
): RenderFrame | null => {
  const indexes = collectionIndexes(previous)
  const boxIndex = indexes.boxByNode.get(target) ?? -1
  if (boxIndex < 0 || previous.boxes[boxIndex] !== targetBox) return null
  const nextBox = targetBox.transform === transform
    ? targetBox
    : Object.freeze({...targetBox, transform})
  const boxes = nextBox === targetBox
    ? previous.boxes
    : replaceImmutableArray(previous.boxes, boxIndex, nextBox)
  const boxByNode = nextBox === targetBox
    ? previous.boxByNode
    : replaceImmutableNodeMap(previous.boxByNode, target, nextBox)

  let displayList = previous.displayList
  for (const displayIndex of indexes.displayByNode.get(target)?.values() ?? []) {
    if (displayIndex < 0) return null
    const item = displayList[displayIndex]
    if (item === undefined || item.kind === "path") continue
    displayList = replaceImmutableArray(
      displayList,
      displayIndex,
      Object.freeze({...item, transform}),
    )
  }

  const previousTargetHit = previous.hits.get(target)
  const nextTargetHit = previousTargetHit === undefined || previousTargetHit.transform === transform
    ? previousTargetHit
    : Object.freeze({...previousTargetHit, transform})
  const hits = previousTargetHit === undefined || nextTargetHit === previousTargetHit
    ? previous.hits
    : replaceImmutableNodeMap(previous.hits, target, nextTargetHit!)
  const hitOrder = previous.hitOrder === undefined || previousTargetHit === undefined
    ? previous.hitOrder
    : replaceIndexedHitOrder(previous.hitOrder, indexes, previousTargetHit, nextTargetHit!)
  const next: RenderFrame = Object.freeze({
    revision,
    document: previous.document,
    root: previous.root,
    viewport: previous.viewport,
    boxes,
    boxByNode,
    displayList,
    hits,
    ...(hitOrder === undefined ? {} : {hitOrder}),
    scrolls: previous.scrolls,
    presentationTransforms: updatedPresentationTransforms(
      previous,
      nextTransforms,
      target,
      targetOwnsTransform,
    ),
  })
  recordCanonicalRenderFrameChanges(next, previous, [])
  collectionIndexesByFrame.set(next, indexes)
  return next
}

const replaceIndexedHitOrder = (
  values: readonly HitMetadata[],
  indexes: FrameCollectionIndexes,
  previous: HitMetadata,
  next: HitMetadata,
): readonly HitMetadata[] => {
  const index = indexedHit(indexes, previous)
  if (index === undefined) return values
  if (previous.path === undefined) indexes.hitByRecord.set(next, index)
  return replaceImmutableArray(values, index, next)
}

const updatedPresentationTransforms = (
  previous: RenderFrame,
  nextTransforms: ReadonlyMap<Node, RenderTransform>,
  target: Element,
  targetOwnsTransform: boolean,
): ReadonlyMap<Element, RenderTransform> => {
  const values = new Map(previous.presentationTransforms ?? [])
  for (const owner of values.keys()) {
    const transform = nextTransforms.get(owner)
    if (transform !== undefined) values.set(owner, transform)
  }
  const targetTransform = nextTransforms.get(target)
  if (targetOwnsTransform && targetTransform !== undefined) values.set(target, targetTransform)
  else values.delete(target)
  return immutableNodeMap(values)
}

const collectSubtreeTransforms = (
  layoutNode: LayoutNode,
  inherited: RenderTransform,
  frame: RenderFrame,
  output: Map<Node, RenderTransform>,
): void => {
  const box = frame.boxByNode.get(layoutNode.node)
  const pathItemIndex = layoutNode.node instanceof HTMLVectorPathElement &&
    layoutNode.style.transform.length > 0
    ? indexedDisplayItem(collectionIndexes(frame), layoutNode.node, "path")
    : undefined
  const pathItem = pathItemIndex === undefined || pathItemIndex < 0
    ? undefined
    : frame.displayList[pathItemIndex]
  const transform = box === undefined
    ? pathItem?.kind === "path" && layoutNode.style.transform.length > 0
      ? composeTransform(
          inherited,
          resolveElementTransform(layoutNode.style, pathItem.x, pathItem.y, 0, 0),
        )
      : inherited
    : composeTransform(
        inherited,
        resolveElementTransform(layoutNode.style, box.x, box.y, box.width, box.height),
      )
  if (box !== undefined) output.set(layoutNode.node, transform)
  else if (pathItem?.kind === "path" && layoutNode.style.transform.length > 0) {
    output.set(layoutNode.node, transform)
  }
  for (const child of layoutNode.transformChildren) {
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
  return layoutNode.ownsOverflowClipInSubtree
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
  const indexes = indexCollections(frame.boxes, frame.displayList, frame.hitOrder)
  collectionIndexesByFrame.set(frame, indexes)
  return indexes
}

const indexedDisplayItem = (
  indexes: FrameCollectionIndexes,
  node: Node,
  key: string,
): number => {
  if (key === "path" && node instanceof HTMLVectorPathElement) {
    const parent = node.parentElement
    const block = parent === null ? undefined : indexes.pathStackByParent.get(parent)
    if (block !== undefined) {
      const position = block.nodes.indexOf(node)
      if (position >= 0) return block.displayStart + position
    }
  }
  return indexes.displayByNode.get(node)?.get(key) ?? -1
}

const indexedHit = (
  indexes: FrameCollectionIndexes,
  hit: HitMetadata,
): number | undefined => {
  if (hit.path !== undefined && hit.node instanceof HTMLVectorPathElement) {
    const parent = hit.node.parentElement
    const block = parent === null ? undefined : indexes.pathStackByParent.get(parent)
    if (block !== undefined && block.hitStart >= 0) {
      const position = block.nodes.indexOf(hit.node)
      if (position >= 0) return block.hitStart + position
    }
  }
  return indexes.hitByRecord.get(hit)
}

const indexCollections = (
  boxes: readonly RenderBox[],
  displayList: readonly DisplayItem[],
  hitOrder?: readonly HitMetadata[],
): FrameCollectionIndexes => {
  const boxByNode = new WeakMap<Node, number>()
  const mutableDisplay = new WeakMap<Node, Map<string, number>>()
  const hitByRecord = new WeakMap<HitMetadata, number>()
  const pathStackByParent = new WeakMap<Element, PathStackBlock>()
  const invalidPathParents = new WeakSet<Element>()
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
  for (let index = 0; index < displayList.length;) {
    const item = displayList[index]
    if (item?.kind !== "path" || item.node.parentElement === null) {
      index += 1
      continue
    }
    const parent = item.node.parentElement
    const start = index
    const nodes: HTMLVectorPathElement[] = []
    while (index < displayList.length) {
      const candidate = displayList[index]
      if (candidate?.kind !== "path" || candidate.node.parentElement !== parent) break
      nodes.push(candidate.node as HTMLVectorPathElement)
      index += 1
    }
    if (invalidPathParents.has(parent) || pathStackByParent.has(parent)) {
      invalidPathParents.add(parent)
      pathStackByParent.delete(parent)
      continue
    }
    const semanticIndexByNode = new WeakMap<HTMLVectorPathElement, number>()
    const semanticChildren = parent.children
    for (let semanticIndex = 0; semanticIndex < semanticChildren.length; semanticIndex += 1) {
      const child = semanticChildren[semanticIndex]
      if (child instanceof HTMLVectorPathElement) semanticIndexByNode.set(child, semanticIndex)
    }
    pathStackByParent.set(parent, {
      parent,
      nodes,
      semanticIndexByNode,
      displayStart: start,
      hitStart: -1,
      beforeDisplayNode: displayList[start - 1]?.node ?? null,
      afterDisplayNode: displayList[index]?.node ?? null,
      beforeHitNode: null,
      afterHitNode: null,
    })
  }
  if (hitOrder !== undefined) {
    for (let index = 0; index < hitOrder.length; index += 1) {
      const hit = hitOrder[index]
      if (hit !== undefined) hitByRecord.set(hit, index)
    }
    for (let index = 0; index < hitOrder.length;) {
      const hit = hitOrder[index]
      const parent = hit?.path?.presentationOwner === undefined
        ? hit?.node.parentElement ?? null
        : hit.node.parentElement
      if (hit?.path === undefined || parent === null) {
        index += 1
        continue
      }
      const block = pathStackByParent.get(parent)
      const start = index
      const nodes: Element[] = []
      while (index < hitOrder.length) {
        const candidate = hitOrder[index]
        if (candidate?.path === undefined || candidate.node.parentElement !== parent) break
        nodes.push(candidate.node)
        index += 1
      }
      if (
        block === undefined ||
        nodes.length !== block.nodes.length ||
        nodes.some((node, pathIndex) => node !== block.nodes[pathIndex])
      ) {
        pathStackByParent.delete(parent)
        continue
      }
      block.hitStart = start
      block.beforeHitNode = hitOrder[start - 1]?.node ?? null
      block.afterHitNode = hitOrder[index]?.node ?? null
    }
  }
  return Object.freeze({
    boxByNode,
    displayByNode: mutableDisplay as WeakMap<Node, ReadonlyMap<string, number>>,
    hitByRecord,
    pathStackByParent,
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
  textMeasurer: CreateDocumentRendererOptions["textMeasurer"],
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
    presentationTransforms: new Map(),
    measured: new WeakMap(),
    textMeasurer,
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
    presentationOwner: null,
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
    const placement = popoverTopLayerPlacement(
      popover,
      width,
      height,
      viewport,
      state,
    )
    place(
      topTree,
      placement.x,
      placement.y,
      viewport.width,
      viewport.height,
      width,
      height,
      viewportTopLayerClips(viewport),
      0,
      state,
      viewportContext,
      false,
    )
  }

  const openSelect = document.readOpenSelectPicker()
  if (openSelect !== null && (root === openSelect || root.contains(openSelect))) {
    emitSelectPicker(openSelect, viewport, layoutCache, state)
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
  const hitOrder = immutableArray([...orderedHits.values()])
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
    hitOrder,
    scrolls,
    presentationTransforms: immutableNodeMap(state.presentationTransforms),
  })
  return frame
}

const popoverTopLayerPlacement = (
  popover: HTMLElement,
  width: number,
  height: number,
  viewport: RenderViewport,
  state: BuildState,
): Readonly<{x: number; y: number}> => {
  const source = (popover as HTMLElement & {
    [getPopoverSource](): HTMLElement | null
  })[getPopoverSource]()
  const sourceBox = source === null ? undefined : state.boxByNode.get(source)
  if (sourceBox === undefined) {
    return Object.freeze({
      x: Math.max(0, (viewport.width - width) / 2),
      y: Math.max(0, (viewport.height - height) / 2),
    })
  }
  const anchor = transformedRectBounds(
    sourceBox.x,
    sourceBox.y,
    sourceBox.width,
    sourceBox.height,
    sourceBox.transform,
  )
  const gap = 4
  const availableBelow = Math.max(0, viewport.height - anchor.bottom - gap)
  const availableAbove = Math.max(0, anchor.top - gap)
  const placeBelow = height <= availableBelow || availableBelow >= availableAbove
  const requestedY = placeBelow
    ? anchor.bottom + gap
    : anchor.top - gap - height
  return Object.freeze({
    x: Math.max(0, Math.min(Math.max(0, viewport.width - width), anchor.left)),
    y: Math.max(0, Math.min(Math.max(0, viewport.height - height), requestedY)),
  })
}

const viewportTopLayerClips = (viewport: RenderViewport): readonly RenderClip[] =>
  Object.freeze([Object.freeze({
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
    radii: ZERO_CLIP_RADII,
    clipX: true,
    clipY: true,
    transform: IDENTITY_TRANSFORM,
  })])

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
      transformChildren: Object.freeze([]),
      ownsOverflowClipInSubtree: false,
      vectorPathOnly: false,
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
      transformChildren: [],
      ownsOverflowClipInSubtree: false,
      vectorPathOnly: false,
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
        tag === "textarea" ||
        tag === "vector-path"
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
    finalizeLayoutNodeChildren(layoutNode)
    layoutCache.set(node, layoutNode)
    return layoutNode
  }

  const layoutNode: LayoutNode = {
    node,
    parent,
    style: inheritedStyle,
    effectiveOpacity: inheritedOpacity,
    children: [],
    transformChildren: [],
    ownsOverflowClipInSubtree: false,
    vectorPathOnly: false,
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
  finalizeLayoutNodeChildren(layoutNode)
  layoutCache.set(node, layoutNode)
  return layoutNode
}

const finalizeLayoutNodeChildren = (layoutNode: LayoutNode): void => {
  layoutNode.transformChildren = Object.freeze(
    layoutNode.children.filter((child) =>
      child.style.display !== "none" && !(child.node instanceof HTMLVectorPathElement)),
  )
  layoutNode.vectorPathOnly = layoutNode.children.length > 0 &&
    layoutNode.transformChildren.length === 0
  layoutNode.ownsOverflowClipInSubtree =
    layoutNode.style.overflowX !== "visible" ||
    layoutNode.style.overflowY !== "visible" ||
    layoutNode.transformChildren.some((child) => child.ownsOverflowClipInSubtree)
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

  if (layoutNode.node instanceof HTMLVectorPathElement)
    return rememberSize(layoutNode, availableWidth, availableHeight, 0, 0, state)

  if (layoutNode.text !== null) {
    const {width, height} = measureText(layoutNode.text, layoutNode.style, state.textMeasurer)
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
  const children = layoutNode.style.display === "flex"
    ? flexFlowChildren(layoutNode)
    : flowChildren(layoutNode)
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
  const mainGap = layoutNode.style.display === "flex"
    ? flexMainGap(layoutNode.style, rowFlex)
    : 0
  const crossGap = layoutNode.style.display === "flex"
    ? flexCrossGap(layoutNode.style, rowFlex)
    : 0
  const gaps = Math.max(0, childSizes.length - 1) * mainGap

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
      mainGap,
      crossGap,
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

const flexFlowChildren = (layoutNode: LayoutNode): readonly LayoutNode[] => {
  const children = flowChildren(layoutNode)
  return children.some((child) => child.style.display === "none" || child.text === "")
    ? children.filter((child) => child.style.display !== "none" && child.text !== "")
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
  mainGap: number,
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
      : usedMain + mainGap + mainOuter
    if (wrap && indices.length > 0 && nextMain > mainAvailable) commit()
    usedMain = indices.length === 0 ? mainOuter : usedMain + mainGap + mainOuter
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
  mainGap: number,
  crossGap: number,
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
    mainGap,
    true,
  )
  const naturalMain = lines.reduce((maximum, line) => {
    const lineMain = line.indices.reduce((sum, index, lineIndex) => {
      const child = children[index]
      const margin = child?.style.margin ?? ZERO_EDGES
      return sum +
        (baseSizes[index] ?? 0) +
        (row ? horizontal(margin) : vertical(margin)) +
        (lineIndex === 0 ? 0 : mainGap)
    }, 0)
    return Math.max(maximum, lineMain)
  }, 0)
  const naturalCross = lines.reduce(
    (sum, line, index) => sum + line.crossSize + (index === 0 ? 0 : crossGap),
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
  presentationOwner: Element | null,
): PlacementContext => {
  const establishesAbsolute = layoutNode.style.position !== "static" &&
    (layoutNode.style.display === "block" || layoutNode.style.display === "flex")
  const hasRelativeChild = layoutNode.children.some(
    (child) => child.style.position === "relative",
  )
  if (
    !establishesAbsolute &&
    !hasRelativeChild &&
    presentation === parent.presentation &&
    presentationOwner === parent.presentationOwner
  ) {
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
  return Object.freeze({absolute, normal, presentation, presentationOwner})
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
  const localPresentation = resolveElementTransform(layoutNode.style, x, y, width, height)
  const presentation = composeTransform(
    context.presentation,
    localPresentation,
  )
  state.transforms.set(layoutNode.node, presentation)
  const presentationOwner = layoutNode.style.transform.length === 0
    ? context.presentationOwner
    : isElement(layoutNode.node)
      ? layoutNode.node
      : context.presentationOwner
  if (
    layoutNode.style.transform.length > 0 &&
    presentationOwner === layoutNode.node &&
    isElement(layoutNode.node)
  ) {
    state.presentationTransforms.set(layoutNode.node, presentation)
  }

  if (layoutNode.node instanceof HTMLVectorPathElement) {
    emitVectorPath(
      layoutNode.node,
      layoutNode,
      x,
      y,
      clips,
      presentationOwner,
      state,
    )
    return Object.freeze({width: 0, height: 0})
  }

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
        layoutNode.style,
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
    presentationOwner,
  )
  const descendantBoxStart = state.boxes.length
  const descendantDisplayStart = state.displayList.length
  emitReplacedControlPresentation(layoutNode, box, descendantClips, state)
  const childrenContext = childPlacementContext(
    layoutNode,
    box,
    context,
    presentation,
    presentationOwner,
  )

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
  const mainGap = flexMainGap(layoutNode.style, row)
  const crossGap = flexCrossGap(layoutNode.style, row)
  const wrap = layoutNode.style.flexWrap !== "nowrap"
  const wrapReverse = layoutNode.style.flexWrap === "wrap-reverse"
  const children = flexFlowChildren(layoutNode)
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
    mainGap,
    wrap,
  )
  const lineAlignment = wrap
    ? alignFlexLines(
        layoutNode.style.alignContent,
        lines.map((line) => line.crossSize),
        crossAvailable,
        crossGap,
      )
    : Object.freeze({
        lineSizes: Object.freeze(lines.map(() => crossAvailable)),
        offset: 0,
        extraGap: 0,
      })
  const crossOrigin = row ? y : x
  let logicalCrossCursor = lineAlignment.offset
  let treeCursor = 0
  for (let flexLineIndex = 0; flexLineIndex < lines.length; flexLineIndex++) {
    const line = lines[flexLineIndex]
    if (!line) continue
    const lineChildren = line.indices.map((index) => children[index]!)
    const lineBases = line.indices.map((index) => baseSizes[index] ?? 0)
    const lineMainMargins = lineChildren.map((child) =>
      row ? horizontal(child.style.margin) : vertical(child.style.margin),
    )
    const baseOuter = lineBases.reduce(
      (sum, size, index) => sum + size + (lineMainMargins[index] ?? 0),
      0,
    )
    const gapTotal = Math.max(0, lineChildren.length - 1) * mainGap
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
    const lineCrossSize = lineAlignment.lineSizes[flexLineIndex] ?? 0
    const lineCrossStart = wrapReverse
      ? crossOrigin + crossAvailable - logicalCrossCursor - lineCrossSize
      : crossOrigin + logicalCrossCursor
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
        wrapReverse
          ? row ? margin.bottom : margin.right
          : row ? margin.top : margin.left,
        wrapReverse
          ? row ? margin.top : margin.left
          : row ? margin.bottom : margin.right,
        wrapReverse,
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
      mainCursor += mainSize + mainEndMargin + mainGap + justify.extraGap
    }
    logicalCrossCursor += lineCrossSize + crossGap + lineAlignment.extraGap
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
  const crossReverse = parent.style.flexWrap === "wrap-reverse"
  const crossPosition = alignCrossPosition(
    parent.style.alignItems,
    row ? y : x,
    row ? height : width,
    row ? childHeight : childWidth,
    crossReverse
      ? row ? margin.bottom : margin.right
      : row ? margin.top : margin.left,
    crossReverse
      ? row ? margin.top : margin.left
      : row ? margin.bottom : margin.right,
    crossReverse,
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

  const children = node.style.display === "flex" ? flexFlowChildren(node) : flowChildren(node)
  const childWidths = children.map(
    (child) =>
      intrinsicWidth(child, availableWidth, availableHeight, state) +
      horizontal(child.style.margin),
  )
  const content =
    node.style.display === "inline"
      ? childWidths.reduce((sum, value) => sum + value, 0)
      : node.style.display === "flex" && node.style.flexDirection === "row"
        ? childWidths.reduce((sum, value) => sum + value, 0) +
          Math.max(0, childWidths.length - 1) * node.style.columnGap
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

  const children = node.style.display === "flex" ? flexFlowChildren(node) : flowChildren(node)
  const childHeights = children.map(
    (child) =>
      intrinsicHeight(child, availableWidth, availableHeight, state) +
      vertical(child.style.margin),
  )
  const content =
    node.style.display === "inline" ||
    (node.style.display === "flex" && node.style.flexDirection === "row")
      ? childHeights.reduce((maximum, value) => Math.max(maximum, value), 0)
      : node.style.display === "flex"
        ? childHeights.reduce((sum, value) => sum + value, 0) +
          Math.max(0, childHeights.length - 1) * node.style.rowGap
        : childHeights.reduce((sum, value) => sum + value, 0)
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
  const children = flexFlowChildren(node)
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
    flexMainGap(node.style, row),
    flexCrossGap(node.style, row),
    state,
  )
}

const flexMainGap = (style: ComputedStyle, row: boolean): number =>
  row ? style.columnGap : style.rowGap

const flexCrossGap = (style: ComputedStyle, row: boolean): number =>
  row ? style.rowGap : style.columnGap

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

const alignFlexLines = (
  align: ComputedStyle["alignContent"],
  naturalLineSizes: readonly number[],
  available: number,
  crossGap: number,
): Readonly<{
  lineSizes: readonly number[]
  offset: number
  extraGap: number
}> => {
  const count = naturalLineSizes.length
  const used = naturalLineSizes.reduce((sum, size) => sum + size, 0) +
    Math.max(0, count - 1) * crossGap
  const free = available - used
  if ((align === "normal" || align === "stretch") && free > 0 && count > 0) {
    const addition = free / count
    return Object.freeze({
      lineSizes: Object.freeze(naturalLineSizes.map((size) => size + addition)),
      offset: 0,
      extraGap: 0,
    })
  }

  const lineSizes = Object.freeze([...naturalLineSizes])
  switch (align) {
    case "center":
      if (free <= 0) {
        return Object.freeze({lineSizes, offset: free / 2, extraGap: 0})
      }
      break
    case "flex-end":
      return Object.freeze({lineSizes, offset: free, extraGap: 0})
    case "space-between":
      if (free <= 0 || count <= 1) {
        return Object.freeze({lineSizes, offset: 0, extraGap: 0})
      }
      return Object.freeze({
        lineSizes,
        offset: 0,
        extraGap: free / (count - 1),
      })
    case "space-around":
    case "space-evenly":
      if (free <= 0) return Object.freeze({lineSizes, offset: 0, extraGap: 0})
      break
    default:
      return Object.freeze({lineSizes, offset: 0, extraGap: 0})
  }

  if (align === "center") {
    return Object.freeze({lineSizes, offset: free / 2, extraGap: 0})
  }
  if (align === "space-around") {
    const space = count > 0 ? free / count : 0
    return Object.freeze({lineSizes, offset: space / 2, extraGap: space})
  }
  const space = free / (count + 1)
  return Object.freeze({lineSizes, offset: space, extraGap: space})
}

const alignCrossPosition = (
  align: ComputedStyle["alignItems"],
  start: number,
  available: number,
  size: number,
  startMargin: number,
  endMargin: number,
  reverse = false,
): number => {
  const free = available - size - startMargin - endMargin
  if (reverse) {
    switch (align) {
      case "center":
        return start + endMargin + free / 2
      case "flex-end":
        return start + endMargin
      default:
        return start + available - startMargin - size
    }
  }
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
  presentationOwner: Element | null,
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
    ...(presentationOwner === null ? {} : {presentationOwner}),
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
  const text = ellipsizeSingleLine(
    rawText,
    layoutNode.style,
    box.contentWidth,
    true,
    state.textMeasurer,
  )
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
        textAdvance(text, layoutNode.style, state.textMeasurer),
      ),
      y: box.contentY + Math.max(0, (box.contentHeight - lineHeight) / 2),
      color: layoutNode.style.color,
      fontSize: layoutNode.style.fontSize,
      lineHeight,
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

const emitVectorPath = (
  path: HTMLVectorPathElement,
  layoutNode: LayoutNode,
  x: number,
  y: number,
  clips: readonly RenderClip[],
  presentationOwner: Element | null,
  state: BuildState,
): void => {
  const geometry = readVectorPathGeometry(path)
  if (geometry === null) return

  if (layoutNode.style.strokeWidth > 0 && layoutNode.effectiveOpacity > 0) {
    state.displayList.push(Object.freeze({
      kind: "path",
      key: "path",
      node: path,
      x,
      y,
      geometry,
      stroke: layoutNode.style.stroke,
      strokeWidth: layoutNode.style.strokeWidth,
      opacity: layoutNode.effectiveOpacity,
      clips,
      presentationOwner,
      transform: IDENTITY_TRANSFORM,
    }))
  }

  const targetWidth = Math.max(layoutNode.style.strokeWidth, layoutNode.style.pointerHitWidth)
  if (targetWidth <= 0) return
  const envelope = vectorPathHitEnvelope(geometry, x, y, targetWidth)
  const base = createHit(
    path,
    "vector-path",
    envelope.x,
    envelope.y,
    envelope.width,
    envelope.height,
    clips,
    IDENTITY_TRANSFORM,
    layoutNode.style,
  )
  state.hits.set(path, Object.freeze({
    ...base,
    path: Object.freeze({
      geometry,
      originX: x,
      originY: y,
      strokeWidth: layoutNode.style.strokeWidth,
      pointerHitWidth: layoutNode.style.pointerHitWidth,
      presentationOwner,
    }),
  }))
  state.hitOrder.push(path)
}

const vectorPathHitEnvelope = (
  geometry: RenderPathGeometry,
  originX: number,
  originY: number,
  targetWidth: number,
): Readonly<{x: number; y: number; width: number; height: number}> => {
  let longest = geometry.segments[0]!
  let longestLengthSquared = -1
  for (const segment of geometry.segments) {
    const deltaX = segment.to.x - segment.from.x
    const deltaY = segment.to.y - segment.from.y
    const lengthSquared = deltaX * deltaX + deltaY * deltaY
    if (lengthSquared > longestLengthSquared) {
      longest = segment
      longestLengthSquared = lengthSquared
    }
  }
  const centerX = originX + (longest.from.x + longest.to.x) / 2
  const centerY = originY + (longest.from.y + longest.to.y) / 2
  const radius = targetWidth / 2
  const bounds = geometry.bounds
  const minimumX = originX + bounds.x - radius
  const minimumY = originY + bounds.y - radius
  const maximumX = originX + bounds.x + bounds.width + radius
  const maximumY = originY + bounds.y + bounds.height + radius
  const halfWidth = Math.max(centerX - minimumX, maximumX - centerX)
  const halfHeight = Math.max(centerY - minimumY, maximumY - centerY)
  return Object.freeze({
    x: centerX - halfWidth,
    y: centerY - halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  })
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
  if (box.contentWidth <= 0 || box.contentHeight <= 0) return
  const disclosureWidth = Math.min(
    box.contentWidth,
    Math.min(16, Math.max(8, box.contentHeight)),
  )
  const labelWidth = Math.max(0, box.contentWidth - disclosureWidth - 4)
  const selectedIndex = select.selectedIndex
  const option = selectedIndex < 0 ? null : select.options.item(selectedIndex)
  const label = ellipsizeSingleLine(
    option?.label ?? "",
    layoutNode.style,
    labelWidth,
    true,
    state.textMeasurer,
  )
  const lineHeight = resolveLineHeight(layoutNode.style)
  if (label !== "" && hasPaintableText(label) && labelWidth > 0) {
    state.displayList.push(Object.freeze({
      kind: "text",
      key: "value",
      node: select,
      text: label,
      x: alignedTextX(
        layoutNode.style,
        box.contentX,
        labelWidth,
        textAdvance(label, layoutNode.style, state.textMeasurer),
      ),
      y: box.contentY + Math.max(0, (box.contentHeight - lineHeight) / 2),
      color: layoutNode.style.color,
      fontSize: layoutNode.style.fontSize,
      lineHeight,
      letterSpacing: layoutNode.style.letterSpacing,
      opacity: layoutNode.effectiveOpacity,
      clips,
      transform: presentationFor(select, state),
    }))
  }
  emitControlGlyph(
    select,
    "disclosure-indicator",
    "▾",
    box.contentX + box.contentWidth - disclosureWidth,
    box.contentY,
    disclosureWidth,
    box.contentHeight,
    layoutNode.style.color,
    layoutNode.effectiveOpacity,
    clips,
    presentationFor(select, state),
    state,
  )
}

const emitSelectPicker = (
  select: HTMLSelectElement,
  viewport: RenderViewport,
  layoutCache: WeakMap<Node, LayoutNode>,
  state: BuildState,
): void => {
  const box = state.boxByNode.get(select)
  const layoutNode = layoutCache.get(select)
  const options = [...select.options]
  if (box === undefined || layoutNode === undefined || options.length === 0) return
  const transform = box.transform
  const scaleX = Math.abs(transform.scaleX)
  const scaleY = Math.abs(transform.scaleY)
  if (scaleX === 0 || scaleY === 0) return
  const lineHeight = resolveLineHeight(layoutNode.style)
  const rowHeight = Math.max(box.height, lineHeight + 8)
  const visualSelect = transformedRectBounds(
    box.x,
    box.y,
    box.width,
    box.height,
    transform,
  )
  const visualRowHeight = rowHeight * scaleY
  const rowsBelow = Math.max(
    0,
    Math.floor((viewport.height - visualSelect.bottom) / visualRowHeight),
  )
  const rowsAbove = Math.max(0, Math.floor(visualSelect.top / visualRowHeight))
  const maximumRows = Math.min(options.length, 8)
  const placeBelow = rowsBelow >= maximumRows || rowsBelow >= rowsAbove
  const visibleRows = Math.max(1, Math.min(maximumRows, placeBelow ? rowsBelow : rowsAbove))
  const selectedIndex = Math.max(0, select.selectedIndex)
  const firstIndex = Math.max(
    0,
    Math.min(options.length - visibleRows, selectedIndex - Math.floor(visibleRows / 2)),
  )
  const visibleOptions = options.slice(firstIndex, firstIndex + visibleRows)
  const pickerHeight = visibleOptions.length * rowHeight
  const visualPickerWidth = box.width * scaleX
  const visualPickerHeight = pickerHeight * scaleY
  const visualPickerX = Math.max(
    0,
    Math.min(Math.max(0, viewport.width - visualPickerWidth), visualSelect.left),
  )
  const visualPickerY = placeBelow
    ? Math.max(0, Math.min(viewport.height - visualPickerHeight, visualSelect.bottom))
    : Math.max(0, visualSelect.top - visualPickerHeight)
  const pickerX = localRectStart(
    visualPickerX,
    visualPickerWidth,
    transform.scaleX,
    transform.translateX,
  )
  const pickerY = localRectStart(
    visualPickerY,
    visualPickerHeight,
    transform.scaleY,
    transform.translateY,
  )
  const pickerColor = "#111827"
  const selectedColor = "#2563eb"
  const ordinaryColor = "#1f2937"
  state.displayList.push(Object.freeze({
    kind: "rect",
    key: "picker-background",
    node: select,
    x: pickerX,
    y: pickerY,
    width: box.width,
    height: pickerHeight,
    color: pickerColor,
    opacity: layoutNode.effectiveOpacity,
    border: roundRectPaintBorder(2, pickerColor),
    shadow: null,
    clips: NO_CLIPS,
    transform,
  }))
  for (let visibleIndex = 0; visibleIndex < visibleOptions.length; visibleIndex += 1) {
    const option = visibleOptions[visibleIndex]!
    const optionIndex = firstIndex + visibleIndex
    const y = pickerY + visibleIndex * rowHeight
    const optionBox: RenderBox = Object.freeze({
      node: option,
      parent: select,
      depth: box.depth + 1,
      display: "block",
      x: pickerX,
      y,
      width: box.width,
      height: rowHeight,
      contentX: pickerX + 6,
      contentY: y + 4,
      contentWidth: Math.max(0, box.width - 12),
      contentHeight: Math.max(0, rowHeight - 8),
      margin: ZERO_EDGES,
      padding: Object.freeze({top: 4, right: 6, bottom: 4, left: 6}),
      border: ZERO_BORDER,
      transform,
    })
    state.boxes.push(optionBox)
    state.boxByNode.set(option, optionBox)
    const background = optionIndex === select.selectedIndex ? selectedColor : ordinaryColor
    state.displayList.push(Object.freeze({
      kind: "rect",
      key: "picker-option-background",
      node: option,
      x: pickerX,
      y,
      width: box.width,
      height: rowHeight,
      color: background,
      opacity: layoutNode.effectiveOpacity * (option.disabled ? 0.5 : 1),
      border: ZERO_BORDER,
      shadow: null,
      clips: NO_CLIPS,
      transform,
    }))
    const label = ellipsizeSingleLine(
      option.label,
      layoutNode.style,
      optionBox.contentWidth,
      true,
      state.textMeasurer,
    )
    if (label !== "" && hasPaintableText(label)) {
      state.displayList.push(Object.freeze({
        kind: "text",
        key: "picker-option-label",
        node: option,
        text: label,
        x: optionBox.contentX,
        y: optionBox.contentY + Math.max(0, (optionBox.contentHeight - lineHeight) / 2),
        color: layoutNode.style.color,
        fontSize: layoutNode.style.fontSize,
        lineHeight,
        letterSpacing: layoutNode.style.letterSpacing,
        opacity: layoutNode.effectiveOpacity * (option.disabled ? 0.5 : 1),
        clips: NO_CLIPS,
        transform,
      }))
    }
    const hit: HitMetadata = Object.freeze({
      node: option,
      x: pickerX,
      y,
      width: box.width,
      height: rowHeight,
      interactive: !option.disabled,
      disabled: option.disabled,
      role: "option",
      clips: NO_CLIPS,
      transform,
    })
    state.hits.set(option, hit)
    state.hitOrder.push(option)
  }
}

const transformedRectBounds = (
  x: number,
  y: number,
  width: number,
  height: number,
  transform: RenderTransform,
): Readonly<{left: number; top: number; right: number; bottom: number}> => {
  const firstX = x * transform.scaleX + transform.translateX
  const secondX = (x + width) * transform.scaleX + transform.translateX
  const firstY = y * transform.scaleY + transform.translateY
  const secondY = (y + height) * transform.scaleY + transform.translateY
  return Object.freeze({
    left: Math.min(firstX, secondX),
    top: Math.min(firstY, secondY),
    right: Math.max(firstX, secondX),
    bottom: Math.max(firstY, secondY),
  })
}

const localRectStart = (
  visualStart: number,
  visualSize: number,
  scale: number,
  translate: number,
): number => scale > 0
  ? (visualStart - translate) / scale
  : (visualStart + visualSize - translate) / scale

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
  const capacity = textCapacity(layoutNode.style, box.contentWidth)
  const lines = source === ""
    ? Object.freeze([])
    : textAreaVisualLines(
        source,
        layoutNode.style.whiteSpace,
        textArea.wrap,
        capacity,
      )
  const lineHeight = resolveLineHeight(layoutNode.style)
  emitTextAreaSelection(textArea, layoutNode, box, clips, lineHeight, state)
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
        textAdvance(line, layoutNode.style, state.textMeasurer),
      ),
      y: box.contentY + index * lineHeight,
      color: layoutNode.style.color,
      fontSize: layoutNode.style.fontSize,
      lineHeight,
      letterSpacing: layoutNode.style.letterSpacing,
      opacity: layoutNode.effectiveOpacity * (placeholder ? 0.55 : 1),
      clips,
      transform: presentationFor(textArea, state),
    }))
  }
}

const emitTextAreaSelection = (
  textArea: HTMLTextAreaElement,
  layoutNode: LayoutNode,
  box: RenderBox,
  clips: readonly RenderClip[],
  lineHeight: number,
  state: BuildState,
): void => {
  if (
    textArea.disabled ||
    textArea.ownerDocument?.activeElement !== textArea ||
    textArea.wrap !== "off" ||
    layoutNode.style.whiteSpace !== "pre" ||
    lineHeight <= 0
  ) return
  const lines = textArea.value.split("\n")
  const start = textArea.selectionStart
  const end = textArea.selectionEnd
  const transform = presentationFor(textArea, state)
  if (start === end) {
    const position = textAreaLinePosition(lines, end)
    const line = lines[position.line] ?? ""
    const lineX = alignedTextX(
      layoutNode.style,
      box.contentX,
      box.contentWidth,
      textAdvance(line, layoutNode.style, state.textMeasurer),
    )
    state.displayList.push(Object.freeze({
      kind: "rect",
      key: "caret",
      node: textArea,
      x: lineX + textAdvance(
        line.slice(0, position.column),
        layoutNode.style,
        state.textMeasurer,
      ),
      y: box.contentY + position.line * lineHeight,
      width: 1,
      height: lineHeight,
      color: TEXT_SELECTION_COLOR,
      opacity: 1,
      border: ZERO_BORDER,
      shadow: null,
      clips,
      transform,
    }))
    return
  }
  let lineStart = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const lineEnd = lineStart + line.length
    const selectionStart = Math.max(start, lineStart)
    const selectionEnd = Math.min(end, lineEnd)
    const includesNewline = index < lines.length - 1 && start <= lineEnd && end > lineEnd
    if (selectionStart < selectionEnd || includesNewline) {
      const startColumn = Math.max(0, selectionStart - lineStart)
      const endColumn = Math.max(startColumn, selectionEnd - lineStart)
      const lineX = alignedTextX(
        layoutNode.style,
        box.contentX,
        box.contentWidth,
        textAdvance(line, layoutNode.style, state.textMeasurer),
      )
      const x = lineX + textAdvance(
        line.slice(0, startColumn),
        layoutNode.style,
        state.textMeasurer,
      )
      const selectedWidth = textAdvance(
        line.slice(startColumn, endColumn),
        layoutNode.style,
        state.textMeasurer,
      )
      state.displayList.push(Object.freeze({
        kind: "rect",
        key: `selection:${index}`,
        node: textArea,
        x,
        y: box.contentY + index * lineHeight,
        width: Math.max(includesNewline ? 2 : 1, selectedWidth),
        height: lineHeight,
        color: TEXT_SELECTION_COLOR,
        opacity: 0.35,
        border: ZERO_BORDER,
        shadow: null,
        clips,
        transform,
      }))
    }
    lineStart = lineEnd + 1
  }
}

const textAreaLinePosition = (
  lines: readonly string[],
  offset: number,
): Readonly<{line: number; column: number}> => {
  let lineStart = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const lineEnd = lineStart + line.length
    if (offset <= lineEnd || index === lines.length - 1) {
      return Object.freeze({
        line: index,
        column: Math.max(0, Math.min(line.length, offset - lineStart)),
      })
    }
    lineStart = lineEnd + 1
  }
  return Object.freeze({line: 0, column: 0})
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
  if (input.type === "checkbox") {
    const glyphSize = Math.min(12, box.contentWidth, box.contentHeight)
    state.displayList.push(Object.freeze({
      kind: "path",
      key: "indicator",
      node: input,
      x: box.contentX + (box.contentWidth - glyphSize) / 2,
      y: box.contentY + (box.contentHeight - glyphSize) / 2,
      geometry: checkboxIndicatorGeometry,
      stroke: layoutNode.style.color,
      strokeWidth: 2,
      opacity: layoutNode.effectiveOpacity,
      clips,
      presentationOwner: null,
      transform: presentationFor(input, state),
    }))
    return
  }
  const radius = size / 2
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

const emitControlGlyph = (
  node: Element,
  key: string,
  glyph: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  opacity: number,
  clips: readonly RenderClip[],
  transform: RenderTransform,
  state: BuildState,
): void => {
  if (width <= 0 || height <= 0) return
  const fontSize = Math.max(0, Math.min(12, height, width / 0.6))
  if (fontSize <= 0) return
  state.displayList.push(Object.freeze({
    kind: "text",
    key,
    node,
    text: glyph,
    x: x + Math.max(0, (width - fontSize * 0.6) / 2),
    y: y + Math.max(0, (height - fontSize) / 2),
    color,
    fontSize,
    lineHeight: fontSize,
    letterSpacing: 0,
    opacity,
    clips,
    transform,
  }))
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
  style: ComputedStyle,
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
    ...(node instanceof HTMLTextAreaElement
      ? {
          textControl: Object.freeze({
            lineHeight: resolveLineHeight(style),
            characterAdvance: Math.max(0, style.fontSize * 0.6 + style.letterSpacing),
            exactOffsetMapping: node.wrap === "off" && style.whiteSpace === "pre",
          }),
        }
      : {}),
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

const measureText = (
  value: string,
  style: ComputedStyle,
  textMeasurer?: RenderTextMeasurer,
): Size => {
  if (value === "") return Object.freeze({width: 0, height: 0})
  const lines = splitTextLines(value)
  const width = lines.reduce(
    (maximum, line) => Math.max(maximum, textAdvance(line, style, textMeasurer)),
    0,
  )
  return Object.freeze({
    width,
    height: lines.length * resolveLineHeight(style),
  })
}

const textAdvance = (
  value: string,
  style: ComputedStyle,
  textMeasurer?: RenderTextMeasurer,
): number => {
  const count = Array.from(value).length
  if (count === 0) return 0
  if (textMeasurer !== undefined) {
    const measured = textMeasurer.measureTextAdvance(
      value,
      style.fontSize,
      style.letterSpacing,
    )
    if (!Number.isFinite(measured) || measured < 0) {
      throw new Error("textMeasurer.measureTextAdvance() must return a finite non-negative number")
    }
    return measured
  }
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
  textMeasurer?: RenderTextMeasurer,
): string => {
  if (
    style.textOverflow !== "ellipsis" ||
    style.overflowX !== "hidden" ||
    (!singleLineControl && style.whiteSpace !== "nowrap") ||
    textAdvance(value, style, textMeasurer) <= availableWidth
  ) return value
  const ellipsis = "…"
  if (textAdvance(ellipsis, style, textMeasurer) > availableWidth) return ""
  const characters = Array.from(value)
  let low = 0
  let high = characters.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const candidate = `${characters.slice(0, middle).join("")}${ellipsis}`
    if (textAdvance(candidate, style, textMeasurer) <= availableWidth) low = middle
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
      ? ellipsizeSingleLine(
          line,
          overflowStyle,
          alignmentWidth,
          false,
          state.textMeasurer,
        )
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
          textAdvance(displayLine, layoutNode.style, state.textMeasurer),
        ),
        y: y + index * lineHeight,
        color: layoutNode.style.color,
        fontSize: layoutNode.style.fontSize,
        lineHeight,
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
    alignContent: "normal",
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
    rowGap: 0,
    columnGap: 0,
    margin: ZERO_EDGES,
    padding: ZERO_EDGES,
    borderWidths: ZERO_EDGES,
    borderColors: inherited.borderColors,
    borderRadii: ROOT_STYLE.borderRadii,
    background: null,
    color: inherited.color,
    stroke: inherited.stroke,
    strokeWidth: inherited.strokeWidth,
    pointerHitWidth: 0,
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

  withMany(entries: readonly Readonly<{node: Key; value: Value}>[]): ImmutableNodeMap<Key, Value> {
    if (entries.length === 0) return this
    if (this.#changes.size + entries.length >= 128) {
      const compacted = new Map(this)
      for (const {node, value} of entries) compacted.set(node, value)
      return new ImmutableNodeMap(compacted, new Map(), true)
    }
    const changes = new Map(this.#changes)
    for (const {node, value} of entries) changes.set(node, value)
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

const replaceImmutableNodeMapEntries = <Key extends Node, Value>(
  values: ReadonlyMap<Key, Value>,
  entries: readonly Readonly<{node: Key; value: Value}>[],
): ReadonlyMap<Key, Value> => {
  if (entries.length === 0) return values
  if (values instanceof ImmutableNodeMap) return values.withMany(entries)
  const next = new Map(values)
  for (const {node, value} of entries) next.set(node, value)
  return new ImmutableNodeMap(next, new Map(), true)
}
