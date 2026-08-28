import {createDocument, type Node} from "../packages/dom/src/index.ts"
import type {DisplayItem, RenderFrame} from "../packages/core/src/index.ts"
import {RendererWebGpuBackend} from "../packages/webgpu/src/index.ts"

const IDENTITY_TRANSFORM = Object.freeze({
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
})
const NO_BORDER = Object.freeze({
  widths: Object.freeze({top: 0, right: 0, bottom: 0, left: 0}),
  colors: Object.freeze({top: "#000", right: "#000", bottom: "#000", left: "#000"}),
  radii: Object.freeze({topLeft: 2, topRight: 2, bottomRight: 2, bottomLeft: 2}),
})

const count = Number.parseInt(process.argv[2] ?? "10000", 10)
if (!Number.isInteger(count) || count <= 0) throw new Error("count must be a positive integer")

const document = createDocument()
const root = document.createElement("div")
document.appendChild(root)
const items = Array.from({length: count}, (_, index) => rect(
  document.createElement("div"),
  index * 12,
))
const renderFrame = frame(document, root, items)

const beforeInstanced = process.memoryUsage().heapUsed
const instanced = new RendererWebGpuBackend({invalidateGeometry() {}})
const instancedStart = performance.now()
instanced.applyFrame(renderFrame)
const instancedMs = performance.now() - instancedStart
const instancedHeapBytes = process.memoryUsage().heapUsed - beforeInstanced
const initialInstancedDiagnostics = instanced.diagnostics
const batch = instanced.root.children[0] as unknown as Readonly<{
  constructor: Readonly<{name: string}>
  layer: Readonly<{
    instances: Readonly<{
      recordAttribute: {clearUpdateRanges(): unknown}
      orderAttribute: {clearUpdateRanges(): unknown}
    }>
  }>
}>
if (batch?.constructor.name !== "InstancedRoundedRect") {
  throw new Error("safe workload did not produce one batch")
}

batch.layer.instances.recordAttribute.clearUpdateRanges()
batch.layer.instances.orderAttribute.clearUpdateRanges()
const changed = [...items]
changed[Math.floor(count / 2)] = rect(
  items[Math.floor(count / 2)]!.node,
  Math.floor(count / 2) * 12,
  "#ff8000",
)
const changedFrame = frame(document, root, changed, 2)
const updateStart = performance.now()
instanced.applyFrame(changedFrame)
const updateMs = performance.now() - updateStart
const updateDiagnostics = instanced.diagnostics
const warmUpdateSamples: number[] = []
let warmItems = changed
for (let sample = 0; sample < 20; sample += 1) {
  const next = [...warmItems]
  next[Math.floor(count / 2)] = rect(
    items[Math.floor(count / 2)]!.node,
    Math.floor(count / 2) * 12,
    sample % 2 === 0 ? "#336699" : "#ff8000",
  )
  const nextFrame = frame(document, root, next, 3 + sample)
  const start = performance.now()
  instanced.applyFrame(nextFrame)
  warmUpdateSamples.push(performance.now() - start)
  warmItems = next
}
warmUpdateSamples.sort((left, right) => left - right)

const beforeScalar = process.memoryUsage().heapUsed
const scalar = new RendererWebGpuBackend({rectInstancing: "disabled", invalidateGeometry() {}})
const scalarStart = performance.now()
scalar.applyFrame(renderFrame)
const scalarMs = performance.now() - scalarStart
const scalarHeapBytes = process.memoryUsage().heapUsed - beforeScalar

console.log(JSON.stringify({
  workload: {rects: count, overlap: false, clips: false},
  instanced: {
    applyMs: instancedMs,
    heapBytes: instancedHeapBytes,
    owners: instanced.root.children.length,
    diagnostics: initialInstancedDiagnostics,
  },
  scalar: {
    applyMs: scalarMs,
    heapBytes: scalarHeapBytes,
    owners: scalar.root.children.length,
    diagnostics: scalar.diagnostics,
  },
  singleRecordUpdate: {
    applyMs: updateMs,
    planReused: updateDiagnostics.rectPlanReused,
    preparedItems: updateDiagnostics.rectPreparedItems,
    recordUploadBytes: updateDiagnostics.pendingRecordUploadBytes,
    orderUploadBytes: updateDiagnostics.pendingOrderUploadBytes,
  },
  warmSingleRecordUpdate: {
    samples: warmUpdateSamples.length,
    p50Ms: percentile(warmUpdateSamples, 0.5),
    p95Ms: percentile(warmUpdateSamples, 0.95),
    maxMs: warmUpdateSamples.at(-1) ?? 0,
  },
}, null, 2))

instanced.dispose()
scalar.dispose()

function rect(
  node: Node,
  x: number,
  color = "#336699",
): Extract<DisplayItem, {kind: "rect"}> {
  return Object.freeze({
    kind: "rect",
    key: "rect",
    node,
    x,
    y: 0,
    width: 10,
    height: 10,
    color,
    opacity: 1,
    border: NO_BORDER,
    shadow: null,
    clips: Object.freeze([]),
    transform: IDENTITY_TRANSFORM,
  })
}

function frame(
  owner: RenderFrame["document"],
  root: Node,
  displayList: readonly DisplayItem[],
  revision = 1,
): RenderFrame {
  return Object.freeze({
    revision,
    document: owner,
    root,
    viewport: Object.freeze({width: count * 12, height: 12}),
    boxes: Object.freeze([]),
    boxByNode: new Map(),
    displayList: Object.freeze([...displayList]),
    hits: new Map(),
    scrolls: new Map(),
  })
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return 0
  return values[Math.min(values.length - 1, Math.floor(values.length * quantile))]!
}
