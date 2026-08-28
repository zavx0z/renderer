import {createDocument} from "@zavx0z/dom"
import {
  component,
  createRoot,
  keyedComponents,
  memo,
  useState
} from "../packages/react/src/index.ts"
import {
  bindKeyed,
  bindProperty,
  bindText,
  defineCompiledTemplate,
  writeBinding
} from "@zavx0z/template/compiled"

const count = positiveInteger(process.argv[2] ?? "10000", "count")
const operation = operationMode(process.argv[3] ?? "once")
const sampleCount = positiveInteger(process.argv[4] ?? "30", "sample count")
const warmupCount = nonNegativeInteger(process.argv[5] ?? "5", "warmup count")
const document = createDocument()
const container = document.createElement("div")
document.appendChild(container)

const ItemSource = defineCompiledTemplate<{id: number}>({
  bindingCount: 2,
  displayName: "KeyedBenchmarkItem",
  mount(ownerDocument) {
    const item = ownerDocument.createElement("li")
    const text = ownerDocument.createTextNode("")
    item.appendChild(text)
    return {
      bindings: [bindProperty(item, "id"), bindText(text)],
      nodes: [item]
    }
  },
  render(props, values) {
    const [local] = useState(props.id)
    writeBinding(values, 0, `item-${props.id}`)
    writeBinding(values, 1, `${props.id}:${local}`)
  }
})
const Item = memo(ItemSource)

const List = defineCompiledTemplate<{ids: readonly number[]}>({
  bindingCount: 1,
  displayName: "KeyedBenchmarkList",
  mount(ownerDocument) {
    const list = ownerDocument.createElement("ul")
    const start = ownerDocument.createComment("items")
    const end = ownerDocument.createComment("/items")
    list.append(start, end)
    return {bindings: [bindKeyed(start, end)], nodes: [list]}
  },
  render(props, values) {
    writeBinding(values, 0, keyedComponents(props.ids.map(id =>
      component(Item, {id}, id)
    )))
  }
})

const root = createRoot(container)
const initialIds = Array.from({length: count}, (_, index) => index)
if (operation === "once") runOnce()
else if (operation === "reorder") runReorderSampled()
else runSampled(operation)

function runOnce(): void {
  Bun.gc(true)
  const mountHeapBefore = process.memoryUsage().heapUsed
  const mountStartedAt = performance.now()
  root.render(List, {ids: initialIds})
  const mountMs = performance.now() - mountStartedAt
  Bun.gc(true)
  const mountHeapAfter = process.memoryUsage().heapUsed
  const initialStats = root.stats()
  const identities = new Map(
    [...container.querySelectorAll("li")].map(element => [Number(element.id.slice(5)), element])
  )

  const rotated = [...initialIds.slice(1), initialIds[0]!]
  const beforeRotate = root.stats()
  Bun.gc(true)
  const updateHeapBefore = process.memoryUsage().heapUsed
  const rotateStartedAt = performance.now()
  root.render(List, {ids: rotated})
  const rotateMs = performance.now() - rotateStartedAt
  const afterRotate = root.stats()
  const rotateIdentities = preservedIdentityCount(container, identities)

  const insertedKey = count
  const insertionIndex = Math.floor(count / 2)
  const withInsert = [
    ...rotated.slice(0, insertionIndex),
    insertedKey,
    ...rotated.slice(insertionIndex)
  ]
  const beforeInsert = root.stats()
  const insertStartedAt = performance.now()
  root.render(List, {ids: withInsert})
  const insertMs = performance.now() - insertStartedAt
  const afterInsert = root.stats()
  const insertIdentities = preservedIdentityCount(container, identities)

  const deletedKey = rotated[Math.floor(count / 3)]!
  const afterDeleteIds = withInsert.filter(id => id !== deletedKey)
  const beforeDelete = root.stats()
  const deleteStartedAt = performance.now()
  root.render(List, {ids: afterDeleteIds})
  const deleteMs = performance.now() - deleteStartedAt
  const afterDelete = root.stats()
  Bun.gc(true)
  const updateHeapAfter = process.memoryUsage().heapUsed
  const deleteIdentities = preservedIdentityCount(container, identities, deletedKey)

  console.log(JSON.stringify({
    benchmark: "keyed-compiled-components",
    count,
    mount: {
      ms: mountMs,
      mounts: initialStats.mounts,
      retainedHeapBytes: Math.max(0, mountHeapAfter - mountHeapBefore),
      retainedHeapBytesPerItem: Math.max(0, mountHeapAfter - mountHeapBefore) / count
    },
    rotate: {
      ms: rotateMs,
      mounts: afterRotate.mounts - beforeRotate.mounts,
      disposes: afterRotate.disposes - beforeRotate.disposes,
      moves: afterRotate.moves - beforeRotate.moves,
      identitiesPreserved: rotateIdentities,
      expectedIdentities: count
    },
    insert: {
      key: insertedKey,
      ms: insertMs,
      mounts: afterInsert.mounts - beforeInsert.mounts,
      disposes: afterInsert.disposes - beforeInsert.disposes,
      moves: afterInsert.moves - beforeInsert.moves,
      identitiesPreserved: insertIdentities,
      expectedExistingIdentities: count
    },
    delete: {
      key: deletedKey,
      ms: deleteMs,
      mounts: afterDelete.mounts - beforeDelete.mounts,
      disposes: afterDelete.disposes - beforeDelete.disposes,
      moves: afterDelete.moves - beforeDelete.moves,
      identitiesPreserved: deleteIdentities,
      expectedExistingIdentities: count - 1
    },
    updateRetainedHeapDeltaBytes: updateHeapAfter - updateHeapBefore,
    allocationBoundary: "component values, keyed entry arrays, WIP hook clones, and prepared plans allocate per parent update"
  }))
}

