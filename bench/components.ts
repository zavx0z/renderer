import {createDocument, type Text} from "@zavx0z/dom"
import {
  createRoot,
  useState,
  type ComponentRoot,
  type StateDispatch
} from "../packages/react/src/index.ts"
import {
  bindText,
  defineCompiledTemplate,
  writeBinding
} from "@zavx0z/template/compiled"

const count = positiveInteger(process.argv[2] ?? "10000", "count")
const sampleCount = positiveInteger(process.argv[3] ?? "100", "samples")
const warmupCount = nonNegativeInteger(process.argv[4] ?? "20", "warmups")
const setters: StateDispatch<number>[] = []

const Row = defineCompiledTemplate<{index: number}>({
  bindingCount: 1,
  displayName: "BenchmarkRow",
  mount(document) {
    const span = document.createElement("span")
    const text = document.createTextNode("")
    span.appendChild(text)
    return {bindings: [bindText(text)], nodes: [span]}
  },
  render(props, values) {
    const [value, setValue] = useState(0)
    setters[props.index] = setValue
    writeBinding(values, 0, `${props.index}:${value}`)
  }
})

const document = createDocument()
const host = document.createElement("div")
document.appendChild(host)
const containers = Array.from({length: count}, () => {
  const container = document.createElement("div")
  host.appendChild(container)
  return container
})

Bun.gc(true)
const heapBefore = process.memoryUsage().heapUsed
const mountStartedAt = performance.now()
const roots: ComponentRoot[] = containers.map((container, index) => {
  const root = createRoot(container)
  root.render(Row, {index})
  return root
})
const mountMs = performance.now() - mountStartedAt
Bun.gc(true)
const heapAfter = process.memoryUsage().heapUsed

const leafIndex = Math.floor(count / 2)
const leafContainer = containers[leafIndex]!
const leafText = leafContainer.querySelector("span")?.firstChild as Text | null
if (!leafText) throw new Error("Component benchmark expected a retained leaf Text")

const cleanStartedAt = performance.now()
const cleanWork = roots[0]!.flush()
const cleanFlushMs = performance.now() - cleanStartedAt

let updateSequence = 0
const update = (): number => {
  const startedAt = performance.now()
  setters[leafIndex]!(updateSequence++ % 2)
  return performance.now() - startedAt
}
for (let index = 0; index < warmupCount; index += 1) update()
const samples = Array.from({length: sampleCount}, update)
const sorted = [...samples].sort((left, right) => left - right)
const percentile = (value: number): number => sorted[
  Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * value) - 1))
]!

console.log(JSON.stringify({
  benchmark: "compiled-components",
  count,
  mountMs,
  mountPerComponentUs: mountMs * 1000 / count,
  retainedHeapBytes: Math.max(0, heapAfter - heapBefore),
  retainedHeapBytesPerComponent: Math.max(0, heapAfter - heapBefore) / count,
  cleanFlushMs,
  cleanWork,
  warmLeafUpdateMs: {
    samples: sampleCount,
    warmups: warmupCount,
    min: sorted[0],
    mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted.at(-1)
  },
  leafIdentityPreserved: leafContainer.querySelector("span")?.firstChild === leafText,
  leafText: leafText.data
}))

function positiveInteger(source: string, label: string): number {
  const value = Number.parseInt(source, 10)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return value
}

function nonNegativeInteger(source: string, label: string): number {
  const value = Number.parseInt(source, 10)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
  return value
}
