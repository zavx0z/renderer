import {
  BufferGeometry,
  BufferAttribute,
  CachedText,
  Color,
  ImageMaterial,
  InstancedStrokedPath,
  InstancedRoundedRect,
  type InstanceHandle,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  ROUNDED_RECT_INSTANCE_OFFSETS,
  ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH,
  RoundedRectInstanceLayer,
  STROKED_PATH_SEGMENT_OFFSETS,
  STROKED_PATH_SEGMENT_RECORD_BYTE_LENGTH,
  STROKED_PATH_STYLE_OFFSETS,
  STROKED_PATH_STYLE_RECORD_BYTE_LENGTH,
  StrokedPathInstanceLayer,
  RoundedRectMaterial,
  Text,
  TextMaterial,
  type PresentationClipShape,
  type TrueTypeFont,
} from "@engine/core"
import {readCanonicalRenderFrameChanges} from "@zavx0z/renderer/frame-changes"
import type {
  DisplayItem,
  ImageDisplayItem,
  PathDisplayItem,
  RectDisplayItem,
  RenderClip,
  RenderFrame,
  RenderTextMeasurer,
  RenderTransform,
  TextDisplayItem,
} from "@zavx0z/renderer"

export type RendererWebGpuBackendOptions = Readonly<{
  /** One resolved Engine font for every Text item in this backend. */
  font?: TrueTypeFont
  /** Releases renderer-owned GPU buffers for a geometry before it is forgotten. */
  invalidateGeometry(geometry: BufferGeometry): void
  /** Schedules a new host presentation after an asynchronous texture change. */
  requestPresentation?(): void
  /** Safe retained Rect runs are enabled by default; disabled is an oracle/fallback mode. */
  rectInstancing?: "safe" | "disabled"
  /** Hard retained-slot bound. Overflow remains on the scalar path. */
  maxRectInstances?: number
  /** Hard retained semantic-path bound. */
  maxPathStyles?: number
  /** Hard retained sampled-segment bound. */
  maxPathSegments?: number
}>

export type RendererWebGpuBackendDiagnostics = Readonly<{
  revision: number
  /** True only when the previous validated batching topology was reused. */
  rectPlanReused: boolean
  /** Display-list items traversed by prepare; reused frames count only changed references. */
  rectPreparedItems: number
  rectScalarDraws: number
  rectInstancedDraws: number
  rectInstancedInstances: number
  rectActiveSlots: number
  rectRecordCapacity: number
  pendingRecordUploadRanges: number
  pendingRecordUploadBytes: number
  pendingOrderUploadRanges: number
  pendingOrderUploadBytes: number
  pathPreparedItems: number
  pathDraws: number
  pathInstancedDraws: number
  pathScalarDraws: number
  pathStyles: number
  pathSegments: number
  pathStyleCapacity: number
  pathSegmentCapacity: number
  pathRetainedRecordBytes: number
  pathUnitGeometryBytes: number
  pathStyleWriteBytes: number
  pathSegmentWriteBytes: number
  pathOrderWriteBytes: number
  pendingPathStyleUploadBytes: number
  pendingPathSegmentUploadBytes: number
  pendingPathOrderUploadBytes: number
}>

type DisplayNode = DisplayItem["node"]
type DisplayToken = object

type PreparedClip = Readonly<{
  x: number
  y: number
  width: number
  height: number
  radii: readonly [number, number, number, number]
  transform: RenderTransform
}>

type PreparedRectItem = Readonly<{
  kind: "rect"
  item: RectDisplayItem
  fill: Color
  border: Color
  borderWidths: readonly [number, number, number, number]
  radii: readonly [number, number, number, number]
  opacity: number
  shadow: Readonly<{
    blurRadius: number
    spreadRadius: number
    geometryWidth: number
    geometryHeight: number
  }> | null
  clips: readonly PreparedClip[]
  token: DisplayToken
}>

type PreparedRectPayload = Omit<PreparedRectItem, "token">

type PreparedTextItem = Readonly<{
  kind: "text"
  item: TextDisplayItem
  baselineY: number
  color: Color
  opacity: number
  clips: readonly PreparedClip[]
  token: DisplayToken
}>

type PreparedImageItem = Readonly<{
  kind: "image"
  item: ImageDisplayItem
  boxAspect: number
  opacity: number
  clips: readonly PreparedClip[]
  token: DisplayToken
}>

type PreparedPathItem = Readonly<{
  kind: "path"
  item: PathDisplayItem
  color: Color
  opacity: number
  clips: readonly PreparedClip[]
  transform: RenderTransform
  token: DisplayToken
}>

type PreparedItem = PreparedRectItem | PreparedTextItem | PreparedImageItem | PreparedPathItem

type PreparedRectBatch = Readonly<{
  kind: "rect-batch"
  items: readonly PreparedRectItem[]
  firstInstance: number
}>

type PreparedPathBatch = Readonly<{
  kind: "path-batch"
  items: readonly PreparedPathItem[]
  firstInstance: number
  segmentCount: number
  clips: readonly PreparedClip[]
}>

type PlannedItem = PreparedItem | PreparedRectBatch | PreparedPathBatch

type PreparedFramePlan = Readonly<{
  items: readonly PlannedItem[]
  slottedRects: readonly PreparedRectItem[]
  batchedTokens: ReadonlySet<DisplayToken>
  paths: readonly PreparedPathItem[]
  pathTokens: ReadonlySet<DisplayToken>
  scalarPathIndexes: readonly number[]
  pathSegmentCount: number
}>

type PreparedFrameCache = Readonly<{
  frame: RenderFrame
  revision: number
  viewportWidth: number
  viewportHeight: number
  prepared: PreparedItem[]
  plan: PreparedFramePlan
  rootChildren: readonly Object3D[]
  reusableSources: boolean
  recordVersion: number
  orderVersion: number
  pathStyleRecordVersion: number
  pathStyleOwnershipVersion: number
  pathSegmentRecordVersion: number
  pathSegmentOrderVersion: number
}>

type PreparedRectRecordUpdate = Readonly<{
  index: number
  value: PreparedRectItem
  handle: InstanceHandle
  previousRecord: Float32Array
  nextRecord: Float32Array
  writeRecord: boolean
}>

type ReusedPreparedFrame = Readonly<{
  plan: PreparedFramePlan
  recordUpdates: readonly PreparedRectRecordUpdate[]
  scalarUpdates: readonly Readonly<{index: number; value: PreparedItem}>[]
  pathUpdates: readonly Readonly<{index: number; value: PreparedPathItem}>[]
  pathHandles: readonly InstanceHandle[] | null
  pathMoves: readonly Readonly<{firstIndex: number; count: number; toIndex: number}>[]
  pathOrderWriteBytes: number
  reorderedEntries: readonly Readonly<{index: number; value: PreparedItem}>[]
  preparedMoves: readonly Readonly<{
    fromIndex: number
    toIndex: number
    value: PreparedPathItem
    pathMove: Readonly<{firstIndex: number; count: number; toIndex: number}> | null
  }>[]
}>

type RetainedClipSpace = {
  coordinateSpace: Object3D
  localMatrix: Matrix4
}

type RetainedClipState = {
  clipSpaces: RetainedClipSpace[]
}

type RectEntry = RetainedClipState & {
  kind: "rect"
  node: Mesh
  geometry: PlaneGeometry
  material: RoundedRectMaterial
  width: number
  height: number
}

type TextEntry = RetainedClipState & {
  kind: "text"
  node: CachedText
  material: TextMaterial
  text: string
  fontSize: number
  letterSpacing: number
}

type ImageEntry = RetainedClipState & {
  kind: "image"
  node: Mesh
  geometry: PlaneGeometry
  material: ImageMaterial
  src: string
  width: number
  height: number
}

type RetainedEntry = RectEntry | TextEntry | ImageEntry | PathEntry

type PathRunEntry = RetainedClipState & {
  node: InstancedStrokedPath
}

type PathEntry = RetainedClipState & {
  kind: "path"
  node: Mesh
  geometry: BufferGeometry
  material: MeshBasicMaterial
  geometrySource: PathDisplayItem["geometry"]
  originX: number
  originY: number
  strokeWidth: number
}

const WHITE = "#ffffff"
const NO_PRESENTATION_CLIPS: readonly PresentationClipShape[] = Object.freeze([])
const NO_PREPARED_CLIPS: readonly PreparedClip[] = Object.freeze([])
const DEFAULT_MAX_RECT_INSTANCES = 1_048_576
const RECT_RUN_INDEX_CELL_SIZE = 64
const MAX_RECT_RUN_INDEX_CELLS = 256
const FONT_ADVANCE_CACHE_LIMIT = 4_096
const DEFAULT_MAX_PATH_STYLES = 1_048_576
const DEFAULT_MAX_PATH_SEGMENTS = 4_194_304

/**
 * Retained projection of resolved Rect/Text/Image display items into Engine objects.
 *
 * Item identity is the composite `(DisplayItem.node, DisplayItem.key)`. The
 * backend does not evaluate DOM, selectors, CSS, layout, events or hit
 * semantics.
 */
export class RendererWebGpuBackend {
  public readonly root = new Object3D()
  /** Exact bounded inline-advance owner for the backend font, when present. */
  public readonly textMeasurer: RenderTextMeasurer | undefined

  readonly #font: TrueTypeFont | undefined
  readonly #fontBaselineCenterRatio: number | undefined
  readonly #invalidateGeometry: (geometry: BufferGeometry) => void
  readonly #requestPresentation: (() => void) | undefined
  readonly #rectInstancing: "safe" | "disabled"
  readonly #rectLayer: RoundedRectInstanceLayer
  readonly #tokens = new WeakMap<DisplayNode, Map<string, DisplayToken>>()
  readonly #rectHandles = new Map<DisplayToken, InstanceHandle>()
  readonly #rectRecords = new Map<DisplayToken, Float32Array>()
  readonly #rectSourceItems = new Map<DisplayToken, RectDisplayItem>()
  readonly #rectRuns: InstancedRoundedRect[] = []
  readonly #preparedRectCache = new WeakMap<RectDisplayItem, PreparedRectPayload>()
  readonly #pathLayer: StrokedPathInstanceLayer
  readonly #pathStyleHandles = new Map<DisplayToken, InstanceHandle>()
  readonly #pathStyleRecords = new Map<DisplayToken, Uint8Array>()
  readonly #pathSegmentHandles = new Map<DisplayToken, InstanceHandle[]>()
  readonly #pathSegmentRecords = new Map<DisplayToken, Uint8Array[]>()
  readonly #pathSourceItems = new Map<DisplayToken, PathDisplayItem>()
  readonly #pathGeometrySources = new Map<DisplayToken, PathDisplayItem["geometry"]>()
  readonly #pathRuns: PathRunEntry[] = []
  #entries = new Map<DisplayToken, RetainedEntry>()
  #preparedFrameCache: PreparedFrameCache | null = null
  #frameDocument: RenderFrame["document"] | null = null
  #frameRoot: RenderFrame["root"] | null = null
  #lastFrameRevision = -1
  #diagnosticRevision = 0
  #rectPlanReused = false
  #rectPreparedItems = 0
  #rectScalarDraws = 0
  #rectInstancedInstances = 0
  #rectLayerWasPresented = false
  #pathPreparedItems = 0
  #pathStyleWriteBytes = 0
  #pathSegmentWriteBytes = 0
  #pathOrderWriteBytes = 0
  #pathLayerWasPresented = false
  #disposed = false

