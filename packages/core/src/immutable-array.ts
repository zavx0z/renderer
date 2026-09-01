const CHUNK_SIZE = 256

type PropertyKeyValue = string | symbol

class ChunkedArrayData<Value> {
  readonly #chunks: readonly (readonly Value[])[]
  readonly length: number

  constructor(chunks: readonly (readonly Value[])[], length: number) {
    this.#chunks = chunks
    this.length = length
    Object.freeze(this)
  }

  static from<Value>(values: readonly Value[]): ChunkedArrayData<Value> {
    const chunks: Value[][] = []
    for (let start = 0; start < values.length; start += CHUNK_SIZE) {
      chunks.push(Array.prototype.slice.call(values, start, start + CHUNK_SIZE))
    }
    return new ChunkedArrayData(chunks, values.length)
  }

  get(index: number): Value | undefined {
    if (index < 0 || index >= this.length) return undefined
    return this.#chunks[Math.floor(index / CHUNK_SIZE)]?.[index % CHUNK_SIZE]
  }

  with(index: number, value: Value): ChunkedArrayData<Value> {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.length) {
      throw new RangeError("Immutable array replacement index is out of bounds")
    }
    const chunkIndex = Math.floor(index / CHUNK_SIZE)
    const nextChunk = [...this.#chunks[chunkIndex]!]
    nextChunk[index % CHUNK_SIZE] = value
    const nextChunks = [...this.#chunks]
    nextChunks[chunkIndex] = nextChunk
    return new ChunkedArrayData(nextChunks, this.length)
  }

  withMany(entries: readonly Readonly<{index: number; value: Value}>[]): ChunkedArrayData<Value> {
    if (entries.length === 0) return this
    const nextChunks = [...this.#chunks]
    const mutableChunks = new Map<number, Value[]>()
    for (const {index, value} of entries) {
      if (!Number.isSafeInteger(index) || index < 0 || index >= this.length) {
        throw new RangeError("Immutable array replacement index is out of bounds")
      }
      const chunkIndex = Math.floor(index / CHUNK_SIZE)
      let chunk = mutableChunks.get(chunkIndex)
      if (chunk === undefined) {
        chunk = [...this.#chunks[chunkIndex]!]
        mutableChunks.set(chunkIndex, chunk)
        nextChunks[chunkIndex] = chunk
      }
      chunk[index % CHUNK_SIZE] = value
    }
    return new ChunkedArrayData(nextChunks, this.length)
  }

  move(fromIndex: number, toIndex: number, replacement: Value): ChunkedArrayData<Value> {
    if (
      !Number.isSafeInteger(fromIndex) ||
      !Number.isSafeInteger(toIndex) ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= this.length ||
      toIndex >= this.length
    ) throw new RangeError("Immutable array move index is out of bounds")
    if (fromIndex === toIndex) return this.with(fromIndex, replacement)
    const nextChunks = [...this.#chunks]
    const mutableChunks = new Map<number, Value[]>()
    const write = (index: number, value: Value): void => {
      const chunkIndex = Math.floor(index / CHUNK_SIZE)
      let chunk = mutableChunks.get(chunkIndex)
      if (chunk === undefined) {
        chunk = [...this.#chunks[chunkIndex]!]
        mutableChunks.set(chunkIndex, chunk)
        nextChunks[chunkIndex] = chunk
      }
      chunk[index % CHUNK_SIZE] = value
    }
    if (fromIndex < toIndex) {
      for (let index = fromIndex; index < toIndex; index += 1) {
        write(index, this.get(index + 1)!)
      }
    } else {
      for (let index = fromIndex; index > toIndex; index -= 1) {
        write(index, this.get(index - 1)!)
      }
    }
    write(toIndex, replacement)
    return new ChunkedArrayData(nextChunks, this.length)
  }

  append(values: readonly Value[]): ChunkedArrayData<Value> {
    if (values.length === 0) return this
    const nextChunks = [...this.#chunks]
    let offset = 0
    const tailLength = this.length % CHUNK_SIZE
    if (tailLength !== 0) {
      const tailIndex = nextChunks.length - 1
      const tail = [...nextChunks[tailIndex]!]
      const available = CHUNK_SIZE - tail.length
      const count = Math.min(available, values.length)
      for (; offset < count; offset += 1) tail.push(values[offset]!)
      nextChunks[tailIndex] = tail
    }
    while (offset < values.length) {
      const chunk = Array.prototype.slice.call(
        values,
        offset,
        offset + CHUNK_SIZE,
      ) as Value[]
      nextChunks.push(chunk)
      offset += chunk.length
    }
    return new ChunkedArrayData(nextChunks, this.length + values.length)
  }

  chunks(): readonly (readonly Value[])[] {
    return this.#chunks
  }
}

const dataByArray = new WeakMap<readonly unknown[], ChunkedArrayData<unknown>>()

export const immutableArray = <Value>(values: readonly Value[]): readonly Value[] => {
  const current = dataByArray.get(values) as ChunkedArrayData<Value> | undefined
  if (current) return values
  return proxyFor(ChunkedArrayData.from(values))
}

export const replaceImmutableArray = <Value>(
  values: readonly Value[],
  index: number,
  value: Value,
): readonly Value[] => proxyFor(dataFor(values).with(index, value))

export const replaceImmutableArrayEntries = <Value>(
  values: readonly Value[],
  entries: readonly Readonly<{index: number; value: Value}>[],
): readonly Value[] => entries.length === 0
  ? values
  : proxyFor(dataFor(values).withMany(entries))

export const moveImmutableArrayEntry = <Value>(
  values: readonly Value[],
  fromIndex: number,
  toIndex: number,
  replacement: Value,
): readonly Value[] => proxyFor(dataFor(values).move(fromIndex, toIndex, replacement))

export const appendImmutableArray = <Value>(
  values: readonly Value[],
  appended: readonly Value[],
): readonly Value[] => proxyFor(dataFor(values).append(appended))

export const sharedImmutableArrayChunks = (
  left: readonly unknown[],
  right: readonly unknown[],
): number => {
  const leftChunks = dataFor(left).chunks()
  const rightChunks = dataFor(right).chunks()
  const count = Math.min(leftChunks.length, rightChunks.length)
  let shared = 0
  for (let index = 0; index < count; index += 1) {
    if (leftChunks[index] === rightChunks[index]) shared += 1
  }
  return shared
}

const dataFor = <Value>(values: readonly Value[]): ChunkedArrayData<Value> => {
  const data = dataByArray.get(values) as ChunkedArrayData<Value> | undefined
  return data ?? ChunkedArrayData.from(values)
}

const proxyFor = <Value>(data: ChunkedArrayData<Value>): readonly Value[] => {
  const target = new Array<Value>(data.length)
  const proxy = new Proxy(target, {
    get(array, property, receiver) {
      const index = arrayIndex(property)
      return index === null ? Reflect.get(array, property, receiver) : data.get(index)
    },
    has(array, property) {
      const index = arrayIndex(property)
      return index === null
        ? Reflect.has(array, property)
        : index >= 0 && index < data.length
    },
    ownKeys() {
      return [
        ...Array.from({length: data.length}, (_, index) => String(index)),
        "length",
      ]
    },
    getOwnPropertyDescriptor(array, property) {
      const index = arrayIndex(property)
      if (index === null) return Reflect.getOwnPropertyDescriptor(array, property)
      if (index < 0 || index >= data.length) return undefined
      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: data.get(index),
      }
    },
    set() {
      throw readonlyArrayError()
    },
    deleteProperty() {
      throw readonlyArrayError()
    },
    defineProperty() {
      throw readonlyArrayError()
    },
    setPrototypeOf() {
      throw readonlyArrayError()
    },
    preventExtensions() {
      throw readonlyArrayError()
    },
  })
  dataByArray.set(proxy, data as ChunkedArrayData<unknown>)
  return proxy
}

const arrayIndex = (property: PropertyKeyValue): number | null => {
  if (typeof property !== "string" || !/^(?:0|[1-9]\d*)$/.test(property)) {
    return null
  }
  const index = Number(property)
  return Number.isSafeInteger(index) ? index : null
}

const readonlyArrayError = (): TypeError => new TypeError("Render frame arrays are immutable")
