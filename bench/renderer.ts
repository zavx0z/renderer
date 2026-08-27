import {createDocument} from "@zavx0z/dom"
import {createDocumentRenderer} from "@zavx0z/renderer"

const count = Number.parseInt(process.argv[2] ?? "10000", 10)
if (!Number.isSafeInteger(count) || count <= 0) throw new Error("count must be a positive integer")
const sampleCount = Number.parseInt(process.argv[3] ?? "100", 10)
if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0) {
  throw new Error("sample count must be a positive integer")
}
const warmupCount = Number.parseInt(process.argv[4] ?? "20", 10)
if (!Number.isSafeInteger(warmupCount) || warmupCount < 0) {
  throw new Error("warmup count must be a non-negative integer")
}

const document = createDocument()
const root = document.createElement("div")
document.appendChild(root)
root.setAttribute("style", "display: flex; flex-direction: column; width: 800px")
const labels = Array.from({length: count}, (_, index) => {
  const label = document.createElement("span")
  label.setAttribute("style", "display: block; height: 16px")
  label.textContent = `Row ${index}`
  root.appendChild(label)
  return label
})
const renderer = createDocumentRenderer({
  document,
  root,
  viewport: {width: 800, height: Math.max(600, count * 16)},
})

const initialStartedAt = performance.now()
const initial = renderer.flush()
const initialMs = performance.now() - initialStartedAt
const cleanStartedAt = performance.now()
const clean = renderer.flush()
const cleanMs = performance.now() - cleanStartedAt
const leaf = labels[Math.floor(labels.length / 2)]!
const leafText = leaf.firstChild
if (leafText === null) throw new Error("benchmark label has no Text")

let updateSequence = 0
const update = (): number => {
  const startedAt = performance.now()
  leafText.nodeValue = updateSequence++ % 2 === 0 ? "Changed A" : "Changed B"
  renderer.flush()
  return performance.now() - startedAt
}
const coldLeafUpdateMs = update()
for (let index = 0; index < warmupCount; index += 1) update()
const samples = Array.from({length: sampleCount}, update)
const sorted = [...samples].sort((left, right) => left - right)
const percentile = (value: number): number => sorted[
  Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * value) - 1))
]!
const updated = renderer.flush()

console.log(JSON.stringify({
  benchmark: "renderer",
  count,
  initialMs,
  cleanMs,
  coldLeafUpdateMs,
  warmLeafUpdateMs: {
    samples: sampleCount,
    warmups: warmupCount,
    min: sorted[0],
    mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted.at(-1),
  },
  cleanFrameIdentity: clean === initial,
  revision: updated.revision,
  boxes: updated.boxes.length,
  displayItems: updated.displayList.length,
}))
