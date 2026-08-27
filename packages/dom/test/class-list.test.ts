import {describe, expect, it} from "bun:test"
import {DOMTokenList, createDocument} from "../src/index.ts"

describe("Element.classList", () => {
  it("is lazy, SameObject and reflects direct class attribute changes", () => {
    const document = createDocument()
    const element = document.createElement("div")
    const storage = () => (element as unknown as {
      attributeValues: Map<string, string> | null
    }).attributeValues

    expect(storage()).toBeNull()
    const classList = element.classList
    expect(classList).toBeInstanceOf(DOMTokenList)
    expect(element.classList).toBe(classList)
    expect(storage()).toBeNull()
    expect(classList.length).toBe(0)

    element.className = "panel  active panel"
    expect(classList.value).toBe("panel  active panel")
    expect([...classList]).toEqual(["panel", "active"])
    expect(classList[0]).toBe("panel")
    expect(classList[1]).toBe("active")
    expect(Object.keys(classList)).toEqual(["0", "1"])

    element.setAttribute("class", "external")
    expect(classList.length).toBe(1)
    expect(classList.item(0)).toBe("external")
    expect(classList.item(-1)).toBeNull()
  })

  it("mutates the reflected ordered token set without duplicate writes", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.append(element)
    let mutationCount = 0
    document.subscribeMutations(batch => {
      mutationCount += batch.records.length
    })
    const classList = element.classList

    classList.add("panel", "active", "panel")
    expect(element.className).toBe("panel active")
    expect(mutationCount).toBe(1)
    classList.add("active")
    expect(mutationCount).toBe(1)

    expect(classList.toggle("active")).toBe(false)
    expect(classList.toggle("active", false)).toBe(false)
    expect(classList.toggle("active", true)).toBe(true)
    expect(classList.contains("active")).toBe(true)
    expect(classList.replace("panel", "surface")).toBe(true)
    expect(classList.replace("missing", "other")).toBe(false)
    classList.remove("active", "missing")
    expect(element.className).toBe("surface")

    classList.value = "raw  duplicate duplicate"
    expect(element.getAttribute("class")).toBe("raw  duplicate duplicate")
    expect([...classList]).toEqual(["raw", "duplicate"])
    expect(String(classList)).toBe("raw  duplicate duplicate")
    expect(() => classList.supports("raw")).toThrow(TypeError)
  })

  it("validates all tokens before changing the attribute", () => {
    const document = createDocument()
    const element = document.createElement("div")
    element.className = "stable"

    for (const [invoke, name] of [
      [() => element.classList.add("next", ""), "SyntaxError"],
      [() => element.classList.remove("two words"), "InvalidCharacterError"],
      [() => element.classList.toggle("\t"), "InvalidCharacterError"],
      [() => element.classList.replace("stable", "bad token"), "InvalidCharacterError"]
    ] as const) {
      try {
        invoke()
        throw new Error("Expected invalid token to fail")
      } catch (error) {
        expect((error as Error).name).toBe(name)
      }
      expect(element.className).toBe("stable")
    }

    expect(() => new DOMTokenList()).toThrow("Illegal constructor")
  })
})
