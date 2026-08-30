import {describe, expect, test} from "bun:test"
import {resolveStyleValue} from "../src/style.ts"

describe("compiled CSS string transport", () => {
  test("flattens generated nested fragments in exact order", () => {
    const resolved = resolveStyleValue([
      "display: flex; width: 20px;",
      false,
      [null, "color: white", undefined],
      "opacity: .5;;"
    ])

    expect(resolved).toEqual({
      cssText: "display: flex; width: 20px; color: white; opacity: .5",
      signature: "display: flex; width: 20px; color: white; opacity: .5"
    })
    expect(Object.isFrozen(resolved)).toBeTrue()
  })

  test("normalizes empty transport to no inline style", () => {
    expect(resolveStyleValue([" ; ", false, null, undefined])).toEqual({
      cssText: null,
      signature: ""
    })
  })

  test("rejects every removed runtime authoring shape", () => {
    for (const value of [
      {display: "flex"},
      {":hover": {color: "red"}},
      1,
      true,
      Symbol("style")
    ]) {
      expect(() => resolveStyleValue(value as never)).toThrow("accepts CSS strings")
    }
  })
})
