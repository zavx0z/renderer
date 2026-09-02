import {createDocument} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type DisplayItem,
  type RenderFrame,
} from "../packages/core/src/index.ts"

const count = positiveInteger(process.argv[2] ?? "10000", "input count")
const sampleCount = positiveInteger(process.argv[3] ?? "100", "sample count")
const document = createDocument()
const root = document.createElement("main")
root.setAttribute("style", "display:flex; flex-direction:column; width:300px")
document.appendChild(root)
const inputs = Array.from({length: count}, (_, index) => {
  const input = document.createElement("input")
  input.type = "text"
  input.value = `Value ${index}`
  root.appendChild(input)
  return input
})
const target = inputs[Math.floor(count / 2)]!
const unchanged = inputs[0]!
const renderer = createDocumentRenderer({
  document,
  root,
  viewport: {width: 300, height: 600},
})

const initialStartedAt = performance.now()
let frame = renderer.flush()
const initialMs = performance.now() - initialStartedAt
const initialBoxes = frame.boxes
const initialBoxMap = frame.boxByNode
const initialHits = frame.hits
const unchangedBox = required(frame.boxByNode.get(unchanged))
const unchangedItem = inputValueItem(frame, unchanged)
const samples: number[] = []
let identityPreserved = true

for (let index = 0; index < sampleCount; index += 1) {
  target.value = `Updated ${index}`
  const startedAt = performance.now()
  const next = renderer.flush()
  samples.push(performance.now() - startedAt)
  identityPreserved &&= next.boxes === initialBoxes &&
    next.boxByNode === initialBoxMap &&
    next.hits === initialHits &&
    next.boxByNode.get(unchanged) === unchangedBox &&
    inputValueItem(next, unchanged) === unchangedItem
  frame = next
}

const sorted = [...samples].sort((left, right) => left - right)
const result = Object.freeze({
  benchmark: "renderer-input-value-patch",
  count,
  sampleCount,
  initialMs: round(initialMs),
  timingMs: Object.freeze({
    p50: round(percentile(sorted, .5)),
    p95: round(percentile(sorted, .95)),
    p99: round(percentile(sorted, .99)),
    max: round(sorted.at(-1) ?? 0),
  }),
  identityPreserved,
  targetText: inputValueItem(frame, target).text,
  pass: identityPreserved && percentile(sorted, .99) <= 1_000 / 60,
})

console.log(JSON.stringify(result, null, 2))
renderer.dispose()
if (!result.pass) process.exitCode = 1

function inputValueItem(frame: RenderFrame, input: typeof target) {
  const item = frame.displayList.find(
    (candidate): candidate is Extract<DisplayItem, {kind: "text"}> =>
      candidate.kind === "text" && candidate.node === input && candidate.key === "value",
  )
  if (item === undefined) throw new Error("Input value display item is missing")
  return item
}

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