  constructor(options: RendererWebGpuBackendOptions) {
    this.#font = options.font
    if (options.font === undefined) {
      this.#fontBaselineCenterRatio = undefined
      this.textMeasurer = undefined
    } else {
      const metrics = readFontMetrics(options.font)
      this.#fontBaselineCenterRatio = metrics.baselineCenterRatio
      this.textMeasurer = createFontTextMeasurer(options.font, metrics.unitsPerEm)
    }
    this.#invalidateGeometry = options.invalidateGeometry
    this.#requestPresentation = options.requestPresentation
    this.#rectInstancing = options.rectInstancing ?? "safe"
    if (this.#rectInstancing !== "safe" && this.#rectInstancing !== "disabled") {
      throw new Error("RendererWebGpuBackendOptions.rectInstancing must be safe or disabled")
    }
    const maxRectInstances = options.maxRectInstances ?? DEFAULT_MAX_RECT_INSTANCES
    if (!Number.isInteger(maxRectInstances) || maxRectInstances <= 0) {
      throw new RangeError("RendererWebGpuBackendOptions.maxRectInstances must be a positive integer")
    }
    this.#rectLayer = new RoundedRectInstanceLayer({
      initialCapacity: 0,
      maxCapacity: maxRectInstances,
    })
    const maxPathStyles = options.maxPathStyles ?? DEFAULT_MAX_PATH_STYLES
    const maxPathSegments = options.maxPathSegments ?? DEFAULT_MAX_PATH_SEGMENTS
    if (!Number.isInteger(maxPathStyles) || maxPathStyles <= 0) {
      throw new RangeError("RendererWebGpuBackendOptions.maxPathStyles must be a positive integer")
    }
    if (!Number.isInteger(maxPathSegments) || maxPathSegments <= 0) {
      throw new RangeError("RendererWebGpuBackendOptions.maxPathSegments must be a positive integer")
    }
    this.#pathLayer = new StrokedPathInstanceLayer({
      initialStyleCapacity: 0,
      maxStyleCapacity: maxPathStyles,
      initialSegmentCapacity: 0,
      maxSegmentCapacity: maxPathSegments,
    })
    this.root.name = "@zavx0z/renderer-webgpu"
    this.root.renderLayer = "ui"
  }

  public get diagnostics(): RendererWebGpuBackendDiagnostics {
    const instances = this.#rectLayer.instances
    const pathInstancedDraws = this.#pathRuns.filter((run) => run.node.parent === this.root).length
    let pathScalarDraws = 0
    for (const entry of this.#entries.values()) {
      if (entry.kind === "path") pathScalarDraws += 1
    }
    const pathStyleCapacity = this.#pathLayer.styles.capacity
    const pathSegmentCapacity = this.#pathLayer.segments.capacity
    const pathUnitGeometryBytes =
      (this.#pathLayer.geometry.attributes.position?.array.byteLength ?? 0) +
      (this.#pathLayer.geometry.index?.array.byteLength ?? 0)
    return Object.freeze({
      revision: this.#diagnosticRevision,
      rectPlanReused: this.#rectPlanReused,
      rectPreparedItems: this.#rectPreparedItems,
      rectScalarDraws: this.#rectScalarDraws,
      rectInstancedDraws: this.#rectRuns.filter((run) => run.parent === this.root).length,
      rectInstancedInstances: this.#rectInstancedInstances,
      rectActiveSlots: instances.count,
      rectRecordCapacity: instances.capacity,
      pendingRecordUploadRanges: instances.recordAttribute.fullUpdateRequired
        ? 1
        : instances.recordAttribute.updateRanges.length,
      pendingRecordUploadBytes: pendingUploadBytes(instances.recordAttribute),
      pendingOrderUploadRanges: instances.orderAttribute.fullUpdateRequired
        ? 1
        : instances.orderAttribute.updateRanges.length,
      pendingOrderUploadBytes: pendingUploadBytes(instances.orderAttribute),
      pathPreparedItems: this.#pathPreparedItems,
      pathDraws: pathInstancedDraws + pathScalarDraws,
      pathInstancedDraws,
      pathScalarDraws,
      pathStyles: this.#pathLayer.styles.count,
      pathSegments: this.#pathLayer.segments.count,
      pathStyleCapacity,
      pathSegmentCapacity,
      pathRetainedRecordBytes:
        pathStyleCapacity * STROKED_PATH_STYLE_RECORD_BYTE_LENGTH +
        pathSegmentCapacity * STROKED_PATH_SEGMENT_RECORD_BYTE_LENGTH +
        pathSegmentCapacity * Uint32Array.BYTES_PER_ELEMENT,
      pathUnitGeometryBytes,
      pathStyleWriteBytes: this.#pathStyleWriteBytes,
      pathSegmentWriteBytes: this.#pathSegmentWriteBytes,
      pathOrderWriteBytes: this.#pathOrderWriteBytes,
      pendingPathStyleUploadBytes: pendingUploadBytes(this.#pathLayer.styles.recordAttribute),
      pendingPathSegmentUploadBytes: pendingUploadBytes(this.#pathLayer.segments.recordAttribute),
      pendingPathOrderUploadBytes: pendingUploadBytes(this.#pathLayer.segments.orderAttribute),
    })
  }

  /** Applies one complete immutable display frame to the stable Engine root. */
  public applyFrame(frame: RenderFrame): void {
    if (this.#disposed) throw new Error("RendererWebGpuBackend is disposed")
    this.#validateFrameEnvelope(frame)
    if (this.#preparedFrameCache?.frame === frame) {
      this.#resetPathWriteDiagnostics()
      this.#diagnosticRevision = frame.revision
      this.#rectPlanReused = true
      this.#rectPreparedItems = 0
      this.#pathPreparedItems = 0
      return
    }

    const reused = this.#tryReusePreparedFrame(frame)
    if (reused !== null) {
      this.#resetPathWriteDiagnostics()
      this.#applyReusedPreparedFrame(frame, reused)
      return
    }

    const prepared = this.#prepareFrame(frame)
    const plan = this.#planFrame(prepared)
    this.#validatePathCapacity(plan.paths)
    this.#resetPathWriteDiagnostics()
    const created = new Map<DisplayToken, RetainedEntry>()

    // Allocate every required replacement before mutating retained entries.
    for (const value of plan.items) {
      if (value.kind === "rect-batch" || value.kind === "path-batch") continue
      const existing = this.#entries.get(value.token)
      if (existing?.kind === value.item.kind) continue
      created.set(value.token, this.#createEntry(value))
    }

    this.#synchronizeRectLayer(plan.slottedRects)
    this.#synchronizePathLayer(plan.paths)

    const nextEntries = new Map<DisplayToken, RetainedEntry>()
    const nextNodes: Object3D[] = []
    const stale: RetainedEntry[] = []
    let rectRunIndex = 0
    let rectScalarDraws = 0
    let rectInstancedInstances = 0
    let pathRunIndex = 0

    for (const value of plan.items) {
      if (value.kind === "rect-batch") {
        let run = this.#rectRuns[rectRunIndex]
        if (run === undefined) {
          run = new InstancedRoundedRect(this.#rectLayer)
          this.#rectRuns.push(run)
        }
        run.name = `rect-run:${rectRunIndex}`
        run.setRange(value.firstInstance, value.items.length)
        this.#rectLayerWasPresented = true
        nextNodes.push(run)
        rectRunIndex += 1
        rectInstancedInstances += value.items.length
        continue
      }
      if (value.kind === "path-batch") {
        let entry = this.#pathRuns[pathRunIndex]
        if (entry === undefined) {
          entry = {node: new InstancedStrokedPath(this.#pathLayer), clipSpaces: []}
          this.#pathRuns.push(entry)
        }
        entry.node.name = `path-run:${pathRunIndex}`
        entry.node.setRange(value.firstInstance, value.segmentCount)
        this.#updateClips(entry, value.clips)
        positionPathRun(entry.node, resolvedPathTransform(value.items[0]!.item, frame))
        this.#pathLayerWasPresented = true
        nextNodes.push(entry.node)
        pathRunIndex += 1
        continue
      }
      const existing = this.#entries.get(value.token)
      const entry = existing?.kind === value.item.kind
        ? existing
        : created.get(value.token)
      if (entry === undefined) throw new Error("Display item was not materialized")

      if (existing?.kind === value.item.kind) this.#updateEntry(entry, value)
      if (existing !== undefined && existing !== entry) stale.push(existing)
      nextEntries.set(value.token, entry)
      nextNodes.push(entry.node)
      if (value.kind === "rect") rectScalarDraws += 1
    }

    for (const [token, entry] of this.#entries) {
      if (!nextEntries.has(token)) stale.push(entry)
    }

    const geometries = new Set<BufferGeometry>()
    for (const entry of stale) this.#detachEntry(entry, geometries)
    for (let index = pathRunIndex; index < this.#pathRuns.length; index += 1) {
      const entry = this.#pathRuns[index]!
      entry.node.parent = null
      entry.node.presentationClips = NO_PRESENTATION_CLIPS
      entry.clipSpaces.length = 0
    }

    this.#entries = nextEntries
    this.#setRootChildren(nextNodes)
    this.#diagnosticRevision = frame.revision
    this.#rectPlanReused = false
    this.#rectPreparedItems = prepared.filter((item) => item.kind === "rect").length
    this.#rectScalarDraws = rectScalarDraws
    this.#rectInstancedInstances = rectInstancedInstances
    this.#pathPreparedItems = prepared.filter((item) => item.kind === "path").length
    this.#commitPreparedFrame(frame, prepared, plan, prepared.every(isReusablePreparedItem))
    for (const geometry of geometries) this.#invalidateGeometry(geometry)
    this.#invalidateEvictedTextGeometries()
  }

  #resetPathWriteDiagnostics(): void {
    this.#pathStyleWriteBytes = 0
    this.#pathSegmentWriteBytes = 0
    this.#pathOrderWriteBytes = 0
  }

  /** Releases every resource owned by this backend. Safe to call repeatedly. */
  public dispose(): void {
    if (this.#disposed) return
    this.#disposed = true

    const geometries = new Set<BufferGeometry>()
    for (const entry of this.#entries.values()) this.#detachEntry(entry, geometries)
    this.#entries.clear()
    this.#rectLayer.instances.clear()
    this.#rectHandles.clear()
    this.#rectRecords.clear()
    this.#rectSourceItems.clear()
    this.#pathLayer.styles.clear()
    this.#pathLayer.segments.clear()
    this.#pathStyleHandles.clear()
    this.#pathStyleRecords.clear()
    this.#pathSegmentHandles.clear()
    this.#pathSegmentRecords.clear()
    this.#pathSourceItems.clear()
    this.#pathGeometrySources.clear()
    this.#preparedFrameCache = null
    this.#frameDocument = null
    this.#frameRoot = null
    this.#lastFrameRevision = -1
    for (const run of this.#rectRuns) run.parent = null
    for (const entry of this.#pathRuns) {
      entry.node.parent = null
      entry.node.presentationClips = NO_PRESENTATION_CLIPS
      entry.clipSpaces.length = 0
    }
    this.root.children = []

    for (const geometry of geometries) this.#invalidateGeometry(geometry)
    if (this.#rectLayerWasPresented) this.#invalidateGeometry(this.#rectLayer.geometry)
    if (this.#pathLayerWasPresented) this.#invalidateGeometry(this.#pathLayer.geometry)
    this.#invalidateEvictedTextGeometries()
  }

  #validateFrameEnvelope(frame: RenderFrame): void {
    if (frame === null || typeof frame !== "object") {
      throw new TypeError("RendererWebGpuBackend frame must be an object")
    }
    if (!Number.isSafeInteger(frame.revision) || frame.revision < 0) {
      throw new RangeError("frame.revision must be a non-negative safe integer")
    }
    if (
      frame.document === null
      || typeof frame.document !== "object"
      || frame.document.nodeType !== 9
    ) {
      throw new TypeError("frame.document must be a semantic Document")
    }
    if (
      frame.root === null
      || typeof frame.root !== "object"
      || !Number.isInteger(frame.root.nodeType)
    ) {
      throw new TypeError("frame.root must be a semantic Node")
    }
    if (frame.root !== frame.document && frame.root.ownerDocument !== frame.document) {
      throw new TypeError("frame.root belongs to another Document")
    }
    if (!Array.isArray(frame.displayList)) {
      throw new TypeError("frame.displayList must be an immutable Array-compatible list")
    }
    if (frame.viewport === null || typeof frame.viewport !== "object") {
      throw new TypeError("frame.viewport must be an object")
    }
    if (this.#frameDocument !== null && frame.document !== this.#frameDocument) {
      throw new TypeError("RendererWebGpuBackend frame belongs to another Document")
    }
    if (this.#frameRoot !== null && frame.root !== this.#frameRoot) {
      throw new TypeError("RendererWebGpuBackend frame uses another root")
    }
    if (frame.revision < this.#lastFrameRevision) {
      throw new RangeError(
        `frame.revision ${frame.revision} precedes applied revision ${this.#lastFrameRevision}`,
      )
    }
    assertFiniteNonNegative(frame.viewport.width, "frame.viewport.width")
    assertFiniteNonNegative(frame.viewport.height, "frame.viewport.height")
  }

  #tryReusePreparedFrame(frame: RenderFrame): ReusedPreparedFrame | null {
    const cached = this.#preparedFrameCache
    if (
      this.#rectInstancing !== "safe"
      || cached === null
      || !cached.reusableSources
      || cached.viewportWidth !== frame.viewport.width
      || cached.viewportHeight !== frame.viewport.height
      || cached.prepared.length !== frame.displayList.length
      || !sameObjectOrder(this.root.children, cached.rootChildren)
    ) return null
    if (
      this.#rectLayer.instances.recordAttribute.version !== cached.recordVersion
      || this.#rectLayer.instances.orderAttribute.version !== cached.orderVersion
    ) {
      throw new Error("Retained Rect instance storage changed outside RendererWebGpuBackend")
    }
    if (
      this.#pathLayer.styles.recordAttribute.version !== cached.pathStyleRecordVersion
      || this.#pathLayer.styles.ownershipVersion !== cached.pathStyleOwnershipVersion
      || this.#pathLayer.segments.recordAttribute.version !== cached.pathSegmentRecordVersion
      || this.#pathLayer.segments.orderAttribute.version !== cached.pathSegmentOrderVersion
    ) {
      throw new Error("Retained Path instance storage changed outside RendererWebGpuBackend")
    }
    if (!this.#hasRetainedBatchTopology(cached.plan)) return null

    const recordUpdates: PreparedRectRecordUpdate[] = []
    const scalarUpdates: Array<Readonly<{index: number; value: PreparedItem}>> = []
    const pathUpdates: Array<Readonly<{index: number; value: PreparedPathItem}>> = []
    const canonicalChanges = validatedChangedDisplayChanges(frame, cached)
    if (canonicalChanges === null) return null
    if (canonicalChanges.operations !== undefined) {
      return this.#prepareCanonicalPathOperations(
        frame,
        cached,
        canonicalChanges.indexes,
        canonicalChanges.operations,
      )
    }
    const changedIndexes = canonicalChanges.indexes
    if (changedIndexes.some((index) =>
      !sameDisplayIdentity(cached.prepared[index]!.item, frame.displayList[index]!)
    )) return this.#preparePathReorder(frame, cached, changedIndexes)
    for (const index of changedIndexes) {
      const previous = cached.prepared[index]!
      const item = frame.displayList[index]!
      if (item === previous.item) continue
      if (frame.revision === cached.revision) return null
      if (!sameDisplayIdentity(previous.item, item)) return null
      if (previous.kind === "path" && item.kind === "path") {
        const isolatedFrame = Object.freeze({...frame, displayList: Object.freeze([item])})
        const value = this.#prepareFrame(isolatedFrame)[0]
        if (value?.kind !== "path" || value.token !== previous.token) return null
        const wasInstanced = cached.plan.pathTokens.has(previous.token)
        const remainsInstanced = isInstancedPathCompatible(value)
        if (
          wasInstanced !== remainsInstanced
          || previous.item.geometry.segments.length !== value.item.geometry.segments.length
          || !samePathRun(previous, value)
        ) return null
        if (wasInstanced) pathUpdates.push(Object.freeze({index, value}))
        else scalarUpdates.push(Object.freeze({index, value}))
        continue
      }
      if (
        previous.kind !== "rect"
        || item.kind !== "rect"
        || !cached.plan.batchedTokens.has(previous.token)
        || !sameRectBatchTopology(previous.item, item)
        || !isReusableDisplayItem(item)
      ) {
        if (
          previous.kind !== item.kind
          || previous.kind === "path"
          || cached.plan.batchedTokens.has(previous.token)
        ) return null
        const isolatedFrame = Object.freeze({
          ...frame,
          displayList: Object.freeze([item]),
        })
        const value = this.#prepareFrame(isolatedFrame)[0]
        if (value === undefined || value.kind !== previous.kind || value.token !== previous.token) {
          return null
        }
        scalarUpdates.push(Object.freeze({index, value}))
        continue
      }

      const value = this.#prepareRectAt(item, previous.token, index, frame)
      if (!isRectInstanceCompatible(value)) return null
      const handle = this.#rectHandles.get(previous.token)
      const previousRecord = this.#rectRecords.get(previous.token)
      if (
        handle === undefined
        || previousRecord === undefined
        || !this.#rectLayer.instances.has(handle)
      ) return null
      const nextRecord = packRectInstance(value)
      recordUpdates.push(Object.freeze({
        index,
        value,
        handle,
        previousRecord,
        nextRecord,
        writeRecord: !sameFloatRecord(previousRecord, nextRecord),
      }))
    }

    if (!rectBatchPlanRemainsSafe(cached.plan, recordUpdates)) return null

    return Object.freeze({
      plan: cached.plan,
      recordUpdates: Object.freeze(recordUpdates),
      scalarUpdates: Object.freeze(scalarUpdates),
      pathUpdates: Object.freeze(pathUpdates),
      pathHandles: null,
      pathMoves: Object.freeze([]),
      pathOrderWriteBytes: 0,
      reorderedEntries: Object.freeze([]),
      preparedMoves: Object.freeze([]),
    })
  }

  #preparePathReorder(
    frame: RenderFrame,
    cached: PreparedFrameCache,
    changedIndexes: readonly number[],
  ): ReusedPreparedFrame | null {
    if (frame.revision === cached.revision) return null
    const pathBatches = cached.plan.items.filter((item) => item.kind === "path-batch")
    if (
      pathBatches.length !== 1
      || pathBatches[0]!.items.length !== cached.plan.paths.length
    ) return null
    const byToken = new Map<DisplayToken, PreparedPathItem>()
    for (const value of cached.prepared) {
      if (value.kind === "path") byToken.set(value.token, value)
    }
    const reordered = [...cached.prepared]
    const pathUpdates: Array<Readonly<{index: number; value: PreparedPathItem}>> = []
    for (const index of changedIndexes) {
      const previous = cached.prepared[index]
      const item = frame.displayList[index]
      if (previous?.kind !== "path" || item?.kind !== "path") return null
      const token = this.#tokenFor(item.node, item.key)
      const retained = byToken.get(token)
      if (retained === undefined) return null
      let value = retained
      if (item !== retained.item) {
        const isolatedFrame = Object.freeze({...frame, displayList: Object.freeze([item])})
        const prepared = this.#prepareFrame(isolatedFrame)[0]
        if (
          prepared?.kind !== "path"
          || prepared.token !== token
          || !isInstancedPathCompatible(prepared)
          || retained.item.geometry.segments.length !== prepared.item.geometry.segments.length
          || !samePathRun(retained, prepared)
        ) return null
        value = prepared
        pathUpdates.push(Object.freeze({index, value}))
      }
      reordered[index] = value
    }
    const pathOrder = reordered.filter((value): value is PreparedPathItem => value.kind === "path")
    if (pathOrder.length !== cached.plan.paths.length) return null
    const previousPathOrder = cached.prepared.filter(
      (value): value is PreparedPathItem => value.kind === "path",
    )
    const movedToken = pathUpdates.length === 1 ? pathUpdates[0]!.value.token : null
    const previousMovedIndex = movedToken === null
      ? -1
      : previousPathOrder.findIndex(({token}) => token === movedToken)
    const nextMovedIndex = movedToken === null
      ? -1
      : pathOrder.findIndex(({token}) => token === movedToken)
    const previousWithoutMoved = previousPathOrder.filter(({token}) => token !== movedToken)
    const nextWithoutMoved = pathOrder.filter(({token}) => token !== movedToken)
    const singleMove = previousMovedIndex >= 0 && nextMovedIndex >= 0 &&
      previousWithoutMoved.length === nextWithoutMoved.length &&
      previousWithoutMoved.every((value, index) => value.token === nextWithoutMoved[index]?.token)
    if (singleMove && previousMovedIndex !== nextMovedIndex) {
      const count = pathOrder[nextMovedIndex]!.item.geometry.segments.length
      const firstIndex = previousPathOrder.slice(0, previousMovedIndex).reduce(
        (total, value) => total + value.item.geometry.segments.length,
        0,
      )
      const toIndex = pathOrder.slice(0, nextMovedIndex).reduce(
        (total, value) => total + value.item.geometry.segments.length,
        0,
      )
      const firstDirty = Math.min(firstIndex, toIndex)
      const lastDirty = Math.max(firstIndex, toIndex) + count
      return Object.freeze({
        plan: cached.plan,
        recordUpdates: Object.freeze([]),
        scalarUpdates: Object.freeze([]),
        pathUpdates: Object.freeze(pathUpdates),
        pathHandles: null,
        pathMoves: Object.freeze([Object.freeze({firstIndex, count, toIndex})]),
        pathOrderWriteBytes: (lastDirty - firstDirty) * Uint32Array.BYTES_PER_ELEMENT,
        reorderedEntries: Object.freeze(changedIndexes.map((index) => Object.freeze({
          index,
          value: reordered[index]!,
        }))),
        preparedMoves: Object.freeze([]),
      })
    }

    const remainingTokens = new Set(cached.plan.pathTokens)
    const handles: InstanceHandle[] = []
    let firstOrderChange = -1
    let lastOrderChange = -1
    for (const value of pathOrder) {
      if (!remainingTokens.delete(value.token)) return null
      const pathHandles = this.#pathSegmentHandles.get(value.token)
      if (pathHandles === undefined) return null
      for (const handle of pathHandles) {
        const orderIndex = handles.length
        if (this.#pathLayer.segments.handleAt(orderIndex) !== handle) {
          if (firstOrderChange < 0) firstOrderChange = orderIndex
          lastOrderChange = orderIndex
        }
        handles.push(handle)
      }
    }
    if (remainingTokens.size !== 0 || handles.length !== this.#pathLayer.segments.count) return null
    const orderWriteBytes = firstOrderChange < 0
      ? 0
      : (lastOrderChange - firstOrderChange + 1) * Uint32Array.BYTES_PER_ELEMENT
    return Object.freeze({
      plan: cached.plan,
      recordUpdates: Object.freeze([]),
      scalarUpdates: Object.freeze([]),
      pathUpdates: Object.freeze(pathUpdates),
      pathHandles: Object.freeze(handles),
      pathMoves: Object.freeze([]),
      pathOrderWriteBytes: orderWriteBytes,
      reorderedEntries: Object.freeze(changedIndexes.map((index) => Object.freeze({
        index,
        value: reordered[index]!,
      }))),
      preparedMoves: Object.freeze([]),
    })
  }

  #prepareCanonicalPathOperations(
    frame: RenderFrame,
    cached: PreparedFrameCache,
    changedIndexes: readonly number[],
    operations: readonly Readonly<{
      fromIndex: number
      toIndex: number
      count: 1
      replacement: DisplayItem
    }>[],
  ): ReusedPreparedFrame | null {
    if (operations.length === 0 || operations.length > 8) return null
    const pathBatches = cached.plan.items.filter((item) => item.kind === "path-batch")
    if (
      pathBatches.length !== 1
      || pathBatches[0]!.items.length !== cached.plan.paths.length
    ) return null

    type PreparedOperation = Readonly<{
      fromIndex: number
      toIndex: number
      value: PreparedPathItem
      pathMove: Readonly<{firstIndex: number; count: number; toIndex: number}> | null
    }>
    const preparedOperations: PreparedOperation[] = []
    const segmentMoves: Array<Readonly<{
      token: DisplayToken
      firstIndex: number
      count: number
      toIndex: number
    }>> = []
    const pathUpdates: Array<Readonly<{index: number; value: PreparedPathItem}>> = []
    const orderRanges: Array<Readonly<{start: number; end: number}>> = []

    const preparedAt = (requestedIndex: number): PreparedItem | undefined => {
      let index = requestedIndex
      for (let operationIndex = preparedOperations.length - 1; operationIndex >= 0; operationIndex -= 1) {
        const operation = preparedOperations[operationIndex]!
        if (index === operation.toIndex) return operation.value
        if (operation.fromIndex < operation.toIndex) {
          if (index >= operation.fromIndex && index < operation.toIndex) index += 1
        } else if (operation.fromIndex > operation.toIndex) {
          if (index > operation.toIndex && index <= operation.fromIndex) index -= 1
        }
      }
      return cached.prepared[index]
    }
    const segmentStart = (token: DisplayToken): number | undefined => {
      const handles = this.#pathSegmentHandles.get(token)
      if (handles === undefined || handles.length === 0) return undefined
      let start = this.#pathLayer.segments.orderIndexOf(handles[0]!)
      for (const move of segmentMoves) {
        if (move.token === token) {
          start = move.toIndex
        } else if (move.firstIndex < move.toIndex) {
          if (start >= move.firstIndex + move.count && start < move.toIndex + move.count) {
            start -= move.count
          }
        } else if (move.firstIndex > move.toIndex) {
          if (start >= move.toIndex && start < move.firstIndex) start += move.count
        }
      }
      return start
    }

    for (const operation of operations) {
      const previous = preparedAt(operation.fromIndex)
      const item = operation.replacement
      if (previous?.kind !== "path" || item.kind !== "path") return null
      const token = this.#tokenFor(item.node, item.key)
      if (token !== previous.token || !cached.plan.pathTokens.has(token)) return null
      const isolatedFrame = Object.freeze({...frame, displayList: Object.freeze([item])})
      const value = this.#prepareFrame(isolatedFrame)[0]
      if (
        value?.kind !== "path"
        || value.token !== token
        || !isInstancedPathCompatible(value)
        || value.item.geometry.segments.length !== previous.item.geometry.segments.length
        || !samePathRun(previous, value)
      ) return null

      let pathMove: PreparedOperation["pathMove"] = null
      if (operation.fromIndex !== operation.toIndex) {
        const firstIndex = segmentStart(token)
        const handles = this.#pathSegmentHandles.get(token)
        const neighbor = preparedAt(operation.toIndex)
        if (
          firstIndex === undefined
          || handles === undefined
          || handles.length === 0
          || neighbor?.kind !== "path"
        ) return null
        const neighborStart = segmentStart(neighbor.token)
        if (neighborStart === undefined) return null
        const toIndex = operation.toIndex > operation.fromIndex
          ? neighborStart + neighbor.item.geometry.segments.length - handles.length
          : neighborStart
        pathMove = Object.freeze({firstIndex, count: handles.length, toIndex})
        segmentMoves.push(Object.freeze({token, ...pathMove}))
        const firstDirty = Math.min(firstIndex, toIndex)
        const lastDirty = Math.max(firstIndex, toIndex) + handles.length
        orderRanges.push(Object.freeze({start: firstDirty, end: lastDirty}))
      }
      const preparedOperation = Object.freeze({
        fromIndex: operation.fromIndex,
        toIndex: operation.toIndex,
        value,
        pathMove,
      })
      preparedOperations.push(preparedOperation)
      pathUpdates.push(Object.freeze({index: operation.toIndex, value}))
    }

    for (const index of changedIndexes) {
      const expected = frame.displayList[index]
      const actual = preparedAt(index)
      if (
        expected === undefined ||
        actual === undefined ||
        !sameDisplayIdentity(actual.item, expected)
      ) return null
    }
    orderRanges.sort((left, right) => left.start - right.start)
    let pathOrderWords = 0
    let rangeStart = -1
    let rangeEnd = -1
    for (const range of orderRanges) {
      if (rangeStart < 0) {
        rangeStart = range.start
        rangeEnd = range.end
      } else if (range.start <= rangeEnd) {
        rangeEnd = Math.max(rangeEnd, range.end)
      } else {
        pathOrderWords += rangeEnd - rangeStart
        rangeStart = range.start
        rangeEnd = range.end
      }
    }
    if (rangeStart >= 0) pathOrderWords += rangeEnd - rangeStart
    return Object.freeze({
      plan: cached.plan,
      recordUpdates: Object.freeze([]),
      scalarUpdates: Object.freeze([]),
      pathUpdates: Object.freeze(pathUpdates),
      pathHandles: null,
      pathMoves: Object.freeze([]),
      pathOrderWriteBytes: pathOrderWords * Uint32Array.BYTES_PER_ELEMENT,
      reorderedEntries: Object.freeze([]),
      preparedMoves: Object.freeze(preparedOperations),
    })
  }

  #applyReusedPreparedFrame(frame: RenderFrame, reused: ReusedPreparedFrame): void {
    const written: PreparedRectRecordUpdate[] = []
    try {
      for (const update of reused.recordUpdates) {
        if (!update.writeRecord) continue
        this.#rectLayer.instances.setRecord(update.handle, update.nextRecord)
        written.push(update)
      }
    } catch (error) {
      const rollbackErrors: unknown[] = []
      for (let index = written.length - 1; index >= 0; index -= 1) {
        const update = written[index]!
        try {
          this.#rectLayer.instances.setRecord(update.handle, update.previousRecord)
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError)
        }
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], "Rect instance update and rollback both failed")
      }
      throw error
    }

    for (const update of reused.recordUpdates) {
      if (update.writeRecord) this.#rectRecords.set(update.value.token, update.nextRecord)
      this.#rectSourceItems.set(update.value.token, update.value.item)
      this.#preparedFrameCache!.prepared[update.index] = update.value
    }
    for (const update of reused.scalarUpdates) {
      const entry = this.#entries.get(update.value.token)
      if (entry === undefined || entry.kind !== update.value.item.kind) {
        throw new Error("Retained scalar display entry is missing")
      }
      this.#updateEntry(entry, update.value)
      this.#preparedFrameCache!.prepared[update.index] = update.value
    }
    for (const update of reused.pathUpdates) {
      this.#updateRetainedPath(update.value)
      if (reused.preparedMoves.length === 0) {
        this.#preparedFrameCache!.prepared[update.index] = update.value
      }
    }
    if (
      reused.pathOrderWriteBytes > 0 &&
      (reused.pathHandles !== null || reused.pathMoves.length > 0 || reused.preparedMoves.length > 0)
    ) this.#pathOrderWriteBytes += reused.pathOrderWriteBytes
    if (reused.pathHandles !== null) {
      this.#pathLayer.segments.setOrder(reused.pathHandles)
    }
    for (const move of reused.pathMoves) {
      this.#pathLayer.segments.moveRange(
        move.firstIndex,
        move.count,
        move.toIndex,
      )
    }
    for (const move of reused.preparedMoves) {
      const {fromIndex, toIndex, value, pathMove} = move
      if (pathMove !== null) {
        this.#pathLayer.segments.moveRange(
          pathMove.firstIndex,
          pathMove.count,
          pathMove.toIndex,
        )
      }
      const prepared = this.#preparedFrameCache!.prepared
      if (fromIndex < toIndex) prepared.copyWithin(fromIndex, fromIndex + 1, toIndex + 1)
      else prepared.copyWithin(toIndex + 1, toIndex, fromIndex)
      prepared[toIndex] = value
    }
    for (const {index, value} of reused.reorderedEntries) {
      this.#preparedFrameCache!.prepared[index] = value
    }
    this.#diagnosticRevision = frame.revision
    this.#rectPlanReused = true
    this.#rectPreparedItems = reused.recordUpdates.length +
      reused.scalarUpdates.filter((update) => update.value.kind === "rect").length
    this.#pathPreparedItems = reused.pathUpdates.length +
      reused.scalarUpdates.filter((update) => update.value.kind === "path").length
    let pathRunIndex = 0
    for (const value of reused.plan.items) {
      if (value.kind !== "path-batch") continue
      const entry = this.#pathRuns[pathRunIndex++]
      if (entry === undefined) throw new Error("Retained Path run is missing")
      const first = value.items[0]!.item
      this.#updateClips(entry, this.#prepareClips(first.clips, frame, "reused.path"))
      positionPathRun(entry.node, resolvedPathTransform(first, frame))
    }
    for (const index of reused.plan.scalarPathIndexes) {
      const value = this.#preparedFrameCache!.prepared[index]
      if (value?.kind !== "path") throw new Error("Retained scalar Path source is missing")
      const entry = this.#entries.get(value.token)
      if (entry?.kind !== "path") throw new Error("Retained scalar Path entry is missing")
      positionPathMesh(entry.node, resolvedPathTransform(value.item, frame))
    }
    this.#commitPreparedFrame(frame, this.#preparedFrameCache!.prepared, reused.plan, true)
    this.#invalidateEvictedTextGeometries()
  }

  #commitPreparedFrame(
    frame: RenderFrame,
    prepared: PreparedItem[],
    plan: PreparedFramePlan,
    reusableSources: boolean,
  ): void {
    this.#frameDocument = frame.document
    this.#frameRoot = frame.root
    this.#lastFrameRevision = frame.revision
    this.#preparedFrameCache = Object.freeze({
      frame,
      revision: frame.revision,
      viewportWidth: frame.viewport.width,
      viewportHeight: frame.viewport.height,
      prepared,
      plan,
      rootChildren: Object.freeze([...this.root.children]),
      reusableSources,
      recordVersion: this.#rectLayer.instances.recordAttribute.version,
      orderVersion: this.#rectLayer.instances.orderAttribute.version,
      pathStyleRecordVersion: this.#pathLayer.styles.recordAttribute.version,
      pathStyleOwnershipVersion: this.#pathLayer.styles.ownershipVersion,
      pathSegmentRecordVersion: this.#pathLayer.segments.recordAttribute.version,
      pathSegmentOrderVersion: this.#pathLayer.segments.orderAttribute.version,
    })
  }

  #hasRetainedBatchTopology(plan: PreparedFramePlan): boolean {
    if (this.#rectLayer.instances.count !== plan.slottedRects.length) return false
    if (this.#pathLayer.styles.count !== plan.paths.length) return false
    if (this.#pathLayer.segments.count !== plan.pathSegmentCount) return false
    let runIndex = 0
    let pathRunIndex = 0
    for (const item of plan.items) {
      if (item.kind === "path-batch") {
        const run = this.#pathRuns[pathRunIndex]?.node
        if (
          run === undefined
          || run.parent !== this.root
          || run.firstInstance !== item.firstInstance
          || run.count !== item.segmentCount
        ) return false
        pathRunIndex += 1
        continue
      }
      if (item.kind !== "rect-batch") continue
      const run = this.#rectRuns[runIndex]
      if (
        run === undefined
        || run.parent !== this.root
        || run.firstInstance !== item.firstInstance
        || run.count !== item.items.length
      ) return false
      runIndex += 1
    }
    return this.#rectRuns.filter((run) => run.parent === this.root).length === runIndex
      && this.#pathRuns.filter((run) => run.node.parent === this.root).length === pathRunIndex
  }

  #planFrame(prepared: readonly PreparedItem[]): PreparedFramePlan {
    const slottedRects: PreparedRectItem[] = []
    const paths = prepared.filter((value): value is PreparedPathItem =>
      value.kind === "path" && isInstancedPathCompatible(value)
    )
    const batchedTokens = new Set<DisplayToken>()
    const scalarPathIndexes: number[] = []
    for (let index = 0; index < prepared.length; index += 1) {
      const value = prepared[index]
      if (value?.kind === "path" && !isInstancedPathCompatible(value)) {
        scalarPathIndexes.push(index)
      }
    }
    const orderIndexByToken = new Map<DisplayToken, number>()
    for (const value of prepared) {
      if (
        this.#rectInstancing === "disabled"
        || value.kind !== "rect"
        || !isRectInstanceCompatible(value)
        || slottedRects.length >= this.#rectLayer.instances.maxCapacity
      ) continue
      orderIndexByToken.set(value.token, slottedRects.length)
      slottedRects.push(value)
    }

    const items: PlannedItem[] = []
    let run: PreparedRectItem[] = []
    let pathRun: PreparedPathItem[] = []
    let pathSegmentCursor = 0
    const pathFirstIndexByToken = new Map<DisplayToken, number>()
    for (const path of paths) {
      pathFirstIndexByToken.set(path.token, pathSegmentCursor)
      pathSegmentCursor += path.item.geometry.segments.length
    }
    let spatialIndex = new RectRunSpatialIndex()
    const flushRun = (): void => {
      if (run.length >= 2) {
        const firstInstance = orderIndexByToken.get(run[0]!.token)
        if (firstInstance === undefined) throw new Error("Rect run lost its instance order")
        for (const value of run) batchedTokens.add(value.token)
        items.push(Object.freeze({
          kind: "rect-batch",
          items: Object.freeze([...run]),
          firstInstance,
        }))
      } else if (run.length === 1) {
        items.push(run[0]!)
      }
      run = []
      spatialIndex = new RectRunSpatialIndex()
    }
    const flushPathRun = (): void => {
      if (pathRun.length === 0) return
      const first = pathRun[0]!
      const firstInstance = pathFirstIndexByToken.get(first.token)
      if (firstInstance === undefined) throw new Error("Path run lost its segment order")
      items.push(Object.freeze({
        kind: "path-batch",
        items: Object.freeze([...pathRun]),
        firstInstance,
        segmentCount: pathRun.reduce(
          (count, value) => count + value.item.geometry.segments.length,
          0,
        ),
        clips: first.clips,
      }))
      pathRun = []
    }

    for (const value of prepared) {
      if (value.kind === "path" && isInstancedPathCompatible(value)) {
        flushRun()
        const previous = pathRun.at(-1)
        if (previous !== undefined && !samePathRun(previous, value)) flushPathRun()
        pathRun.push(value)
        continue
      }
      const orderIndex = value.kind === "rect"
        ? orderIndexByToken.get(value.token)
        : undefined
      if (value.kind !== "rect" || orderIndex === undefined) {
        flushRun()
        flushPathRun()
        items.push(value)
        continue
      }
      flushPathRun()

      const candidateBounds = rectInstanceBounds(value)
      let admission = spatialIndex.add(candidateBounds)
      if (admission === "overlap") {
        flushRun()
        admission = spatialIndex.add(candidateBounds)
      }
      if (admission === "too-large") {
        flushRun()
        items.push(value)
        continue
      }
      run.push(value)
    }
    flushRun()
    flushPathRun()

    return Object.freeze({
      items: Object.freeze(items),
      slottedRects: Object.freeze(slottedRects),
      batchedTokens,
      paths: Object.freeze(paths),
      pathTokens: new Set(paths.map(({token}) => token)),
      scalarPathIndexes: Object.freeze(scalarPathIndexes),
      pathSegmentCount: pathSegmentCursor,
    })
  }

  #synchronizeRectLayer(values: readonly PreparedRectItem[]): void {
    const desiredTokens = new Set(values.map(({token}) => token))
    for (const [token, handle] of this.#rectHandles) {
      if (desiredTokens.has(token)) continue
      this.#rectLayer.instances.remove(handle)
      this.#rectHandles.delete(token)
      this.#rectRecords.delete(token)
      this.#rectSourceItems.delete(token)
    }

    for (let orderIndex = 0; orderIndex < values.length; orderIndex += 1) {
      const value = values[orderIndex]!
      let handle = this.#rectHandles.get(value.token)
      if (handle === undefined) {
        const record = packRectInstance(value)
        handle = this.#rectLayer.instances.allocate(record, orderIndex)
        this.#rectHandles.set(value.token, handle)
        this.#rectRecords.set(value.token, record)
        this.#rectSourceItems.set(value.token, value.item)
        continue
      }

      if (this.#rectLayer.instances.handleAt(orderIndex) !== handle) {
        this.#rectLayer.instances.move(handle, orderIndex)
      }
      if (this.#rectSourceItems.get(value.token) === value.item) continue
      const record = packRectInstance(value)
      const previous = this.#rectRecords.get(value.token)
      if (previous === undefined || !sameFloatRecord(previous, record)) {
        this.#rectLayer.instances.setRecord(handle, record)
        this.#rectRecords.set(value.token, record)
      }
      this.#rectSourceItems.set(value.token, value.item)
    }
  }

  #synchronizePathLayer(values: readonly PreparedPathItem[]): void {
    const desiredSegments = this.#validatePathCapacity(values)
    this.#pathLayer.styles.reserve(values.length)
    this.#pathLayer.segments.reserve(desiredSegments)
    const desiredTokens = new Set(values.map(({token}) => token))
    for (const [token, handles] of this.#pathSegmentHandles) {
      if (desiredTokens.has(token)) continue
      for (let index = handles.length - 1; index >= 0; index -= 1) {
        this.#pathLayer.segments.remove(handles[index]!)
      }
      const style = this.#pathStyleHandles.get(token)
      if (style !== undefined) this.#pathLayer.styles.remove(style)
      this.#pathSegmentHandles.delete(token)
      this.#pathSegmentRecords.delete(token)
      this.#pathStyleHandles.delete(token)
      this.#pathStyleRecords.delete(token)
      this.#pathSourceItems.delete(token)
      this.#pathGeometrySources.delete(token)
    }

    const orderedSegments: InstanceHandle[] = []
    for (const value of values) {
      let styleHandle = this.#pathStyleHandles.get(value.token)
      const previousSource = this.#pathSourceItems.get(value.token)
      const styleChanged = previousSource === undefined
        || previousSource.stroke !== value.item.stroke
        || previousSource.strokeWidth !== value.item.strokeWidth
        || previousSource.opacity !== value.item.opacity
      const styleRecord = styleChanged
        ? packPathStyle(value)
        : this.#pathStyleRecords.get(value.token) ?? packPathStyle(value)
      if (styleHandle === undefined) {
        styleHandle = this.#pathLayer.styles.allocate(styleRecord)
        this.#pathStyleWriteBytes += STROKED_PATH_STYLE_RECORD_BYTE_LENGTH
        this.#pathStyleHandles.set(value.token, styleHandle)
        this.#pathStyleRecords.set(value.token, styleRecord)
      } else {
        const previousStyle = this.#pathStyleRecords.get(value.token)
        if (previousStyle === undefined || !sameByteRecord(previousStyle, styleRecord)) {
          this.#pathStyleWriteBytes += updatePathStyleRecord(
            this.#pathLayer.styles,
            styleHandle,
            previousStyle,
            styleRecord,
          )
          this.#pathStyleRecords.set(value.token, styleRecord)
        }
      }

      const segmentCount = value.item.geometry.segments.length
      const handles = this.#pathSegmentHandles.get(value.token) ?? []
      const records = this.#pathSegmentRecords.get(value.token) ?? []
      while (handles.length > segmentCount) {
        this.#pathLayer.segments.remove(handles.pop()!)
        records.pop()
      }
      const geometryChanged = this.#pathGeometrySources.get(value.token) !== value.item.geometry
        || previousSource?.x !== value.item.x
        || previousSource?.y !== value.item.y
      for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
        let handle = handles[segmentIndex]
        if (handle === undefined) {
          const record = packPathSegment(
            value,
            segmentIndex,
            styleHandle.slot,
            styleHandle.generation,
          )
          handle = this.#pathLayer.segments.allocate(record)
          this.#pathSegmentWriteBytes += STROKED_PATH_SEGMENT_RECORD_BYTE_LENGTH
          this.#pathOrderWriteBytes += Uint32Array.BYTES_PER_ELEMENT
          handles.push(handle)
          records.push(record)
        } else if (geometryChanged) {
          const record = packPathSegment(
            value,
            segmentIndex,
            styleHandle.slot,
            styleHandle.generation,
          )
          const previousRecord = records[segmentIndex]
          if (previousRecord === undefined || !sameByteRecord(previousRecord, record)) {
            this.#pathSegmentWriteBytes += updatePathSegmentRecord(
              this.#pathLayer.segments,
              handle,
              previousRecord,
              record,
            )
            records[segmentIndex] = record
          }
        }
        orderedSegments.push(handle)
      }
      this.#pathSegmentHandles.set(value.token, handles)
      this.#pathSegmentRecords.set(value.token, records)
      this.#pathSourceItems.set(value.token, value.item)
      this.#pathGeometrySources.set(value.token, value.item.geometry)
    }

    this.#pathOrderWriteBytes += pathOrderDifferenceBytes(
      this.#pathLayer.segments,
      orderedSegments,
    )
    this.#pathLayer.segments.setOrder(orderedSegments)
  }

  #validatePathCapacity(values: readonly PreparedPathItem[]): number {
    const desiredSegments = values.reduce(
      (count, value) => count + value.item.geometry.segments.length,
      0,
    )
    if (values.length > this.#pathLayer.styles.maxCapacity) {
      throw new RangeError("Path style capacity exceeded before retained mutation")
    }
    if (desiredSegments > this.#pathLayer.segments.maxCapacity) {
      throw new RangeError("Path segment capacity exceeded before retained mutation")
    }
    return desiredSegments
  }

  #updateRetainedPath(value: PreparedPathItem): void {
    const styleHandle = this.#pathStyleHandles.get(value.token)
    const segmentHandles = this.#pathSegmentHandles.get(value.token)
    const segmentRecords = this.#pathSegmentRecords.get(value.token)
    if (styleHandle === undefined || segmentHandles === undefined || segmentRecords === undefined) {
      throw new Error("Retained Path handles are missing")
    }
    const previousSource = this.#pathSourceItems.get(value.token)
    const styleRecord = packPathStyle(value)
    const previousStyle = this.#pathStyleRecords.get(value.token)
    if (previousStyle === undefined || !sameByteRecord(previousStyle, styleRecord)) {
      this.#pathStyleWriteBytes += updatePathStyleRecord(
        this.#pathLayer.styles,
        styleHandle,
        previousStyle,
        styleRecord,
      )
      this.#pathStyleRecords.set(value.token, styleRecord)
    }
    const geometryChanged = this.#pathGeometrySources.get(value.token) !== value.item.geometry
      || previousSource?.x !== value.item.x
      || previousSource?.y !== value.item.y
    if (geometryChanged) {
      for (let index = 0; index < segmentHandles.length; index += 1) {
        const record = packPathSegment(
          value,
          index,
          styleHandle.slot,
          styleHandle.generation,
        )
        const previous = segmentRecords[index]
        if (previous === undefined || !sameByteRecord(previous, record)) {
          this.#pathSegmentWriteBytes += updatePathSegmentRecord(
            this.#pathLayer.segments,
            segmentHandles[index]!,
            previous,
            record,
          )
          segmentRecords[index] = record
        }
      }
    }
    this.#pathSourceItems.set(value.token, value.item)
    this.#pathGeometrySources.set(value.token, value.item.geometry)
  }

  #prepareFrame(frame: RenderFrame): PreparedItem[] {
    const tokens = new Set<DisplayToken>()
    const prepared: PreparedItem[] = []
    for (let index = 0; index < frame.displayList.length; index++) {
      const item = frame.displayList[index]!
      if (item === null || typeof item !== "object") {
        throw new TypeError(`Display item at index ${index} must be an object`)
      }
      if (!item.key) throw new Error(`Display item at index ${index} requires a non-empty key`)
      this.#validateDisplayNode(item.node, frame, `frame.displayList[${index}].node`)
      const token = this.#tokenFor(item.node, item.key)
      if (tokens.has(token)) throw new Error(`Duplicate display item identity at index ${index}`)
      tokens.add(token)

      const label = `frame.displayList[${index}]`
      assertFinite(item.x, `${label}.x`)
      assertFinite(item.y, `${label}.y`)
      this.#validateTransform(item.transform, `${label}.transform`)

      if (item.kind === "text") {
        if (this.#font === undefined || this.#fontBaselineCenterRatio === undefined) {
          throw new Error(`Text display item at index ${index} requires RendererWebGpuBackendOptions.font`)
        }
        assertFiniteNonNegative(item.fontSize, `${label}.fontSize`)
        assertFiniteNonNegative(item.lineHeight, `${label}.lineHeight`)
        assertFinite(item.letterSpacing, `${label}.letterSpacing`)
        const opacity = assertUnitOpacity(item.opacity, `${label}.opacity`)
        const baselineY = item.y + item.lineHeight / 2 +
          item.fontSize * this.#fontBaselineCenterRatio
        assertFinite(baselineY, `${label}.baselineY`)
        prepared.push(Object.freeze({
          kind: "text",
          item,
          baselineY,
          color: parseDisplayColor(item.color || WHITE),
          opacity,
          clips: this.#prepareClips(item.clips, frame, label),
          token,
        }))
      } else if (item.kind === "rect") {
        assertFiniteNonNegative(item.width, `${label}.width`)
        assertFiniteNonNegative(item.height, `${label}.height`)
        prepared.push(this.#prepareRect(item, token, label, frame))
      } else if (item.kind === "image") {
        if (this.#requestPresentation === undefined) {
          throw new Error(
            `Image display item at index ${index} requires RendererWebGpuBackendOptions.requestPresentation`,
          )
        }
        if (typeof item.src !== "string" || item.src === "") {
          throw new Error(`${label}.src must be a non-empty string`)
        }
        assertFinitePositive(item.width, `${label}.width`)
        assertFinitePositive(item.height, `${label}.height`)
        if (item.fit !== "cover" && item.fit !== "contain") {
          throw new Error(`${label}.fit must be cover or contain`)
        }
        prepared.push(Object.freeze({
          kind: "image",
          item,
          boxAspect: item.width / item.height,
          opacity: assertUnitOpacity(item.opacity, `${label}.opacity`),
          clips: this.#prepareClips(item.clips, frame, label),
          token,
        }))
      } else if (item.kind === "path") {
        assertFinitePositive(item.strokeWidth, `${label}.strokeWidth`)
        if (item.presentationOwner !== null) {
          this.#validateDisplayNode(item.presentationOwner, frame, `${label}.presentationOwner`)
          const transform = frame.presentationTransforms?.get(item.presentationOwner)
          if (transform === undefined) {
            throw new Error(`${label}.presentationOwner has no frame presentation transform`)
          }
          this.#validateTransform(transform, `${label}.presentationTransform`)
        }
        if (item.geometry === null || typeof item.geometry !== "object") {
          throw new TypeError(`${label}.geometry must be an object`)
        }
        if (!Array.isArray(item.geometry.segments) || item.geometry.segments.length === 0) {
          throw new Error(`${label}.geometry.segments must be a non-empty array`)
        }
        for (let segmentIndex = 0; segmentIndex < item.geometry.segments.length; segmentIndex += 1) {
          const segment = item.geometry.segments[segmentIndex]!
          const segmentLabel = `${label}.geometry.segments[${segmentIndex}]`
          if (segment === null || typeof segment !== "object") {
            throw new TypeError(`${segmentLabel} must be an object`)
          }
          for (const [pointName, point] of [["from", segment.from], ["to", segment.to]] as const) {
            if (point === null || typeof point !== "object") {
              throw new TypeError(`${segmentLabel}.${pointName} must be an object`)
            }
            assertFinite(point.x, `${segmentLabel}.${pointName}.x`)
            assertFinite(point.y, `${segmentLabel}.${pointName}.y`)
            assertFiniteFloat32(item.x + point.x, `${segmentLabel}.${pointName}.packedX`)
            assertFiniteFloat32(item.y + point.y, `${segmentLabel}.${pointName}.packedY`)
          }
          if (segment.from.x === segment.to.x && segment.from.y === segment.to.y) {
            throw new Error(`${segmentLabel} must have positive length`)
          }
        }
        const color = parseDisplayColor(item.stroke)
        const opacity = assertUnitOpacity(item.opacity, `${label}.opacity`)
        assertFiniteFloat32(item.strokeWidth, `${label}.strokeWidth`)
        for (const [component, value] of Object.entries({
          red: color.r,
          green: color.g,
          blue: color.b,
          alpha: color.a,
          opacity,
        })) assertFiniteFloat32(value, `${label}.${component}`)
        prepared.push(Object.freeze({
          kind: "path",
          item,
          color,
          opacity,
          clips: this.#prepareClips(item.clips, frame, label),
          transform: resolvedPathTransform(item, frame),
          token,
        }))
      } else {
        throw new Error(`Unsupported display item kind: ${String((item as {kind?: unknown}).kind)}`)
      }
    }
    return prepared
  }

  #prepareRectAt(
    item: RectDisplayItem,
    token: DisplayToken,
    index: number,
    frame: RenderFrame,
  ): PreparedRectItem {
    const label = `frame.displayList[${index}]`
    if (!item.key) throw new Error(`Display item at index ${index} requires a non-empty key`)
    this.#validateDisplayNode(item.node, frame, `${label}.node`)
    assertFinite(item.x, `${label}.x`)
    assertFinite(item.y, `${label}.y`)
    this.#validateTransform(item.transform, `${label}.transform`)
    assertFiniteNonNegative(item.width, `${label}.width`)
    assertFiniteNonNegative(item.height, `${label}.height`)
    return this.#prepareRect(item, token, label, frame)
  }

  #validateDisplayNode(node: DisplayNode, frame: RenderFrame, label: string): void {
    if (node === null || typeof node !== "object") {
      throw new TypeError(`${label} must be a semantic Node`)
    }
    if (node !== frame.document && node.ownerDocument !== frame.document) {
      throw new TypeError(`${label} belongs to another Document`)
    }
  }

  #prepareRect(
    item: RectDisplayItem,
    token: DisplayToken,
    label: string,
    frame: RenderFrame,
  ): PreparedRectItem {
    const cacheable = Array.isArray(item.clips) && item.clips.length === 0
    const cached = cacheable ? this.#preparedRectCache.get(item) : undefined
    if (cached !== undefined) return Object.freeze({...cached, token})

    const opacity = assertUnitOpacity(item.opacity, `${label}.opacity`)
    const border = item.border
    if (border === null || typeof border !== "object") {
      throw new TypeError(`${label}.border must be an object`)
    }
    const {top, right, bottom, left} = border.widths
    assertFiniteNonNegative(top, `${label}.border.widths.top`)
    assertFiniteNonNegative(right, `${label}.border.widths.right`)
    assertFiniteNonNegative(bottom, `${label}.border.widths.bottom`)
    assertFiniteNonNegative(left, `${label}.border.widths.left`)
    const {topLeft, topRight, bottomRight, bottomLeft} = border.radii
    assertFiniteNonNegative(topLeft, `${label}.border.radii.topLeft`)
    assertFiniteNonNegative(topRight, `${label}.border.radii.topRight`)
    assertFiniteNonNegative(bottomRight, `${label}.border.radii.bottomRight`)
    assertFiniteNonNegative(bottomLeft, `${label}.border.radii.bottomLeft`)

    const widths = Object.freeze([top, right, bottom, left] as const)
    const uniformWidths = top === right && top === bottom && top === left
    if (!uniformWidths && [topLeft, topRight, bottomRight, bottomLeft].some(radius => radius !== 0)) {
      throw new Error(`${label} has non-uniform border widths with non-zero corner radii`)
    }
    const borderColor = visibleUniformBorderColor(widths, border.colors, label)
    const shadow = prepareRectShadow(item, widths, label)
    const prepared = Object.freeze({
      kind: "rect",
      item,
      fill: parseDisplayColor(item.color || WHITE),
      border: borderColor,
      borderWidths: widths,
      radii: Object.freeze([topLeft, topRight, bottomRight, bottomLeft] as const),
      opacity,
      shadow,
      clips: this.#prepareClips(item.clips, frame, label),
      token,
    })
    if (cacheable) {
      const {token: _token, ...payload} = prepared
      this.#preparedRectCache.set(item, Object.freeze(payload))
    }
    return prepared
  }

  #prepareClips(
    clips: readonly RenderClip[],
    frame: RenderFrame,
    itemLabel: string,
  ): readonly PreparedClip[] {
    if (!Array.isArray(clips)) throw new TypeError(`${itemLabel}.clips must be an array`)
    if (clips.length === 0) return NO_PREPARED_CLIPS

    const prepared = clips.map((clip, index): PreparedClip => {
      const label = `${itemLabel}.clips[${index}]`
      if (clip === null || typeof clip !== "object") {
        throw new TypeError(`${label} must be an object`)
      }
      assertFinite(clip.x, `${label}.x`)
      assertFinite(clip.y, `${label}.y`)
      assertFiniteNonNegative(clip.width, `${label}.width`)
      assertFiniteNonNegative(clip.height, `${label}.height`)
      if (typeof clip.clipX !== "boolean" || typeof clip.clipY !== "boolean") {
        throw new TypeError(`${label}.clipX and clipY must be booleans`)
      }
      if (!clip.clipX && !clip.clipY) {
        throw new Error(`${label} must clip at least one axis`)
      }
      this.#validateTransform(clip.transform, `${label}.transform`)

      const radii = validateClipRadii(clip, label)
      let circularRadii: readonly [number, number, number, number]
      if (clip.clipX && clip.clipY) {
        const visible = clip.width > 0 && clip.height > 0
        circularRadii = Object.freeze(radii.map((radius, cornerIndex) => {
          if (visible && radius.x !== radius.y) {
            throw new Error(
              `${label}.radii[${cornerIndex}] is elliptical and unsupported by PresentationClipShape`,
            )
          }
          return visible ? radius.x : 0
        }) as [number, number, number, number])
      } else {
        if (radii.some(({x, y}) => x !== 0 || y !== 0)) {
          throw new Error(`${label} has corner radii on a partial-axis clip`)
        }
        circularRadii = Object.freeze([0, 0, 0, 0])
      }

      if (clip.presentationOwner !== null && clip.presentationOwner !== undefined) {
        this.#validateDisplayNode(clip.presentationOwner, frame, `${label}.presentationOwner`)
      }
      const sourceTransform = clip.presentationOwner === null || clip.presentationOwner === undefined
        ? clip.transform
        : frame.presentationTransforms?.get(clip.presentationOwner)
      if (sourceTransform === undefined) {
        throw new Error(`${label}.presentationOwner has no frame presentation transform`)
      }
      this.#validateTransform(sourceTransform, `${label}.presentationTransform`)
      const transform = partialClipTransform(clip, sourceTransform)
      const x = clip.clipX ? clip.x : 0
      const y = clip.clipY ? clip.y : 0
      const width = clip.clipX ? clip.width : frame.viewport.width
      const height = clip.clipY ? clip.height : frame.viewport.height
      return Object.freeze({
        x,
        y,
        width,
        height,
        radii: circularRadii,
        transform,
      })
    })
    return Object.freeze(prepared)
  }

  #validateTransform(transform: RenderTransform, label: string): void {
    if (transform === null || typeof transform !== "object") {
      throw new TypeError(`${label} must be an object`)
    }
    assertFinite(transform.scaleX, `${label}.scaleX`)
    assertFinite(transform.scaleY, `${label}.scaleY`)
    assertFinite(transform.translateX, `${label}.translateX`)
    assertFinite(transform.translateY, `${label}.translateY`)
  }

  #createEntry(value: PreparedItem): RetainedEntry {
    if (value.kind === "rect") return this.#createRect(value)
    if (value.kind === "text") return this.#createText(value)
    if (value.kind === "image") return this.#createImage(value)
    return this.#createPath(value)
  }

  #createRect(value: PreparedRectItem): RectEntry {
    const {item} = value
    const geometryWidth = value.shadow?.geometryWidth ?? item.width
    const geometryHeight = value.shadow?.geometryHeight ?? item.height
    const geometry = new PlaneGeometry({width: geometryWidth, height: geometryHeight})
    const material = new RoundedRectMaterial({
      width: item.width,
      height: item.height,
      radius: radiiParameters(value.radii),
      fill: value.fill,
      border: value.border,
      borderWidths: value.borderWidths,
      opacity: value.opacity,
      shadowBlur: value.shadow?.blurRadius ?? 0,
      shadowSpread: value.shadow?.spreadRadius ?? 0,
    })
    const node = new Mesh(geometry, material)
    node.name = `${item.node.nodeName}:${item.key}`
    const entry: RectEntry = {
      kind: "rect",
      node,
      geometry,
      material,
      width: geometryWidth,
      height: geometryHeight,
      clipSpaces: [],
    }
    this.#updateClips(entry, value.clips)
    positionPlane(node, item)
    return entry
  }

  #createText(value: PreparedTextItem): TextEntry {
    const {item} = value
    if (this.#font === undefined) throw new Error("Text display item requires a font")
    const material = new TextMaterial({color: value.color, opacity: value.opacity})
    const node = new CachedText(item.text, this.#font, item.fontSize, material)
    if (node.letterSpacing !== item.letterSpacing) {
      node.letterSpacing = item.letterSpacing
      node.updateGeometry()
    }
    node.name = `${item.node.nodeName}:${item.key}`
    const entry: TextEntry = {
      kind: "text",
      node,
      material,
      text: item.text,
      fontSize: item.fontSize,
      letterSpacing: item.letterSpacing,
      clipSpaces: [],
    }
    this.#updateClips(entry, value.clips)
    positionText(node, item, value.baselineY)
    return entry
  }

  #createImage(value: PreparedImageItem): ImageEntry {
    const {item} = value
    const geometry = new PlaneGeometry({width: item.width, height: item.height})
    const material = new ImageMaterial({
      src: item.src,
      fit: item.fit,
      boxAspect: value.boxAspect,
      opacity: value.opacity,
    })
    const node = new Mesh(geometry, material)
    const entry: ImageEntry = {
      kind: "image",
      node,
      geometry,
      material,
      src: item.src,
      width: item.width,
      height: item.height,
      clipSpaces: [],
    }
    material.onTextureChange = this.#textureChangeCallback(value.token, item.src)
    node.name = `${item.node.nodeName}:${item.key}`
    this.#updateClips(entry, value.clips)
    positionPlane(node, item)
    return entry
  }

  #createPath(value: PreparedPathItem): PathEntry {
    const geometry = createScalarPathGeometry(value.item)
    const material = new MeshBasicMaterial({color: scalarPathColor(value)})
    const node = new Mesh(geometry, material)
    node.name = `${value.item.node.nodeName}:${value.item.key}`
    node.renderLayer = "ui"
    const entry: PathEntry = {
      kind: "path",
      node,
      geometry,
      material,
      geometrySource: value.item.geometry,
      originX: value.item.x,
      originY: value.item.y,
      strokeWidth: value.item.strokeWidth,
      clipSpaces: [],
    }
    this.#updateClips(entry, value.clips)
    positionPathMesh(node, value.transform)
    return entry
  }

  #updateEntry(entry: RetainedEntry, value: PreparedItem): void {
    if (entry.kind === "rect" && value.kind === "rect") {
      const geometryWidth = value.shadow?.geometryWidth ?? value.item.width
      const geometryHeight = value.shadow?.geometryHeight ?? value.item.height
      if (entry.width !== geometryWidth || entry.height !== geometryHeight) {
        resizePlane(entry.geometry, geometryWidth, geometryHeight)
        entry.width = geometryWidth
        entry.height = geometryHeight
      }
      entry.material.width = value.item.width
      entry.material.height = value.item.height
      entry.material.fill.copy(value.fill)
      entry.material.border.copy(value.border)
      entry.material.borderWidths = value.borderWidths
      copyRadii(entry.material.radii, value.radii)
      entry.material.opacity = value.opacity
      entry.material.shadowBlur = value.shadow?.blurRadius ?? 0
      entry.material.shadowSpread = value.shadow?.spreadRadius ?? 0
      this.#updateClips(entry, value.clips)
      positionPlane(entry.node, value.item)
      return
    }

    if (entry.kind === "text" && value.kind === "text") {
      if (
        entry.text !== value.item.text ||
        entry.fontSize !== value.item.fontSize ||
        entry.letterSpacing !== value.item.letterSpacing
      ) {
        entry.node.text = value.item.text
        entry.node.fontSize = value.item.fontSize
        entry.node.letterSpacing = value.item.letterSpacing
        entry.node.updateGeometry()
        entry.text = value.item.text
        entry.fontSize = value.item.fontSize
        entry.letterSpacing = value.item.letterSpacing
      }
      entry.material.color.copy(value.color)
      entry.material.opacity = value.opacity
      this.#updateClips(entry, value.clips)
      positionText(entry.node, value.item, value.baselineY)
      return
    }

    if (entry.kind === "image" && value.kind === "image") {
      if (entry.width !== value.item.width || entry.height !== value.item.height) {
        resizePlane(entry.geometry, value.item.width, value.item.height)
        entry.width = value.item.width
        entry.height = value.item.height
      }
      if (entry.src !== value.item.src) {
        entry.src = value.item.src
        entry.material.src = value.item.src
        entry.material.onTextureChange = this.#textureChangeCallback(value.token, value.item.src)
      }
      entry.material.fit = value.item.fit
      entry.material.boxAspect = value.boxAspect
      entry.material.opacity = value.opacity
      this.#updateClips(entry, value.clips)
      positionPlane(entry.node, value.item)
      return
    }


    if (entry.kind === "path" && value.kind === "path") {
      if (
        entry.geometrySource !== value.item.geometry
        || entry.originX !== value.item.x
        || entry.originY !== value.item.y
        || entry.strokeWidth !== value.item.strokeWidth
      ) {
        updateScalarPathGeometry(entry.geometry, value.item)
        entry.geometrySource = value.item.geometry
        entry.originX = value.item.x
        entry.originY = value.item.y
        entry.strokeWidth = value.item.strokeWidth
      }
      entry.material.color.copy(scalarPathColor(value))
      this.#updateClips(entry, value.clips)
      positionPathMesh(entry.node, value.transform)
      return
    }

    throw new Error("Display item kind mismatch")
  }

  #updateClips(
    entry: RetainedClipState & {node: Object3D},
    clips: readonly PreparedClip[],
  ): void {
    while (entry.clipSpaces.length < clips.length) {
      entry.clipSpaces.push(createRetainedClipSpace(this.root))
    }
    if (entry.clipSpaces.length > clips.length) entry.clipSpaces.length = clips.length
    if (clips.length === 0) {
      entry.node.presentationClips = NO_PRESENTATION_CLIPS
      return
    }
    entry.node.presentationClips = Object.freeze(clips.map((clip, index): PresentationClipShape => {
      const clipSpace = entry.clipSpaces[index]!
      writeEngineTransform(clipSpace.localMatrix, clip.transform)
      return Object.freeze({
        kind: "rounded-rect",
        coordinateSpace: clipSpace.coordinateSpace,
        center: Object.freeze([clip.x + clip.width / 2, -(clip.y + clip.height / 2)] as const),
        halfSize: Object.freeze([clip.width / 2, clip.height / 2] as const),
        radii: clip.radii,
      })
    }))
  }

  #detachEntry(entry: RetainedEntry, geometries: Set<BufferGeometry>): void {
    entry.node.parent?.remove(entry.node)
    entry.node.presentationClips = NO_PRESENTATION_CLIPS
    entry.clipSpaces.length = 0
    entry.node.children = []
    if (entry.kind === "image") {
      entry.material.onTextureChange = undefined
    }
    if (entry.kind === "rect" || entry.kind === "image" || entry.kind === "path") {
      geometries.add(entry.geometry)
    }
  }

  #setRootChildren(next: readonly Object3D[]): void {
    const unchanged = this.root.children.length === next.length
      && this.root.children.every((child, index) => child === next[index])
    if (unchanged) return

    const nextSet = new Set(next)
    for (const child of this.root.children) {
      if (!nextSet.has(child) && child.parent === this.root) child.parent = null
    }
    this.root.children = [...next]
    for (const child of next) child.parent = this.root
  }

  #invalidateEvictedTextGeometries(): void {
    for (const geometry of Text.consumeEvictedLayoutGeometries()) {
      this.#invalidateGeometry(geometry)
    }
  }

  #textureChangeCallback(token: DisplayToken, src: string): () => void {
    const owner = new WeakRef(this)
    return () => {
      const backend = owner.deref()
      if (backend !== undefined) backend.#requestTexturePresentation(token, src)
    }
  }

  #requestTexturePresentation(token: DisplayToken, src: string): void {
    if (this.#disposed) return
    const entry = this.#entries.get(token)
    if (entry?.kind !== "image" || entry.src !== src || entry.material.src !== src) return
    this.#requestPresentation?.()
  }

  #tokenFor(node: DisplayNode, key: string): DisplayToken {
    let nodeTokens = this.#tokens.get(node)
    if (nodeTokens === undefined) {
      nodeTokens = new Map()
      this.#tokens.set(node, nodeTokens)
    }
    let token = nodeTokens.get(key)
    if (token === undefined) {
      token = Object.freeze({})
      nodeTokens.set(key, token)
    }
    return token
  }
}