function runSampled(mode: Exclude<OperationMode, "once" | "reorder">): void {
  Bun.gc(true)
  const mountHeapBefore = process.memoryUsage().heapUsed
  const mountStartedAt = performance.now()
  root.render(List, {ids: initialIds})
  const mountMs = performance.now() - mountStartedAt
  Bun.gc(true)
  const mountHeapAfter = process.memoryUsage().heapUsed
  const identities = new Map(
    [...container.querySelectorAll("li")].map(element => [Number(element.id.slice(5)), element])
  )
  const insertedKey = count
  const insertionIndex = Math.floor(count / 2)
  const withInsert = [
    ...initialIds.slice(0, insertionIndex),
    insertedKey,
    ...initialIds.slice(insertionIndex)
  ]
  const durations: number[] = []
  const deltas = {disposes: 0, mounts: 0, moves: 0, renders: 0}
  let expectedOrder: readonly number[] = initialIds
  let sampleHeapBefore = 0

  if (mode === "rotate") {
    let current = initialIds
    for (let iteration = 0; iteration < warmupCount; iteration += 1) {
      const next = rotateLeft(current)
      root.render(List, {ids: next})
      current = next
    }
    Bun.gc(true)
    sampleHeapBefore = process.memoryUsage().heapUsed
    for (let iteration = 0; iteration < sampleCount; iteration += 1) {
      const next = rotateLeft(current)
      durations.push(timedRender(next, deltas))
      current = next
    }
    expectedOrder = current
  } else if (mode === "insert") {
    for (let iteration = 0; iteration < warmupCount; iteration += 1) {
      root.render(List, {ids: withInsert})
      root.render(List, {ids: initialIds})
    }
    Bun.gc(true)
    sampleHeapBefore = process.memoryUsage().heapUsed
    for (let iteration = 0; iteration < sampleCount; iteration += 1) {
      durations.push(timedRender(withInsert, deltas))
      root.render(List, {ids: initialIds})
    }
  } else {
    for (let iteration = 0; iteration < warmupCount; iteration += 1) {
      root.render(List, {ids: withInsert})
      root.render(List, {ids: initialIds})
    }
    Bun.gc(true)
    sampleHeapBefore = process.memoryUsage().heapUsed
    for (let iteration = 0; iteration < sampleCount; iteration += 1) {
      root.render(List, {ids: withInsert})
      durations.push(timedRender(initialIds, deltas))
    }
  }

  assertSampledCounters(mode, deltas)
  assertOrder(expectedOrder)
  const identitiesPreserved = preservedIdentityCount(container, identities)
  if (identitiesPreserved !== count) {
    throw new Error(`${mode} preserved ${identitiesPreserved}/${count} original identities`)
  }

  Bun.gc(true)
  const retainedHeapAfter = process.memoryUsage().heapUsed
  const sorted = [...durations].sort((left, right) => left - right)
  console.log(JSON.stringify({
    benchmark: "keyed-compiled-components",
    count,
    operation: mode,
    process: "one operation mode per invocation",
    warmups: warmupCount,
    samples: sampleCount,
    timingMs: {
      max: sorted.at(-1)!,
      mean: durations.reduce((sum, value) => sum + value, 0) / durations.length,
      min: sorted[0]!,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95)
    },
    counters: deltas,
    expectedCounters: expectedSampledCounters(mode),
    identitiesPreserved,
    expectedIdentities: count,
    mount: {
      ms: mountMs,
      retainedHeapBytes: Math.max(0, mountHeapAfter - mountHeapBefore),
      retainedHeapBytesPerItem: Math.max(0, mountHeapAfter - mountHeapBefore) / count
    },
    retainedHeapDeltaAcrossSamplesBytes: retainedHeapAfter - sampleHeapBefore,
    allocationBoundary: "component values and keyed entry arrays remain caller-owned; key maps, alternating order arrays, numeric placement plans and duplicate validation state are reused"
  }))
}

