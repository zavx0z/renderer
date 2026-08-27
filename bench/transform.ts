import {Mesh} from "@engine/core"
import {createDocument} from "@zavx0z/dom"
import {createDocumentRenderer} from "@zavx0z/renderer"
import {RendererWebGpuBackend} from "@zavx0z/renderer-webgpu"

const count = positiveInteger(process.argv[2] ?? "1000", "count")
const sampleCount = positiveInteger(process.argv[3] ?? "100", "samples")
const warmupCount = nonNegativeInteger(process.argv[4] ?? "20", "warmups")
const document = createDocument()
const root = document.createElement("div")
document.appendChild(root)
const rootStyle = "display:flex; flex-wrap:wrap; box-sizing:border-box; width:1000px; height:1000px"
root.setAttribute("style", rootStyle)
for (let index = 0; index < count; index += 1) {
  const item = document.createElement("div")
  item.setAttribute(
    "style",
    "box-sizing:border-box; flex:none; width:10px; height:10px; background:#ffffff",
  )
  root.appendChild(item)
}
const renderer = createDocumentRenderer({
  document,
  root,
  viewport: {width: 1200, height: 1200},
})
const invalidated: unknown[] = []
const backend = new RendererWebGpuBackend({
  invalidateGeometry: (geometry) => invalidated.push(geometry),
})
backend.applyFrame(renderer.flush())
const retained = backend.root.children.map((node) => {
  if (!(node instanceof Mesh) || Array.isArray(node.material)) {
    throw new Error("Transform benchmark expected one Mesh/material per display item")
  }
  return {node, geometry: node.geometry, material: node.material}
})

let sequence = 0
const sample = (): number => {
  const offset = sequence++ % 2
  const startedAt = performance.now()
  root.setAttribute(
    "style",
    `${rootStyle}; transform:translate(${offset}px, ${offset}px) scale(${offset ? 0.999 : 1}); transform-origin:0 0`,
  )
  backend.applyFrame(renderer.flush())
  return performance.now() - startedAt
}
for (let index = 0; index < warmupCount; index += 1) sample()
const samples = Array.from({length: sampleCount}, sample)
const sorted = [...samples].sort((left, right) => left - right)
const percentile = (value: number): number => sorted[
  Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * value) - 1))
]!
const identitiesPreserved = retained.every((entry, index) => {
  const current = backend.root.children[index]
  return current === entry.node && current instanceof Mesh &&
    current.geometry === entry.geometry && current.material === entry.material
})

console.log(JSON.stringify({
  benchmark: "transform",
  count,
  samples: sampleCount,
  warmups: warmupCount,
  min: sorted[0],
  mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
  p50: percentile(0.5),
  p95: percentile(0.95),
  p99: percentile(0.99),
  max: sorted.at(-1),
  identitiesPreserved,
  invalidatedGeometries: invalidated.length,
}))

backend.dispose()
renderer.dispose()

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