type RectBounds = Readonly<{
  minX: number
  minY: number
  maxX: number
  maxY: number
}>

type RectRunAdmission = "accepted" | "overlap" | "too-large"

class RectRunSpatialIndex {
  readonly #rows = new Map<number, Map<number, RectBounds[]>>()

  public add(bounds: RectBounds): RectRunAdmission {
    if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)) {
      return "too-large"
    }
    const minCellX = Math.floor(bounds.minX / RECT_RUN_INDEX_CELL_SIZE)
    const maxCellX = Math.floor(bounds.maxX / RECT_RUN_INDEX_CELL_SIZE)
    const minCellY = Math.floor(bounds.minY / RECT_RUN_INDEX_CELL_SIZE)
    const maxCellY = Math.floor(bounds.maxY / RECT_RUN_INDEX_CELL_SIZE)
    if (![minCellX, maxCellX, minCellY, maxCellY].every(Number.isSafeInteger)) {
      return "too-large"
    }
    const cellCount = (maxCellX - minCellX + 1) * (maxCellY - minCellY + 1)
    if (cellCount > MAX_RECT_RUN_INDEX_CELLS) return "too-large"

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      const row = this.#rows.get(cellY)
      if (row === undefined) continue
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const occupants = row.get(cellX)
        if (occupants?.some((previous) => rectBoundsOverlap(previous, bounds))) {
          return "overlap"
        }
      }
    }

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      let row = this.#rows.get(cellY)
      if (row === undefined) {
        row = new Map()
        this.#rows.set(cellY, row)
      }
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const occupants = row.get(cellX)
        if (occupants === undefined) row.set(cellX, [bounds])
        else occupants.push(bounds)
      }
    }
    return "accepted"
  }
}