function runReorderSampled(): void {
  Bun.gc(true)
  const mountHeapBefore = process.memoryUsage().heapUsed
  const mountStartedAt = performance.now()
  root.render(List, {ids: initialIds})
  const mountMs = performance.now() - mountStartedAt
  Bun.gc(true)
  const mountHeapAfter = process.memoryUsage().heapUsed
  const identities = new Map(
    [...container.querySelectorAll("li")].map(element => [Number(element.id.slice(5)), element])
  )
  const reordered = deterministicPermutation(initialIds, 0x6d2b79f5)
  let current: readonly number[] = initialIds
  for (let iteration = 0; iteration < warmupCount; iteration += 1) {
    const next = current === initialIds ? reordered : initialIds
    root.render(List, {ids: next})
    current = next
  }

  Bun.gc(true)
  const sampleHeapBefore = process.memoryUsage().heapUsed
  const durations: number[] = []
  const deltas = {disposes: 0, mounts: 0, moves: 0, renders: 0}
  let expectedMoves = 0
  for (let iteration = 0; iteration < sampleCount; iteration += 1) {
    const next = current === initialIds ? reordered : initialIds
    expectedMoves += minimumKeyedMoves(current, next)
    durations.push(timedRender(next, deltas))
    current = next
  }

  if (deltas.disposes !== 0 || deltas.mounts !== 0 ||
    deltas.moves !== expectedMoves || deltas.renders !== sampleCount) {
    throw new Error(
      `reorder counters were ${JSON.stringify(deltas)}, expected ` +
      JSON.stringify({disposes: 0, mounts: 0, moves: expectedMoves, renders: sampleCount})
    )
  }
  assertOrder(current)
  const identitiesPreserved = preservedIdentityCount(container, identities)
  if (identitiesPreserved !== count) {
    throw new Error(`reorder preserved ${identitiesPreserved}/${count} original identities`)
  }

  Bun.gc(true)
  const retainedHeapAfter = process.memoryUsage().heapUsed
  const sorted = [...durations].sort((left, right) => left - right)
  console.log(JSON.stringify({
    benchmark: "keyed-compiled-components",
    count,
    operation: "reorder",
    process: "one operation mode per invocation",
    warmups: warmupCount,
    samples: sampleCount,
    timingMs: {
      max: sorted.at(-1)!,
      mean: durations.reduce((sum, value) => sum + value, 0) / durations.length,
      min: sorted[0]!,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95)
    },
    counters: deltas,
    expectedCounters: {disposes: 0, mounts: 0, moves: expectedMoves, renders: sampleCount},
    identitiesPreserved,
    expectedIdentities: count,
    mount: {
      ms: mountMs,
      retainedHeapBytes: Math.max(0, mountHeapAfter - mountHeapBefore),
      retainedHeapBytesPerItem: Math.max(0, mountHeapAfter - mountHeapBefore) / count
    },
    retainedHeapDeltaAcrossSamplesBytes: retainedHeapAfter - sampleHeapBefore,
    allocationBoundary: "LIS typed scratch and keyed order buffers are retained per binding; component values and entry arrays remain caller-owned"
  }))
}

