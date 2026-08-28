import {
  BufferGeometry,
  type BufferAttribute,
  CachedText,
  Color,
  ImageMaterial,
  InstancedRoundedRect,
  type InstanceHandle,
  Matrix4,
  Mesh,
  Object3D,
  PlaneGeometry,
  ROUNDED_RECT_INSTANCE_OFFSETS,
  ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH,
  RoundedRectInstanceLayer,
  RoundedRectMaterial,
  Text,
  TextMaterial,
  type PresentationClipShape,
  type TrueTypeFont,
} from "@engine/core"
import type {
  DisplayItem,
  ImageDisplayItem,
  RectDisplayItem,
  RenderClip,
  RenderFrame,
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

type PreparedItem = PreparedRectItem | PreparedTextItem | PreparedImageItem

type PreparedRectBatch = Readonly<{
  kind: "rect-batch"
  items: readonly PreparedRectItem[]
  firstInstance: number
}>

type PlannedItem = PreparedItem | PreparedRectBatch

type PreparedFramePlan = Readonly<{
  items: readonly PlannedItem[]
  slottedRects: readonly PreparedRectItem[]
  batchedTokens: ReadonlySet<DisplayToken>
}>

type PreparedFrameCache = Readonly<{
  revision: number
  viewportWidth: number
  viewportHeight: number
  prepared: PreparedItem[]
  plan: PreparedFramePlan
  rootChildren: readonly Object3D[]
  reusableSources: boolean
  recordVersion: number
  orderVersion: number
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

type RetainedEntry = RectEntry | TextEntry | ImageEntry

const WHITE = "#ffffff"
const NO_PRESENTATION_CLIPS: readonly PresentationClipShape[] = Object.freeze([])
const NO_PREPARED_CLIPS: readonly PreparedClip[] = Object.freeze([])
const DEFAULT_MAX_RECT_INSTANCES = 1_048_576
const RECT_RUN_INDEX_CELL_SIZE = 64
const MAX_RECT_RUN_INDEX_CELLS = 256

/**
 * Retained projection of resolved Rect/Text/Image display items into Engine objects.
 *
 * Item identity is the composite `(DisplayItem.node, DisplayItem.key)`. The
 * backend does not evaluate DOM, selectors, CSS, layout, events or hit
 * semantics.
 */
export class RendererWebGpuBackend {
  public readonly root = new Object3D()

  readonly #font: TrueTypeFont | undefined
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
  #disposed = false

  constructor(options: RendererWebGpuBackendOptions) {
    this.#font = options.font
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
    this.root.name = "@zavx0z/renderer-webgpu"
    this.root.renderLayer = "ui"
  }

  public get diagnostics(): RendererWebGpuBackendDiagnostics {
    const instances = this.#rectLayer.instances
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
    })
  }

  /** Applies one complete immutable display frame to the stable Engine root. */
  public applyFrame(frame: RenderFrame): void {
    if (this.#disposed) throw new Error("RendererWebGpuBackend is disposed")
    this.#validateFrameEnvelope(frame)

    const reused = this.#tryReusePreparedFrame(frame)
    if (reused !== null) {
      this.#applyReusedPreparedFrame(frame, reused)
      return
    }

    const prepared = this.#prepareFrame(frame)
    const plan = this.#planFrame(prepared)
    const created = new Map<DisplayToken, RetainedEntry>()

    // Allocate every required replacement before mutating retained entries.
    for (const value of plan.items) {
      if (value.kind === "rect-batch") continue
      const existing = this.#entries.get(value.token)
      if (existing?.kind === value.item.kind) continue
      created.set(value.token, this.#createEntry(value))
    }

    this.#synchronizeRectLayer(plan.slottedRects)

    const nextEntries = new Map<DisplayToken, RetainedEntry>()
    const nextNodes: Object3D[] = []
    const stale: RetainedEntry[] = []
    let rectRunIndex = 0
    let rectScalarDraws = 0
    let rectInstancedInstances = 0

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

    this.#entries = nextEntries
    this.#setRootChildren(nextNodes)
    this.#diagnosticRevision = frame.revision
    this.#rectPlanReused = false
    this.#rectPreparedItems = prepared.length
    this.#rectScalarDraws = rectScalarDraws
    this.#rectInstancedInstances = rectInstancedInstances
    this.#commitPreparedFrame(frame, prepared, plan, prepared.every(isReusablePreparedItem))
    for (const geometry of geometries) this.#invalidateGeometry(geometry)
    this.#invalidateEvictedTextGeometries()
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
    this.#preparedFrameCache = null
    this.#frameDocument = null
    this.#frameRoot = null
    this.#lastFrameRevision = -1
    for (const run of this.#rectRuns) run.parent = null
    this.root.children = []

    for (const geometry of geometries) this.#invalidateGeometry(geometry)
    if (this.#rectLayerWasPresented) this.#invalidateGeometry(this.#rectLayer.geometry)
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
    if (!this.#hasRetainedBatchTopology(cached.plan)) return null

    const recordUpdates: PreparedRectRecordUpdate[] = []
    for (let index = 0; index < cached.prepared.length; index += 1) {
      const previous = cached.prepared[index]!
      const item = frame.displayList[index]!
      if (item === previous.item) continue
      if (frame.revision === cached.revision) return null
      if (!sameDisplayIdentity(previous.item, item)) return null
      if (
        previous.kind !== "rect"
        || item.kind !== "rect"
        || !cached.plan.batchedTokens.has(previous.token)
        || !sameRectBatchTopology(previous.item, item)
        || !isReusableDisplayItem(item)
      ) return null

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

    return Object.freeze({
      plan: cached.plan,
      recordUpdates: Object.freeze(recordUpdates),
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
    this.#diagnosticRevision = frame.revision
    this.#rectPlanReused = true
    this.#rectPreparedItems = reused.recordUpdates.length
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
      revision: frame.revision,
      viewportWidth: frame.viewport.width,
      viewportHeight: frame.viewport.height,
      prepared,
      plan,
      rootChildren: Object.freeze([...this.root.children]),
      reusableSources,
      recordVersion: this.#rectLayer.instances.recordAttribute.version,
      orderVersion: this.#rectLayer.instances.orderAttribute.version,
    })
  }

  #hasRetainedBatchTopology(plan: PreparedFramePlan): boolean {
    if (this.#rectLayer.instances.count !== plan.slottedRects.length) return false
    let runIndex = 0
    for (const item of plan.items) {
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
  }

  #planFrame(prepared: readonly PreparedItem[]): PreparedFramePlan {
    if (this.#rectInstancing === "disabled") {
      return Object.freeze({
        items: prepared,
        slottedRects: Object.freeze([]),
        batchedTokens: new Set<DisplayToken>(),
      })
    }

    const slottedRects: PreparedRectItem[] = []
    const batchedTokens = new Set<DisplayToken>()
    const orderIndexByToken = new Map<DisplayToken, number>()
    for (const value of prepared) {
      if (
        value.kind !== "rect"
        || !isRectInstanceCompatible(value)
        || slottedRects.length >= this.#rectLayer.instances.maxCapacity
      ) continue
      orderIndexByToken.set(value.token, slottedRects.length)
      slottedRects.push(value)
    }

    const items: PlannedItem[] = []
    let run: PreparedRectItem[] = []
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

    for (const value of prepared) {
      const orderIndex = value.kind === "rect"
        ? orderIndexByToken.get(value.token)
        : undefined
      if (value.kind !== "rect" || orderIndex === undefined) {
        flushRun()
        items.push(value)
        continue
      }

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

    return Object.freeze({
      items: Object.freeze(items),
      slottedRects: Object.freeze(slottedRects),
      batchedTokens,
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
        if (this.#font === undefined) {
          throw new Error(`Text display item at index ${index} requires RendererWebGpuBackendOptions.font`)
        }
        assertFiniteNonNegative(item.fontSize, `${label}.fontSize`)
        assertFinite(item.letterSpacing, `${label}.letterSpacing`)
        const opacity = assertUnitOpacity(item.opacity, `${label}.opacity`)
        prepared.push(Object.freeze({
          kind: "text",
          item,
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

      const transform = partialClipTransform(clip)
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
    return this.#createImage(value)
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
    positionText(node, item)
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
      positionText(entry.node, value.item)
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

    throw new Error("Display item kind mismatch")
  }

  #updateClips(entry: RetainedEntry, clips: readonly PreparedClip[]): void {
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
    if (entry.kind === "rect" || entry.kind === "image") geometries.add(entry.geometry)
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
    && sameRenderTransform(left.transform, right.transform)
    && sameRectShadowGeometry(left.shadow, right.shadow)
    && Array.isArray(right.clips)
    && left.clips.length === 0
    && right.clips.length === 0
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

function positionText(node: CachedText, item: TextDisplayItem): void {
  const origin = applyRenderTransform(item.transform, item.x, item.y + item.fontSize)
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

function partialClipTransform(clip: RenderClip): RenderTransform {
  if (clip.clipX && clip.clipY) return clip.transform
  return Object.freeze({
    scaleX: clip.clipX ? clip.transform.scaleX : 1,
    scaleY: clip.clipY ? clip.transform.scaleY : 1,
    translateX: clip.clipX ? clip.transform.translateX : 0,
    translateY: clip.clipY ? clip.transform.translateY : 0,
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