function isRectInstanceCompatible(value: PreparedRectItem): boolean {
  return value.clips.length === 0
    && value.item.width > 0
    && value.item.height > 0
    && value.item.transform.scaleX !== 0
    && value.item.transform.scaleY !== 0
}

function rectInstanceBounds(value: PreparedRectItem): RectBounds {
  const {item} = value
  const geometryWidth = value.shadow?.geometryWidth ?? item.width
  const geometryHeight = value.shadow?.geometryHeight ?? item.height
  const center = applyRenderTransform(
    item.transform,
    item.x + item.width / 2,
    item.y + item.height / 2,
  )
  const halfWidth = Math.abs(item.transform.scaleX) * geometryWidth / 2
  const halfHeight = Math.abs(item.transform.scaleY) * geometryHeight / 2
  return Object.freeze({
    minX: center.x - halfWidth,
    minY: center.y - halfHeight,
    maxX: center.x + halfWidth,
    maxY: center.y + halfHeight,
  })
}

function rectBoundsOverlap(left: RectBounds, right: RectBounds): boolean {
  return !(
    left.maxX < right.minX
    || right.maxX < left.minX
    || left.maxY < right.minY
    || right.maxY < left.minY
  )
}

function packRectInstance(value: PreparedRectItem): Float32Array {
  const record = new Float32Array(ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH / 4)
  const {item} = value
  record.set([item.x, item.y, item.width, item.height], ROUNDED_RECT_INSTANCE_OFFSETS.rect)
  record.set([
    item.transform.scaleX,
    item.transform.scaleY,
    item.transform.translateX,
    item.transform.translateY,
  ], ROUNDED_RECT_INSTANCE_OFFSETS.transform)
  record.set([value.fill.r, value.fill.g, value.fill.b, value.fill.a], ROUNDED_RECT_INSTANCE_OFFSETS.fill)
  record.set(
    [value.border.r, value.border.g, value.border.b, value.border.a],
    ROUNDED_RECT_INSTANCE_OFFSETS.border,
  )
  record.set(value.radii, ROUNDED_RECT_INSTANCE_OFFSETS.radii)
  record.set(value.borderWidths, ROUNDED_RECT_INSTANCE_OFFSETS.borderWidths)
  record.set([
    value.opacity,
    value.shadow?.blurRadius ?? 0,
    value.shadow?.spreadRadius ?? 0,
    0,
  ], ROUNDED_RECT_INSTANCE_OFFSETS.params)
  return record
}

