import {describe, expect, test} from "bun:test"
import {
  appendImmutableArray,
  immutableArray,
  replaceImmutableArray,
  sharedImmutableArrayChunks,
} from "../src/immutable-array.ts"

describe("chunked immutable array facade", () => {
  test("preserves ordinary readonly Array semantics", () => {
    const values = Array.from({length: 600}, (_, index) => ({index}))
    const array = immutableArray(values)

    expect(Array.isArray(array)).toBeTrue()
    expect(array.length).toBe(600)
    expect(array[0]).toBe(values[0])
    expect(array.at(-1)).toBe(values[599])
    expect(array.indexOf(values[300]!)).toBe(300)
    expect(array.find(({index}) => index === 412)).toBe(values[412])
    expect(array.slice(255, 258)).toEqual(values.slice(255, 258))
    expect(array.filter(({index}) => index % 200 === 0)).toEqual([
      values[0]!,
      values[200]!,
      values[400]!,
    ])
    expect(array.map(({index}) => index).slice(0, 3)).toEqual([0, 1, 2])
    expect([...array]).toEqual(values)
    expect(300 in array).toBeTrue()
    expect(Object.prototype.hasOwnProperty.call(array, "300")).toBeTrue()
    expect(Object.keys(array)).toHaveLength(600)
  })

  test("shares every untouched chunk and rejects all mutation paths", () => {
    const values = Array.from({length: 1_024}, (_, index) => ({index}))
    const initial = immutableArray(values)
    const replacement = {index: -1}
    const updated = replaceImmutableArray(initial, 513, replacement)

    expect(sharedImmutableArrayChunks(initial, updated)).toBe(3)
    expect(initial[513]).toBe(values[513])
    expect(updated[513]).toBe(replacement)
    expect(updated[512]).toBe(initial[512])
    expect(updated[768]).toBe(initial[768])
    expect(() => Reflect.set(updated, "513", values[513])).toThrow("immutable")
    expect(() => Reflect.deleteProperty(updated, "513")).toThrow("immutable")
    expect(() => Object.defineProperty(updated, "513", {value: values[513]})).toThrow(
      "immutable",
    )
    expect(() => (updated as unknown as {reverse(): unknown}).reverse()).toThrow("immutable")

    const appended = appendImmutableArray(updated, [{index: 1_024}, {index: 1_025}])
    expect(appended.length).toBe(1_026)
    expect(appended.slice(-2).map(({index}) => index)).toEqual([1_024, 1_025])
    expect(sharedImmutableArrayChunks(updated, appended)).toBe(4)
  })
})