function timedRender(ids: readonly number[], deltas: MutableStats): number {
  const before = root.stats()
  const startedAt = performance.now()
  root.render(List, {ids})
  const duration = performance.now() - startedAt
  const after = root.stats()
  deltas.disposes += after.disposes - before.disposes
  deltas.mounts += after.mounts - before.mounts
  deltas.moves += after.moves - before.moves
  deltas.renders += after.renders - before.renders
  return duration
}

function assertSampledCounters(
  mode: Exclude<OperationMode, "once" | "reorder">,
  actual: MutableStats
): void {
  const expected = expectedSampledCounters(mode)
  if (
    actual.disposes !== expected.disposes ||
    actual.mounts !== expected.mounts ||
    actual.moves !== expected.moves ||
    actual.renders !== expected.renders
  ) {
    throw new Error(
      `${mode} counters were ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
    )
  }
}

function expectedSampledCounters(
  mode: Exclude<OperationMode, "once" | "reorder">
): MutableStats {
  return {
    disposes: mode === "delete" ? sampleCount : 0,
    mounts: mode === "insert" ? sampleCount : 0,
    moves: mode === "rotate" && count > 1 ? sampleCount : 0,
    renders: mode === "insert" ? sampleCount * 2 : sampleCount
  }
}

function assertOrder(expected: readonly number[]): void {
  const elements = container.querySelectorAll("li")
  if (elements.length !== expected.length) {
    throw new Error(`Rendered ${elements.length} keyed items; expected ${expected.length}`)
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (Number(elements[index]!.id.slice(5)) !== expected[index]) {
      throw new Error(`Keyed order differs at index ${index}`)
    }
  }
}

function rotateLeft(ids: readonly number[]): readonly number[] {
  return ids.length < 2 ? ids : [...ids.slice(1), ids[0]!]
}

function deterministicPermutation(values: readonly number[], seed: number): number[] {
  const result = [...values]
  let state = seed >>> 0
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    const target = state % (index + 1)
    const current = result[index]!
    result[index] = result[target]!
    result[target] = current
  }
  return result
}

function minimumKeyedMoves(previous: readonly number[], next: readonly number[]): number {
  const positions = new Map(previous.map((key, index) => [key, index]))
  const tails: number[] = []
  for (const key of next) {
    const value = positions.get(key)
    if (value === undefined) throw new Error(`Missing benchmark key ${key}`)
    let low = 0
    let high = tails.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (tails[middle]! < value) low = middle + 1
      else high = middle
    }
    tails[low] = value
  }
  return next.length - tails.length
}

function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!
}

function preservedIdentityCount(
  rootElement: typeof container,
  expected: ReadonlyMap<number, unknown>,
  excludedKey: number | null = null
): number {
  let preserved = 0
  for (const element of rootElement.querySelectorAll("li")) {
    const key = Number(element.id.slice(5))
    if (key === excludedKey || !expected.has(key)) continue
    if (expected.get(key) === element) preserved += 1
  }
  return preserved
}

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

function operationMode(source: string): OperationMode {
  if (source === "once" || source === "rotate" || source === "insert" ||
    source === "delete" || source === "reorder") {
    return source
  }
  throw new Error("operation must be once, rotate, insert, delete, or reorder")
}

type MutableStats = {
  disposes: number
  mounts: number
  moves: number
  renders: number
}

type OperationMode = "once" | "rotate" | "insert" | "delete" | "reorder"