function packPathStyle(value: PreparedPathItem): Uint8Array {
  const buffer = new ArrayBuffer(STROKED_PATH_STYLE_RECORD_BYTE_LENGTH)
  const record = new Float32Array(buffer)
  record.set(
    [value.color.r, value.color.g, value.color.b, value.color.a],
    STROKED_PATH_STYLE_OFFSETS.color,
  )
  record.set(
    [value.item.strokeWidth, value.opacity, 0, 0],
    STROKED_PATH_STYLE_OFFSETS.params,
  )
  return new Uint8Array(buffer)
}

function packPathSegment(
  value: PreparedPathItem,
  segmentIndex: number,
  styleSlot: number,
  styleGeneration: number,
): Uint8Array {
  const segment = value.item.geometry.segments[segmentIndex]
  if (segment === undefined) throw new Error("Path segment index is out of range")
  const buffer = new ArrayBuffer(STROKED_PATH_SEGMENT_RECORD_BYTE_LENGTH)
  const floats = new Float32Array(buffer)
  const words = new Uint32Array(buffer)
  floats.set([
    value.item.x + segment.from.x,
    value.item.y + segment.from.y,
    value.item.x + segment.to.x,
    value.item.y + segment.to.y,
  ], STROKED_PATH_SEGMENT_OFFSETS.endpoints)
  words[STROKED_PATH_SEGMENT_OFFSETS.styleSlot] = styleSlot
  words[STROKED_PATH_SEGMENT_OFFSETS.styleGeneration] = styleGeneration
  return new Uint8Array(buffer)
}

