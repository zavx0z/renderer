import {describe, expect, test} from "bun:test"
import {
  createDocument,
  type HTMLImageElement,
} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type ImageDisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("image replaced-element projection", () => {
  test("uses reflected dimensions without inventing intrinsic image metrics", () => {
    const document = createDocument()
    const image = document.createElement("img")
    document.appendChild(image)
    image.src = "/assets/preview.png"
    image.width = 80
    image.height = 40
    const renderer = createDocumentRenderer({
      document,
      root: image,
      viewport: {width: 320, height: 180},
    })

    const first = renderer.flush()
    expect(first.boxByNode.get(image)).toMatchObject({
      node: image,
      width: 80,
      height: 40,
      contentWidth: 80,
      contentHeight: 40,
    })
    expect(imagePaint(first, image)).toEqual({
      kind: "image",
      key: "image",
      node: image,
      src: "/assets/preview.png",
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fit: "cover",
      opacity: 1,
      clips: [],
      transform: {scaleX: 1, scaleY: 1, translateX: 0, translateY: 0},
    })
    expect(renderer.flush()).toBe(first)

    image.src = "/assets/updated.png"
    image.width = 100
    const second = renderer.flush()
    const updated = imagePaint(second, image)
    expect(second).not.toBe(first)
    expect(updated.node).toBe(image)
    expect(updated.key).toBe("image")
    expect(updated.src).toBe("/assets/updated.png")
    expect(updated.width).toBe(100)
    expect(updated.height).toBe(40)
    renderer.dispose()
  })

  test("lets author CSS own the box and resolves bounded object-fit before paint", () => {
    const document = createDocument()
    const image = document.createElement("img")
    document.appendChild(image)
    image.src = "data:image/png;base64,AA=="
    image.width = 320
    image.height = 180
    image.setAttribute(
      "style",
      "width: 120px; height: 60px; padding: 4px; border: 2px solid #000",
    )
    const ignoredChild = document.createElement("span")
    ignoredChild.textContent = "fallback child"
    image.appendChild(ignoredChild)
    const renderer = createDocumentRenderer({
      document,
      root: image,
      viewport: {width: 320, height: 180},
      styleSheets: [
        "img { object-fit: contain; }",
        "img { object-fit: fill; }",
      ],
    })

    const frame = renderer.flush()
    expect(frame.boxByNode.get(image)).toMatchObject({
      width: 132,
      height: 72,
      contentX: 6,
      contentY: 6,
      contentWidth: 120,
      contentHeight: 60,
    })
    expect(imagePaint(frame, image)).toMatchObject({
      x: 6,
      y: 6,
      width: 120,
      height: 60,
      fit: "contain",
    })
    expect(frame.boxByNode.has(ignoredChild)).toBeFalse()
    expect(frame.displayList.some(({node}) => node === ignoredChild)).toBeFalse()
    expect(frame.hits.has(ignoredChild)).toBeFalse()
    renderer.dispose()
  })

  test("keeps inherited clips and effective opacity on the image content item", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const image = document.createElement("img")
    document.appendChild(root)
    root.appendChild(image)
    root.setAttribute(
      "style",
      "width: 100px; height: 50px; overflow: hidden; opacity: 0.5",
    )
    image.src = "/assets/wide.png"
    image.setAttribute("style", "width: 120px; height: 60px; opacity: 0.4")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 160, height: 90},
    })

    const paint = imagePaint(renderer.flush(), image)
    expect(paint.opacity).toBeCloseTo(0.2)
    expect(paint.clips).toEqual([{
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      clipX: true,
      clipY: true,
      transform: {scaleX: 1, scaleY: 1, translateX: 0, translateY: 0},
      radii: {
        topLeft: {x: 0, y: 0},
        topRight: {x: 0, y: 0},
        bottomRight: {x: 0, y: 0},
        bottomLeft: {x: 0, y: 0},
      },
    }])
    renderer.dispose()
  })

  test("keeps an empty source as an untextured box without fabricating alt paint", () => {
    const document = createDocument()
    const image = document.createElement("img")
    document.appendChild(image)
    image.width = 96
    image.height = 48
    image.alt = "Preview unavailable"
    const renderer = createDocumentRenderer({
      document,
      root: image,
      viewport: {width: 160, height: 90},
    })

    const frame = renderer.flush()
    expect(frame.boxByNode.get(image)).toMatchObject({width: 96, height: 48})
    expect(frame.hits.get(image)?.node).toBe(image)
    expect(frame.displayList.some(({node}) => node === image)).toBeFalse()
    expect(frame.displayList.some((item) => item.kind === "text")).toBeFalse()
    renderer.dispose()
  })
})

function imagePaint(frame: RenderFrame, image: HTMLImageElement): ImageDisplayItem {
  const item = frame.displayList.find((candidate): candidate is ImageDisplayItem =>
    candidate.kind === "image" && candidate.node === image && candidate.key === "image"
  )
  if (!item) throw new Error("Expected Image display item")
  return item
}
