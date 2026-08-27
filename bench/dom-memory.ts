import {createDocument} from "@zavx0z/dom"

const count = Number.parseInt(process.argv[2] ?? "100000", 10)
const mode = process.argv[3] ?? "dom-empty"
if (!Number.isSafeInteger(count) || count <= 0) throw new Error("count must be a positive integer")

Bun.gc(true)
const before = process.memoryUsage().heapUsed
const startedAt = performance.now()
const retained = mode === "closures" ? closureNodes(count) : domNodes(count, mode === "dom-title")
const elapsedMs = performance.now() - startedAt
Bun.gc(true)
const after = process.memoryUsage().heapUsed

console.log(JSON.stringify({
  benchmark: "dom-memory",
  mode,
  count: retained.length,
  elapsedMs,
  heapBytes: Math.max(0, after - before),
  heapBytesPerNode: Math.max(0, after - before) / retained.length,
}))

function domNodes(length: number, titled: boolean): unknown[] {
  const document = createDocument()
  const nodes = Array.from({length}, (_, index) => {
    const node = document.createElement("div")
    if (titled) node.title = `Node ${index}`
    return node
  })
  return nodes
}

function closureNodes(length: number): unknown[] {
  return Array.from({length}, () => {
    const attributes = new Map<string, string>()
    const children: unknown[] = []
    return {
      attributes,
      children,
      appendChild(child: unknown) {
        children.push(child)
      },
      getAttribute(name: string) {
        return attributes.get(name) ?? null
      },
      setAttribute(name: string, value: string) {
        attributes.set(name, value)
      },
    }
  })
}
