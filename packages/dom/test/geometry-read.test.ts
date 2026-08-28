import {describe, expect, test} from "bun:test"
import {
  DOMRectReadOnly,
  attachDocumentRenderReadAdapter,
  createDocument
} from "../src/index.ts"

describe("renderer-backed Element geometry reads", () => {
  test("fails closed until one exact Document adapter is attached", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.appendChild(element)

    expect(() => element.getBoundingClientRect()).toThrow("renderer-backed")
    expect(() => attachDocumentRenderReadAdapter(document, {
      getBoundingClientRect: () => new DOMRectReadOnly()
    })).not.toThrow()
    expect(() => attachDocumentRenderReadAdapter(document, {
      getBoundingClientRect: () => new DOMRectReadOnly()
    })).toThrow("already has")
  })

  test("returns immutable standard-named geometry without storing layout on Element", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.appendChild(element)
    const detach = attachDocumentRenderReadAdapter(document, {
      getBoundingClientRect(target) {
        expect(target).toBe(element)
        return new DOMRectReadOnly(10, 20, 30, 40)
      }
    })

    const rect = element.getBoundingClientRect()
    expect(rect).toBeInstanceOf(DOMRectReadOnly)
    expect(rect).toMatchObject({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      top: 20,
      right: 40,
      bottom: 60,
      left: 10
    })
    expect(Object.isFrozen(rect)).toBe(true)
    expect(rect.toJSON()).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      top: 20,
      right: 40,
      bottom: 60,
      left: 10
    })

    detach()
    detach()
    expect(() => element.getBoundingClientRect()).toThrow("renderer-backed")
  })
})