function isInstancedPathCompatible(value: PreparedPathItem): boolean {
  return value.color.a === 1 && value.opacity === 1
}

function scalarPathColor(value: PreparedPathItem): Color {
  return new Color(value.color.r, value.color.g, value.color.b, value.color.a * value.opacity)
}

function createScalarPathGeometry(item: PathDisplayItem): BufferGeometry {
  const geometry = new BufferGeometry()
  const data = scalarPathGeometryData(item)
  geometry.setAttribute("position", new BufferAttribute(data.positions, 3))
  geometry.setIndex(new BufferAttribute(data.indices, 1))
  return geometry
}

function updateScalarPathGeometry(geometry: BufferGeometry, item: PathDisplayItem): void {
  const position = geometry.attributes.position
  const index = geometry.index
  if (position === undefined || index === null) {
    throw new Error("Scalar Path geometry storage is incomplete")
  }
  const data = scalarPathGeometryData(item)
  position.array = data.positions
  index.array = data.indices
  geometry.boundingSphere = null
}

function scalarPathGeometryData(item: PathDisplayItem): Readonly<{
  positions: Float32Array
  indices: Uint32Array
}> {
  const points = [
    item.geometry.segments[0]!.from,
    ...item.geometry.segments.map((segment) => segment.to),
  ].map((point) => ({x: item.x + point.x, y: item.y + point.y}))
  const halfWidth = item.strokeWidth / 2
  const positions: number[] = []
  const indices: number[] = []
  const normals = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1]!
    const x = next.x - point.x
    const y = next.y - point.y
    const length = Math.hypot(x, y)
    if (length <= Number.EPSILON) return {x: 0, y: 0}
    return {x: -y / length, y: x / length}
  })

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!
    const previous = normals[Math.max(0, index - 1)]!
    const next = normals[Math.min(normals.length - 1, index)]!
    let normalX = previous.x + next.x
    let normalY = previous.y + next.y
    let normalLength = Math.hypot(normalX, normalY)
    if (normalLength <= Number.EPSILON) {
      normalX = next.x
      normalY = next.y
      normalLength = Math.hypot(normalX, normalY) || 1
    }
    normalX /= normalLength
    normalY /= normalLength
    const denominator = Math.max(0.25, Math.abs(normalX * next.x + normalY * next.y))
    const offset = Math.min(halfWidth * 4, halfWidth / denominator)
    positions.push(
      point.x + normalX * offset, point.y + normalY * offset, 0,
      point.x - normalX * offset, point.y - normalY * offset, 0,
    )
    if (index === points.length - 1) continue
    const current = index * 2
    const following = current + 2
    indices.push(
      current, current + 1, following,
      current + 1, following + 1, following,
    )
  }

  appendRoundCap(positions, indices, points[0]!, points[1]!, halfWidth, true)
  appendRoundCap(
    positions,
    indices,
    points.at(-1)!,
    points.at(-2)!,
    halfWidth,
    false,
  )
  return Object.freeze({positions: new Float32Array(positions), indices: new Uint32Array(indices)})
}

