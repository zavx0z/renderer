import {createDocument} from "@zavx0z/dom"
import {createDocumentRenderer} from "../packages/core/src/index.ts"

const count = positiveInteger(process.argv[2] ?? "10000", "hidden count")
const sampleCount = positiveInteger(process.argv[3] ?? "100", "sample count")
const document = createDocument()
const root = document.createElement("main")
const rootStyle = "display:block; width:1200px; height:800px; transform-origin:0 0"
root.setAttribute("style", rootStyle)
document.appendChild(root)
const visible = Array.from({length: 12}, (_, index) => {
  const element = document.createElement("div")
  element.setAttribute(
    "style",
    `display:block; width:20px; height:20px; background:#ffffff; transform:translateX(${index}px)`,
  )
  root.appendChild(element)
  return element
})
const hidden = Array.from({length: count}, (_, index) => {
  const element = document.createElement("article")
  const child = document.createElement("div")
  child.setAttribute("style", `display:block; width:20px; height:20px; transform:translateX(${index}px)`)
  element.hidden = true
  element.appendChild(child)
  root.appendChild(element)
  return element
})
const renderer = createDocumentRenderer({
  document,
  root,
  viewport: {width: 1200, height: 800},
})
const initial = renderer.flush()
const visibleNodesProjected = visible.every(element => initial.boxByNode.has(element))
const hiddenNodesProjected = hidden.some(element =>
  initial.boxByNode.has(element) || initial.boxByNode.has(element.firstElementChild!),
)
const samples: number[] = []
let correctness = visibleNodesProjected && !hiddenNodesProjected

for (let index = 0; index < sampleCount; index += 1) {
  const startedAt = performance.now()
  root.setAttribute(
    "style",
    `${rootStyle}; transform:translate(${index + 1}px, ${index % 3}px) scale(${index % 2 ? .99 : 1.01})`,
  )
  const frame = renderer.flush()
  samples.push(performance.now() - startedAt)
  correctness &&= visible.every(element => frame.boxByNode.has(element)) &&
    hidden.every(element => !frame.boxByNode.has(element) && !frame.boxByNode.has(element.firstElementChild!))
}

const sorted = [...samples].sort((left, right) => left - right)
const result = Object.freeze({
  benchmark: "renderer-hidden-transform-patch",
  count,
  visibleCount: visible.length,
  sampleCount,
  timingMs: Object.freeze({
    p50: round(percentile(sorted, .5)),
    p95: round(percentile(sorted, .95)),
    p99: round(percentile(sorted, .99)),
    max: round(sorted.at(-1) ?? 0),
  }),
  correctness,
  pass: correctness && percentile(sorted, .99) <= 1_000 / 60,
})

console.log(JSON.stringify(result, null, 2))
renderer.dispose()
if (!result.pass) process.exitCode = 1

function percentile(sorted: readonly number[], quantile: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))
  return sorted[index] ?? 0
}

function positiveInteger(source: string, label: string): number {
  const value = Number.parseInt(source, 10)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be positive`)
  return value
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000
}
