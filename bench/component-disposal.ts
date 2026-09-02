import {createDocument} from "@zavx0z/dom"
import {
  component,
  createRoot,
  keyedComponents,
  useEffect,
} from "../packages/react/src/index.ts"
import {
  bindKeyed,
  bindProperty,
  bindText,
  defineCompiledTemplate,
  writeBinding,
} from "@zavx0z/template/compiled"

const nodeCount = positiveInteger(process.argv[2] ?? "10000", "node count")
const fieldsPerNode = positiveInteger(process.argv[3] ?? "4", "fields per node")
let disposedFields = 0
let disposedNodes = 0
let disposedScenes = 0

const Field = defineCompiledTemplate<{id: string}>({
  bindingCount: 2,
  displayName: "DisposalBenchmarkField",
  mount(document) {
    const field = document.createElement("span")
    const text = document.createTextNode("")
    field.appendChild(text)
    return {
      bindings: [bindProperty(field, "data-field-id"), bindText(text)],
      nodes: [field],
    }
  },
  render(props, values) {
    useEffect(() => () => { disposedFields += 1 }, [])
    writeBinding(values, 0, props.id)
    writeBinding(values, 1, props.id)
  },
})

const Node = defineCompiledTemplate<{fieldCount: number; id: number}>({
  bindingCount: 3,
  displayName: "DisposalBenchmarkNode",
  mount(document) {
    const node = document.createElement("article")
    const label = document.createTextNode("")
    const start = document.createComment("fields")
    const end = document.createComment("/fields")
    node.append(label, start, end)
    return {
      bindings: [bindProperty(node, "data-node-id"), bindText(label), bindKeyed(start, end)],
      nodes: [node],
    }
  },
  render(props, values) {
    useEffect(() => () => { disposedNodes += 1 }, [])
    writeBinding(values, 0, `node-${props.id}`)
    writeBinding(values, 1, `Node ${props.id}`)
    writeBinding(values, 2, keyedComponents(Array.from({length: props.fieldCount}, (_, index) =>
      component(Field, {id: `${props.id}:${index}`}, index),
    )))
  },
})

const Scene = defineCompiledTemplate<{fieldCount: number; nodeCount: number}>({
  bindingCount: 1,
  displayName: "DisposalBenchmarkScene",
  mount(document) {
    const scene = document.createElement("section")
    const start = document.createComment("nodes")
    const end = document.createComment("/nodes")
    scene.append(start, end)
    return {bindings: [bindKeyed(start, end)], nodes: [scene]}
  },
  render(props, values) {
    useEffect(() => () => { disposedScenes += 1 }, [])
    writeBinding(values, 0, keyedComponents(Array.from({length: props.nodeCount}, (_, index) =>
      component(Node, {fieldCount: props.fieldCount, id: index}, index),
    )))
  },
})

const document = createDocument()
const host = document.createElement("main")
document.appendChild(host)
const root = createRoot(host)

Bun.gc(true)
const heapBefore = process.memoryUsage().heapUsed
const mountStartedAt = performance.now()
root.render(Scene, {fieldCount: fieldsPerNode, nodeCount})
const mountMs = performance.now() - mountStartedAt
Bun.gc(true)
const heapAfterMount = process.memoryUsage().heapUsed
const mountedElements = host.querySelectorAll("*").length

const unmountStartedAt = performance.now()
root.unmount()
const unmountMs = performance.now() - unmountStartedAt
Bun.gc(true)
const heapAfterUnmount = process.memoryUsage().heapUsed
const expectedFields = nodeCount * fieldsPerNode

const correctness = Object.freeze({
  emptyHost: host.childNodes.length === 0,
  fieldCleanup: disposedFields === expectedFields,
  nodeCleanup: disposedNodes === nodeCount,
  sceneCleanup: disposedScenes === 1,
})

console.log(JSON.stringify({
  benchmark: "compiled-component-disposal",
  nodeCount,
  fieldsPerNode,
  componentCount: 1 + nodeCount + expectedFields,
  mountedElements,
  mountMs: round(mountMs),
  unmountMs: round(unmountMs),
  unmountPerComponentUs: round(unmountMs * 1_000 / (1 + nodeCount + expectedFields)),
  retainedHeapBytes: Math.max(0, heapAfterMount - heapBefore),
  retainedHeapBytesPerComponent: round(
    Math.max(0, heapAfterMount - heapBefore) / (1 + nodeCount + expectedFields),
  ),
  postUnmountHeapDeltaBytes: heapAfterUnmount - heapBefore,
  disposed: Object.freeze({fields: disposedFields, nodes: disposedNodes, scenes: disposedScenes}),
  correctness,
  pass: Object.values(correctness).every(Boolean),
}, null, 2))

if (!Object.values(correctness).every(Boolean)) process.exitCode = 1

function positiveInteger(source: string, label: string): number {
  const value = Number.parseInt(source, 10)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return value
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000
}
