import {createDocument} from "@zavx0z/dom"
import {createDocumentRenderer} from "../packages/core/src/index.ts"

const count = positiveInteger(process.argv[2] ?? "10000", "row count")
const sampleCount = positiveInteger(process.argv[3] ?? "100", "sample count")
const document = createDocument()
const root = document.createElement("main")
root.setAttribute("style", "display:flex; flex-direction:column; width:300px")
document.appendChild(root)
const rows = Array.from({length: count}, (_, index) => {
  const row = document.createElement("div")
  row.setAttribute("data-row", String(index))
  row.setAttribute("style", "display:block; width:300px; height:1px; background:#111111")
  root.appendChild(row)
  return row
})
const renderer = createDocumentRenderer({
  document,
  root,
  viewport: {width: 300, height: Math.max(600, count)},
})

const initialStartedAt = performance.now()
let frame = renderer.flush()
const initialMs = performance.now() - initialStartedAt
const initialBoxes = frame.boxes
const initialBoxMap = frame.boxByNode
const initialDisplayList = frame.displayList
const initialHits = frame.hits
const initialScrolls = frame.scrolls
const unchanged = rows[Math.floor(count / 2)]!
const unchangedBox = required(frame.boxByNode.get(unchanged))
const samples: number[] = []
let identityPreserved = true
let invisibleOwnersProjected = false

for (let index = 0; index < sampleCount; index += 1) {
  const hidden = document.createElement("article")
  hidden.hidden = true
  hidden.textContent = `Deferred owner ${index}`
  document.transaction(() => {
    root.setAttribute("data-item-count", String(count + index + 1))
    root.append(
      document.createComment("component:start"),
      hidden,
      document.createComment("component:end"),
    )
  })
  const startedAt = performance.now()
  const next = renderer.flush()
  samples.push(performance.now() - startedAt)
  identityPreserved &&= next.boxes === initialBoxes &&
    next.boxByNode === initialBoxMap &&
    next.displayList === initialDisplayList &&
    next.hits === initialHits &&
    next.scrolls === initialScrolls &&
    next.boxByNode.get(unchanged) === unchangedBox
  invisibleOwnersProjected ||= next.boxByNode.has(hidden) ||
    next.displayList.some(item => item.node === hidden || hidden.contains(item.node)) ||
    next.hits.has(hidden)
  frame = next
}

const sorted = [...samples].sort((left, right) => left - right)
const result = Object.freeze({
  benchmark: "renderer-projection-neutral-patch",
  count,
  sampleCount,
  initialMs: round(initialMs),
  timingMs: Object.freeze({
    p50: round(percentile(sorted, .5)),
    p95: round(percentile(sorted, .95)),
    p99: round(percentile(sorted, .99)),
    max: round(sorted.at(-1) ?? 0),
  }),
  frameRevision: frame.revision,
  identityPreserved,
  invisibleOwnersProjected,
  pass: identityPreserved && !invisibleOwnersProjected &&
    percentile(sorted, .99) <= 1_000 / 60,
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
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return value
}

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error("Required benchmark value is missing")
  return value
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000
}
