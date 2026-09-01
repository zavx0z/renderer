import {InstancedStrokedPath} from "../node_modules/@engine/core/src/index.ts"
import {createDocument} from "../packages/dom/src/index.ts"
import {createDocumentRenderer} from "../packages/core/src/index.ts"
import {RendererWebGpuBackend} from "../packages/webgpu/src/index.ts"

const count = positiveInteger(process.argv[2] ?? "10000", "count")
const sampleCount = positiveInteger(process.argv[3] ?? "30", "samples")
const warmupCount = nonNegativeInteger(process.argv[4] ?? "5", "warmups")
const ordinaryCount = positiveInteger(process.argv[5] ?? "64", "ordinary-count")
const document = createDocument()
const root = document.createElement("div")
document.appendChild(root)
const baseStyle = "position:relative;width:1000px;height:1000px"
root.setAttribute(
  "style",
  `${baseStyle};transform:translate(0px,0px) scale(1);transform-origin:0 0`,
)
for (let index = 0; index < count; index += 1) {
  const path = document.createElement("vector-path")
  const y = index % 1000
  path.d = `M 0 ${y} L 40 ${y} Q 50 ${y} 50 ${y + 10} L 50 ${y + 20}`
  path.setAttribute("style", "stroke:#4472b3;stroke-width:2.2px;pointer-hit-width:16px")
  root.appendChild(path)
}
for (let index = 0; index < ordinaryCount; index += 1) {
  const node = document.createElement("div")
  node.setAttribute(
    "style",
    `position:absolute;left:${(index % 8) * 110}px;top:${Math.floor(index / 8) * 80}px;width:80px;height:50px;background:#1d2735`,
  )
  root.appendChild(node)
}
const renderer = createDocumentRenderer({
  document,
  root,
  viewport: {width: 1200, height: 1200},
})
const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
Bun.gc(true)
const initialStarted = performance.now()
backend.applyFrame(renderer.flush())
const initialMs = performance.now() - initialStarted
const run = backend.root.children[0]
if (!(run instanceof InstancedStrokedPath)) throw new Error("Path benchmark expected one retained run")
clearUploads(run)

const samples: number[] = []
const cpuSamples: number[] = []
const backendSamples: number[] = []
let reusedFrames = 0
for (let index = 0; index < warmupCount + sampleCount; index += 1) {
  const offset = index % 2 === 0 ? 5 : 0
  const started = performance.now()
  root.setAttribute(
    "style",
    `${baseStyle};transform:translate(${offset}px,${offset + 2}px) scale(${offset === 0 ? 1 : 1.25});transform-origin:0 0`,
  )
  const frame = renderer.flush()
  const cpuFinished = performance.now()
  backend.applyFrame(frame)
  const finished = performance.now()
  if (index >= warmupCount) {
    samples.push(finished - started)
    cpuSamples.push(cpuFinished - started)
    backendSamples.push(finished - cpuFinished)
    if (backend.diagnostics.rectPlanReused) reusedFrames += 1
  }
}
samples.sort((left, right) => left - right)
cpuSamples.sort((left, right) => left - right)
backendSamples.sort((left, right) => left - right)
const diagnostics = backend.diagnostics
const p50 = percentile(samples, 0.5)
const p95 = percentile(samples, 0.95)

console.log(JSON.stringify({
  benchmark: "vector-paths",
  count,
  ordinaryCount,
  initialMs,
  transform: {
    samples: sampleCount,
    warmups: warmupCount,
    p50,
    p95,
    p99: percentile(samples, 0.99),
    max: samples.at(-1),
    cpuP95: percentile(cpuSamples, 0.95),
    backendP95: percentile(backendSamples, 0.95),
    reusedFrames,
    productP95TargetMs: 16.7,
    productP95TargetMet: p95 < 16.7,
  },
  diagnostics,
  onePathRun: diagnostics.pathInstancedDraws === 1 && diagnostics.pathScalarDraws === 0,
  zeroTransformWrites: diagnostics.pathStyleWriteBytes === 0 &&
    diagnostics.pathSegmentWriteBytes === 0 &&
    diagnostics.pathOrderWriteBytes === 0,
}, null, 2))

if (
  p95 >= 16.7
  || diagnostics.pathInstancedDraws !== 1
  || diagnostics.pathScalarDraws !== 0
  || diagnostics.pathStyleWriteBytes !== 0
  || diagnostics.pathSegmentWriteBytes !== 0
  || diagnostics.pathOrderWriteBytes !== 0
) process.exitCode = 1

backend.dispose()
renderer.dispose()

function clearUploads(value: InstancedStrokedPath): void {
  value.layer.styles.recordAttribute.clearUpdateRanges()
  value.layer.segments.recordAttribute.clearUpdateRanges()
  value.layer.segments.orderAttribute.clearUpdateRanges()
}

function percentile(values: readonly number[], quantile: number): number {
  return values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * quantile) - 1))]!
}

function positiveInteger(source: string, label: string): number {
  const value = Number.parseInt(source, 10)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be positive`)
  return value
}

function nonNegativeInteger(source: string, label: string): number {
  const value = Number.parseInt(source, 10)
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be non-negative`)
  return value
}