function appendRoundCap(
  positions: number[],
  indices: number[],
  endpoint: Readonly<{x: number; y: number}>,
  adjacent: Readonly<{x: number; y: number}>,
  radius: number,
  start: boolean,
): void {
  const tangent = Math.atan2(
    start ? adjacent.y - endpoint.y : endpoint.y - adjacent.y,
    start ? adjacent.x - endpoint.x : endpoint.x - adjacent.x,
  )
  const firstAngle = start ? tangent + Math.PI / 2 : tangent - Math.PI / 2
  const centerIndex = positions.length / 3
  positions.push(endpoint.x, endpoint.y, 0)
  const steps = 8
  for (let index = 0; index <= steps; index += 1) {
    const angle = firstAngle + Math.PI * index / steps
    positions.push(
      endpoint.x + Math.cos(angle) * radius,
      endpoint.y + Math.sin(angle) * radius,
      0,
    )
    if (index === 0) continue
    indices.push(centerIndex, centerIndex + index, centerIndex + index + 1)
  }
}

function sameByteRecord(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function updatePathStyleRecord(
  layer: StrokedPathInstanceLayer["styles"],
  handle: InstanceHandle,
  previous: Uint8Array | undefined,
  next: Uint8Array,
): number {
  if (previous === undefined || previous.byteLength !== next.byteLength) {
    layer.setRecord(handle, next)
    return next.byteLength
  }
  let written = 0
  const ranges = [
    {offset: STROKED_PATH_STYLE_OFFSETS.color * 4, count: 16},
    {offset: STROKED_PATH_STYLE_OFFSETS.params * 4, count: 4},
    {offset: STROKED_PATH_STYLE_OFFSETS.params * 4 + 4, count: 4},
  ] as const
  for (const {offset, count} of ranges) {
    if (sameByteRecord(
      previous.subarray(offset, offset + count),
      next.subarray(offset, offset + count),
    )) continue
    layer.updateRecord(handle, offset, next.subarray(offset, offset + count))
    written += count
  }
  return written
}

function updatePathSegmentRecord(
  layer: StrokedPathInstanceLayer["segments"],
  handle: InstanceHandle,
  previous: Uint8Array | undefined,
  next: Uint8Array,
): number {
  if (previous === undefined || previous.byteLength !== next.byteLength) {
    layer.setRecord(handle, next)
    return next.byteLength
  }
  let written = 0
  for (const {offset, count} of [
    {offset: STROKED_PATH_SEGMENT_OFFSETS.endpoints * 4, count: 16},
    {offset: STROKED_PATH_SEGMENT_OFFSETS.styleSlot * 4, count: 8},
  ]) {
    if (sameByteRecord(
      previous.subarray(offset, offset + count),
      next.subarray(offset, offset + count),
    )) continue
    layer.updateRecord(handle, offset, next.subarray(offset, offset + count))
    written += count
  }
  return written
}

function pathOrderDifferenceBytes(
  layer: StrokedPathInstanceLayer["segments"],
  desired: readonly InstanceHandle[],
): number {
  if (desired.length !== layer.count) return desired.length * Uint32Array.BYTES_PER_ELEMENT
  let first = -1
  let last = -1
  for (let index = 0; index < desired.length; index += 1) {
    if (layer.handleAt(index) === desired[index]) continue
    if (first < 0) first = index
    last = index
  }
  return first < 0 ? 0 : (last - first + 1) * Uint32Array.BYTES_PER_ELEMENT
}

function samePathRun(left: PreparedPathItem, right: PreparedPathItem): boolean {
  if (left.item.presentationOwner !== right.item.presentationOwner) return false
  if (
    left.item.presentationOwner === null &&
    !sameRenderTransform(left.item.transform, right.item.transform)
  ) return false
  return samePreparedClipChain(left.clips, right.clips)
}

function samePreparedClipChain(
  left: readonly PreparedClip[],
  right: readonly PreparedClip[],
): boolean {
  return left.length === right.length && left.every((clip, index) => {
    const other = right[index]
    return other !== undefined &&
      clip.x === other.x &&
      clip.y === other.y &&
      clip.width === other.width &&
      clip.height === other.height &&
      clip.radii.every((radius, radiusIndex) => radius === other.radii[radiusIndex]) &&
      sameRenderTransform(clip.transform, other.transform)
  })
}

function resolvedPathTransform(item: PathDisplayItem, frame: RenderFrame): RenderTransform {
  if (item.presentationOwner === null) return item.transform
  return frame.presentationTransforms?.get(item.presentationOwner) ?? item.transform
}

function positionPathRun(node: InstancedStrokedPath, transform: RenderTransform): void {
  node.position.set(transform.translateX, -transform.translateY, 0)
  node.scale.set(transform.scaleX, -transform.scaleY, 1)
}

function positionPathMesh(node: Mesh, transform: RenderTransform): void {
  node.position.set(transform.translateX, -transform.translateY, 0)
  node.scale.set(transform.scaleX, -transform.scaleY, 1)
}

function sameFloatRecord(left: Float32Array, right: Float32Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function sameObjectOrder(left: readonly object[], right: readonly object[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index])
}

function validatedChangedDisplayChanges(
  frame: RenderFrame,
  cached: PreparedFrameCache,
): Readonly<{
  indexes: readonly number[]
  operations?: readonly Readonly<{
    fromIndex: number
    toIndex: number
    count: 1
    replacement: DisplayItem
  }>[]
}> | null {
  const changes = readCanonicalRenderFrameChanges(frame)
  if (changes === null) {
    return Object.freeze({
      indexes: Object.freeze(Array.from({length: frame.displayList.length}, (_, index) => index)),
    })
  }
  if (changes.previous !== cached.frame || frame.revision !== cached.revision + 1) return null
  const seen = new Set<number>()
  for (const index of changes.indexes) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= frame.displayList.length || seen.has(index)) {
      return null
    }
    seen.add(index)
  }
  if (changes.operations !== undefined) {
    if (changes.operations.length === 0 || changes.operations.length > 8) return null
    for (const {fromIndex, toIndex, count, replacement} of changes.operations) {
      if (
        count !== 1
        || !Number.isSafeInteger(fromIndex)
        || !Number.isSafeInteger(toIndex)
        || fromIndex < 0
        || toIndex < 0
        || fromIndex >= frame.displayList.length
        || toIndex >= frame.displayList.length
        || replacement === null
        || typeof replacement !== "object"
      ) return null
    }
  }
  return Object.freeze({
    indexes: changes.indexes,
    ...(changes.operations ? {operations: changes.operations} : {}),
  })
}

function sameDisplayIdentity(left: DisplayItem, right: DisplayItem): boolean {
  return left.kind === right.kind
    && left.node === right.node
    && left.key === right.key
}

function sameRectBatchTopology(left: RectDisplayItem, right: RectDisplayItem): boolean {
  return Object.is(left.x, right.x)
    && Object.is(left.y, right.y)
    && Object.is(left.width, right.width)
    && Object.is(left.height, right.height)
    && sameRectShadowGeometry(left.shadow, right.shadow)
    && Array.isArray(right.clips)
    && left.clips.length === 0
    && right.clips.length === 0
}

function rectBatchPlanRemainsSafe(
  plan: PreparedFramePlan,
  updates: readonly PreparedRectRecordUpdate[],
): boolean {
  if (updates.length === 0) return true
  const changed = new Map(updates.map((update) => [update.value.token, update.value]))
  for (const item of plan.items) {
    if (item.kind !== "rect-batch") continue
    const spatialIndex = new RectRunSpatialIndex()
    for (const previous of item.items) {
      const value = changed.get(previous.token) ?? previous
      if (!isRectInstanceCompatible(value) || spatialIndex.add(rectInstanceBounds(value)) !== "accepted") {
        return false
      }
    }
  }
  return true
}

function sameRenderTransform(left: RenderTransform, right: RenderTransform): boolean {
  return Object.is(left.scaleX, right.scaleX)
    && Object.is(left.scaleY, right.scaleY)
    && Object.is(left.translateX, right.translateX)
    && Object.is(left.translateY, right.translateY)
}

function sameRectShadowGeometry(
  left: RectDisplayItem["shadow"],
  right: RectDisplayItem["shadow"],
): boolean {
  if (left === null || right === null) return left === right
  return Object.is(left.blurRadius, right.blurRadius)
    && Object.is(left.spreadRadius, right.spreadRadius)
}

