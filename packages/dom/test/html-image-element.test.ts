import {describe, expect, test} from "bun:test"
import {
  createDocument,
  HTMLElement,
  HTMLImageElement,
  Node,
} from "@zavx0z/dom"
import {HTMLImageElement as ImageSubpath} from "@zavx0z/dom/html/image-element"

describe("HTMLImageElement", () => {
  test("creates the exact standard prototype without eager image state", () => {
    const image = createDocument().createElement("img")
    expect(image).toBeInstanceOf(HTMLImageElement)
    expect(image).toBeInstanceOf(HTMLElement)
    expect(image).toBeInstanceOf(Node)
    expect(image).toBeInstanceOf(ImageSubpath)
    expect(image.localName).toBe("img")
    expect(image.src).toBe("")
    expect(image.alt).toBe("")
    expect(image.width).toBe(0)
    expect(image.height).toBe(0)
  })

  test("reflects src, alt and unsigned dimensions through ordinary attributes", () => {
    const image = createDocument().createElement("img")
    image.src = "/assets/output.svg"
    image.alt = "Output & preview"
    image.width = 320
    image.height = 180
    expect(image.getAttribute("src")).toBe("/assets/output.svg")
    expect(image.getAttribute("alt")).toBe("Output & preview")
    expect(image.getAttribute("width")).toBe("320")
    expect(image.getAttribute("height")).toBe("180")
    expect(image.src).toBe("/assets/output.svg")
    expect(image.alt).toBe("Output & preview")
    expect(image.width).toBe(320)
    expect(image.height).toBe(180)
  })

  test("uses reflected dimension defaults without fabricating intrinsic metrics", () => {
    const image = createDocument().createElement("img")
    for (const value of ["", "-1", "not-a-number", "2147483648"]) {
      image.setAttribute("width", value)
      expect(image.width, value).toBe(0)
    }
    image.setAttribute("height", "  +42px")
    expect(image.height).toBe(42)
    image.width = -1
    expect(image.getAttribute("width")).toBe("4294967295")
    expect(image.width).toBe(0)
    expect("complete" in image).toBeFalse()
    expect("naturalWidth" in image).toBeFalse()
    expect("decode" in image).toBeFalse()
  })
})