function isReusablePreparedItem(value: PreparedItem): boolean {
  return isReusableDisplayItem(value.item)
}

function isReusableDisplayItem(item: DisplayItem): boolean {
  if (
    !Object.isFrozen(item)
    || !Object.isFrozen(item.transform)
    || !Object.isFrozen(item.clips)
    || !item.clips.every(isReusableRenderClip)
  ) return false
  if (item.kind === "path") {
    return Object.isFrozen(item.geometry)
      && Object.isFrozen(item.geometry.cubics)
      && Object.isFrozen(item.geometry.segments)
      && Object.isFrozen(item.geometry.bounds)
      && item.geometry.cubics.every((cubic) =>
        Object.isFrozen(cubic)
        && Object.isFrozen(cubic.from)
        && Object.isFrozen(cubic.control1)
        && Object.isFrozen(cubic.control2)
        && Object.isFrozen(cubic.to)
      )
      && item.geometry.segments.every((segment) =>
        Object.isFrozen(segment)
        && Object.isFrozen(segment.from)
        && Object.isFrozen(segment.to)
      )
  }
  if (item.kind !== "rect") return true
  return Object.isFrozen(item.border)
    && Object.isFrozen(item.border.widths)
    && Object.isFrozen(item.border.colors)
    && Object.isFrozen(item.border.radii)
    && (item.shadow === null || Object.isFrozen(item.shadow))
}

function isReusableRenderClip(clip: RenderClip): boolean {
  return Object.isFrozen(clip)
    && Object.isFrozen(clip.transform)
    && Object.isFrozen(clip.radii)
    && Object.isFrozen(clip.radii.topLeft)
    && Object.isFrozen(clip.radii.topRight)
    && Object.isFrozen(clip.radii.bottomRight)
    && Object.isFrozen(clip.radii.bottomLeft)
}

function pendingUploadBytes(attribute: BufferAttribute): number {
  if (!attribute.needsUpdate) return 0
  if (attribute.fullUpdateRequired) return attribute.array.byteLength
  return attribute.updateRanges.reduce(
    (total, range) => total + range.count * attribute.array.BYTES_PER_ELEMENT,
    0,
  )
}

function positionPlane(
  node: Mesh,
  item: Readonly<{
    x: number
    y: number
    width: number
    height: number
    transform: RenderTransform
  }>,
): void {
  const center = applyRenderTransform(
    item.transform,
    item.x + item.width / 2,
    item.y + item.height / 2,
  )
  node.position.set(center.x, -center.y, 0)
  node.scale.set(item.transform.scaleX, item.transform.scaleY, 1)
}

function positionText(node: CachedText, item: TextDisplayItem, baselineY: number): void {
  const origin = applyRenderTransform(item.transform, item.x, baselineY)
  node.position.set(origin.x, -origin.y, 0)
  node.scale.set(item.transform.scaleX, item.transform.scaleY, 1)
}

function applyRenderTransform(
  transform: RenderTransform,
  x: number,
  y: number,
): Readonly<{x: number; y: number}> {
  return {
    x: transform.scaleX * x + transform.translateX,
    y: transform.scaleY * y + transform.translateY,
  }
}

function partialClipTransform(clip: RenderClip, source = clip.transform): RenderTransform {
  if (clip.clipX && clip.clipY) return source
  return Object.freeze({
    scaleX: clip.clipX ? source.scaleX : 1,
    scaleY: clip.clipY ? source.scaleY : 1,
    translateX: clip.clipX ? source.translateX : 0,
    translateY: clip.clipY ? source.translateY : 0,
  })
}

function createRetainedClipSpace(root: Object3D): RetainedClipSpace {
  const coordinateSpace = new Object3D()
  const localMatrix = new Matrix4()
  const worldMatrix = new Matrix4()
  coordinateSpace.name = "@zavx0z/renderer-webgpu:clip-space"
  Object.defineProperty(coordinateSpace, "matrixWorld", {
    configurable: false,
    enumerable: true,
    get: () => worldMatrix.multiplyMatrices(root.matrixWorld, localMatrix),
  })
  return {coordinateSpace, localMatrix}
}

function writeEngineTransform(matrix: Matrix4, transform: RenderTransform): void {
  matrix.set(
    transform.scaleX, 0, 0, transform.translateX,
    0, transform.scaleY, 0, -transform.translateY,
    0, 0, 1, 0,
    0, 0, 0, 1,
  )
}

function resizePlane(geometry: PlaneGeometry, width: number, height: number): void {
  const position = geometry.attributes.position
  if (position === undefined || position.array.length !== 12) {
    throw new Error("Engine PlaneGeometry position layout is unsupported")
  }

  const halfWidth = width / 2
  const halfHeight = height / 2
  const values = position.array
  values[0] = -halfWidth
  values[1] = halfHeight
  values[2] = 0
  values[3] = halfWidth
  values[4] = halfHeight
  values[5] = 0
  values[6] = -halfWidth
  values[7] = -halfHeight
  values[8] = 0
  values[9] = halfWidth
  values[10] = -halfHeight
  values[11] = 0
  position.needsUpdate = true
  geometry.boundingSphere = null
}

function radiiParameters(
  radii: readonly [number, number, number, number],
): {tl: number; tr: number; br: number; bl: number} {
  return {tl: radii[0], tr: radii[1], br: radii[2], bl: radii[3]}
}

function copyRadii(
  target: [number, number, number, number],
  source: readonly [number, number, number, number],
): void {
  target[0] = source[0]
  target[1] = source[1]
  target[2] = source[2]
  target[3] = source[3]
}

function validateClipRadii(
  clip: RenderClip,
  label: string,
): readonly [
  RenderClip["radii"]["topLeft"],
  RenderClip["radii"]["topRight"],
  RenderClip["radii"]["bottomRight"],
  RenderClip["radii"]["bottomLeft"],
] {
  if (clip.radii === null || typeof clip.radii !== "object") {
    throw new TypeError(`${label}.radii must be an object`)
  }
  const radii = [
    clip.radii.topLeft,
    clip.radii.topRight,
    clip.radii.bottomRight,
    clip.radii.bottomLeft,
  ] as const
  const names = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const
  for (let index = 0; index < radii.length; index += 1) {
    const radius = radii[index]
    const name = names[index]
    if (radius === null || typeof radius !== "object") {
      throw new TypeError(`${label}.radii.${name} must be an object`)
    }
    assertFiniteNonNegative(radius.x, `${label}.radii.${name}.x`)
    assertFiniteNonNegative(radius.y, `${label}.radii.${name}.y`)
  }
  return radii
}

function visibleUniformBorderColor(
  widths: readonly [number, number, number, number],
  colors: RectDisplayItem["border"]["colors"],
  label: string,
): Color {
  const values = [colors.top, colors.right, colors.bottom, colors.left] as const
  const visible = values.flatMap((value, index) => widths[index]! > 0
    ? [parseDisplayColor(value)]
    : [])
  const first = visible[0]
  if (first === undefined) return new Color(0, 0, 0, 0)
  if (visible.some(color => !sameColor(first, color))) {
    throw new Error(`${label} has non-uniform border colors unsupported by RoundedRectMaterial`)
  }
  return first
}

function prepareRectShadow(
  item: RectDisplayItem,
  borderWidths: readonly [number, number, number, number],
  label: string,
): PreparedRectItem["shadow"] {
  if (item.shadow === null) return null
  if (typeof item.shadow !== "object") throw new TypeError(`${label}.shadow must be an object or null`)
  assertFiniteNonNegative(item.shadow.blurRadius, `${label}.shadow.blurRadius`)
  assertFiniteNonNegative(item.shadow.spreadRadius, `${label}.shadow.spreadRadius`)
  if (item.width <= 0 || item.height <= 0) {
    throw new Error(`${label} analytical shadow requires positive source dimensions`)
  }
  if (borderWidths.some((width) => width !== 0)) {
    throw new Error(`${label} analytical shadow cannot carry border widths`)
  }
  const expansion = item.shadow.blurRadius + item.shadow.spreadRadius
  const geometryWidth = item.width + expansion * 2
  const geometryHeight = item.height + expansion * 2
  assertFinitePositive(geometryWidth, `${label}.shadow.geometryWidth`)
  assertFinitePositive(geometryHeight, `${label}.shadow.geometryHeight`)
  return Object.freeze({
    blurRadius: item.shadow.blurRadius,
    spreadRadius: item.shadow.spreadRadius,
    geometryWidth,
    geometryHeight,
  })
}

function sameColor(left: Color, right: Color): boolean {
  return left.r === right.r && left.g === right.g && left.b === right.b && left.a === right.a
}

function parseDisplayColor(value: string): Color {
  const normalized = value.trim().toLowerCase()
  if (normalized === "transparent") return new Color(0, 0, 0, 0)

  const hex = /^#([0-9a-f]+)$/i.exec(normalized)?.[1]
  if (hex !== undefined) {
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0]! + hex[0]!, 16)
      const g = Number.parseInt(hex[1]! + hex[1]!, 16)
      const b = Number.parseInt(hex[2]! + hex[2]!, 16)
      const a = hex.length === 4 ? Number.parseInt(hex[3]! + hex[3]!, 16) : 255
      return new Color(r / 255, g / 255, b / 255, a / 255)
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255
      return new Color(r / 255, g / 255, b / 255, a / 255)
    }
  }

  const functional = /^(rgb|rgba)\((.*)\)$/.exec(normalized)
  if (functional !== null) {
    const parts = functionalColorParts(functional[1]!, functional[2]!)
    if (parts !== null) {
      const r = parseRgbChannel(parts.channels[0])
      const g = parseRgbChannel(parts.channels[1])
      const b = parseRgbChannel(parts.channels[2])
      const a = parts.alpha === null ? 1 : parseAlphaChannel(parts.alpha)
      if ([r, g, b, a].every(Number.isFinite)) return new Color(r, g, b, a)
    }
  }

  throw new Error(`Unsupported resolved display color: ${value}`)
}

function functionalColorParts(
  functionName: string,
  value: string,
): Readonly<{channels: readonly [string, string, string]; alpha: string | null}> | null {
  if (value.includes(",")) {
    const parts = value.split(",").map((part) => part.trim())
    const expected = functionName === "rgba" ? 4 : 3
    if (parts.length !== expected || parts.some((part) => part.length === 0)) return null
    return Object.freeze({
      channels: Object.freeze([parts[0]!, parts[1]!, parts[2]!] as const),
      alpha: parts[3] ?? null,
    })
  }

  const slash = value.split("/")
  if (slash.length > 2) return null
  const channels = slash[0]?.trim().split(/\s+/).filter(Boolean) ?? []
  const alpha = slash[1]?.trim() ?? null
  if (channels.length !== 3 || alpha === "") return null
  return Object.freeze({
    channels: Object.freeze([channels[0]!, channels[1]!, channels[2]!] as const),
    alpha,
  })
}

function parseRgbChannel(value: string): number {
  if (value.endsWith("%")) return clampUnit(Number.parseFloat(value) / 100)
  return clampUnit(Number.parseFloat(value) / 255)
}

function parseAlphaChannel(value: string): number {
  if (value.endsWith("%")) return clampUnit(Number.parseFloat(value) / 100)
  return clampUnit(Number.parseFloat(value))
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`)
}

function assertFiniteFloat32(value: number, label: string): void {
  if (!Number.isFinite(Math.fround(value))) throw new RangeError(`${label} must fit finite float32`)
}

function assertFiniteNonNegative(value: number, label: string): void {
  assertFinite(value, label)
  if (value < 0) throw new Error(`${label} must be non-negative`)
}

function assertFinitePositive(value: number, label: string): void {
  assertFinite(value, label)
  if (value <= 0) throw new Error(`${label} must be positive`)
}

function assertUnitOpacity(value: number, label: string): number {
  assertFinite(value, label)
  if (value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`)
  return value
}

function readFontMetrics(font: TrueTypeFont): Readonly<{
  unitsPerEm: number
  baselineCenterRatio: number
}> {
  const unitsPerEm = font.unitsPerEm
  const ascent = font.ascent
  const descent = font.descent
  assertFinitePositive(unitsPerEm, "RendererWebGpuBackendOptions.font.unitsPerEm")
  assertFiniteNonNegative(ascent, "RendererWebGpuBackendOptions.font.ascent")
  assertFiniteNonNegative(descent, "RendererWebGpuBackendOptions.font.descent")
  return Object.freeze({
    unitsPerEm,
    baselineCenterRatio: (ascent - descent) / (2 * unitsPerEm),
  })
}

function createFontTextMeasurer(
  font: TrueTypeFont,
  unitsPerEm: number,
): RenderTextMeasurer {
  const normalizedAdvanceByCodePoint = new Map<number, number>()
  return Object.freeze({
    measureTextAdvance(value: string, fontSize: number, letterSpacing: number): number {
      assertFiniteNonNegative(fontSize, "fontSize")
      assertFinite(letterSpacing, "letterSpacing")
      let width = 0
      let hasPrevious = false
      for (const character of value) {
        if (hasPrevious) width += letterSpacing
        hasPrevious = true
        const codePoint = character.codePointAt(0)!
        let normalizedAdvance = normalizedAdvanceByCodePoint.get(codePoint)
        if (normalizedAdvance === undefined) {
          normalizedAdvance = character === " "
            ? 0.3
            : font.getHMetric(font.mapCharToGlyph(codePoint)).advanceWidth / unitsPerEm
          assertFiniteNonNegative(normalizedAdvance, "font glyph advance")
          if (normalizedAdvanceByCodePoint.size >= FONT_ADVANCE_CACHE_LIMIT) {
            normalizedAdvanceByCodePoint.clear()
          }
          normalizedAdvanceByCodePoint.set(codePoint, normalizedAdvance)
        }
        width += normalizedAdvance * fontSize
      }
      if (!Number.isFinite(width)) throw new Error("measured text advance must be finite")
      return Math.max(0, width)
    },
  })
}
