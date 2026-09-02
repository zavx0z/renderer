import {describe, expect, test} from "bun:test"
import {createDocument, type Element} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  hitTest,
  type DisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("bounded transform projection", () => {
  test("parses translate/scale in CSS order while layout dimensions remain unchanged", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("button")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute("style", boxStyle(200, 100, "#111111"))
    child.id = "child"
    child.setAttribute(
      "style",
      `${boxStyle(40, 20, "#ff0000")}; transform-origin:0px 0px`,
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 140},
      styleSheets: [
        "#child { transform:translate(50%, 10px) scale(2, .5); }",
        "#child { transform:rotate(1rad); }",
      ],
    })

    const frame = renderer.flush()
    expect(frame.boxByNode.get(child)).toMatchObject({x: 0, y: 0, width: 40, height: 20})
    expect(background(frame, child).transform).toEqual({
      scaleX: 2,
      scaleY: 0.5,
      translateX: 20,
      translateY: 10,
    })
    expect(frame.hits.get(child)?.transform).toEqual(background(frame, child).transform)
    expect(hitTest(frame, 25, 12)?.node).toBe(child)
    expect(hitTest(frame, 5, 5)?.node).toBe(root)
    expect(renderer.flush()).toBe(frame)
    renderer.dispose()
  })

  test("composes nested transforms and resolves center transform-origin", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("button")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute(
      "style",
      `${boxStyle(200, 100, "#111111")}; transform:translate(10px, 20px) scale(2); transform-origin:0px 0px`,
    )
    child.setAttribute(
      "style",
      `${boxStyle(40, 20, "#ff0000")}; transform:translateX(50%) scaleY(.5); transform-origin:0px 0px`,
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 500, height: 300},
    })

    const frame = renderer.flush()
    expect(background(frame, root).transform).toEqual({
      scaleX: 2,
      scaleY: 2,
      translateX: 10,
      translateY: 20,
    })
    expect(background(frame, child).transform).toEqual({
      scaleX: 2,
      scaleY: 1,
      translateX: 50,
      translateY: 20,
    })

    child.setAttribute(
      "style",
      `${boxStyle(40, 20, "#ff0000")}; transform:scale(2); transform-origin:center center`,
    )
    expect(renderer.flush().hits.get(child)?.transform).toEqual({
      scaleX: 4,
      scaleY: 4,
      translateX: -30,
      translateY: 0,
    })
    renderer.dispose()
  })

  test("uses inverse hit and clip transforms and rejects a collapsed scale", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("button")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute(
      "style",
      `${boxStyle(100, 50, "#111111")}; overflow:hidden; transform:translateX(10px) scaleX(2); transform-origin:0px 0px`,
    )
    child.setAttribute("style", boxStyle(120, 60, "#ff0000"))
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 100},
    })

    const frame = renderer.flush()
    const clip = background(frame, child).clips[0]
    expect(clip).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      transform: {scaleX: 2, scaleY: 1, translateX: 10, translateY: 0},
    })
    expect(hitTest(frame, 15, 25)?.node).toBe(child)
    expect(hitTest(frame, 205, 25)?.node).toBe(child)
    expect(hitTest(frame, 215, 25)).toBeNull()

    child.setAttribute(
      "style",
      `${boxStyle(120, 60, "#ff0000")}; transform:scaleX(0)`,
    )
    expect(hitTest(renderer.flush(), 20, 20)?.node).toBe(root)
    renderer.dispose()
  })

  test("includes descendant transforms in local scroll overflow and scrolls the final chain", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("button")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute(
      "style",
      `${boxStyle(100, 50, "#111111")}; overflow:auto; transform:scale(2); transform-origin:0px 0px`,
    )
    child.setAttribute(
      "style",
      `${boxStyle(80, 40, "#ff0000")}; transform:scaleX(2); transform-origin:0px 0px`,
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 140},
    })

    const first = renderer.flush()
    expect(first.scrolls.get(root)).toMatchObject({
      clientWidth: 100,
      scrollWidth: 160,
      maxScrollLeft: 60,
    })
    root.scrollLeft = 60
    const scrolled = renderer.flush()
    expect(scrolled.boxByNode.get(child)).toMatchObject({x: -60, width: 80})
    expect(background(scrolled, child).transform).toEqual({
      scaleX: 4,
      scaleY: 2,
      translateX: 120,
      translateY: 0,
    })
    expect(hitTest(scrolled, 10, 20)?.node).toBe(child)
    renderer.dispose()
  })

  test("patches a transform-only leaf equivalently while sharing untouched frame records", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const changed = document.createElement("div")
    const stable = document.createElement("div")
    document.appendChild(root)
    root.append(changed, stable)
    root.setAttribute("style", `${boxStyle(200, 40, "#111111")}; display:flex`)
    changed.setAttribute("style", `${boxStyle(50, 40, "#ff0000")}; flex:none`)
    stable.setAttribute("style", `${boxStyle(50, 40, "#0000ff")}; flex:none`)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 80},
    })
    const first = renderer.flush()
    const stableBox = first.boxByNode.get(stable)
    const stablePaint = background(first, stable)

    changed.setAttribute(
      "style",
      `${boxStyle(50, 40, "#ff0000")}; flex:none; transform:translateX(20px) scale(.5); transform-origin:0 0`,
    )
    const patched = renderer.flush()
    expect(patched.boxByNode.get(stable)).toBe(stableBox)
    expect(background(patched, stable)).toBe(stablePaint)
    expect(patched.boxByNode.get(changed)).toMatchObject({x: 0, width: 50, height: 40})

    const forced = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 80},
    })
    const rebuilt = forced.flush()
    expect(patched.boxes).toEqual(rebuilt.boxes)
    expect(patched.displayList).toEqual(rebuilt.displayList)
    expect([...patched.hits]).toEqual([...rebuilt.hits])
    expect(renderer.flush()).toBe(patched)
    forced.dispose()
    renderer.dispose()
  })

  test("excludes hidden branches from retained transform traversal until reveal", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const visible = document.createElement("button")
    const hidden = document.createElement("section")
    const hiddenChild = document.createElement("button")
    document.appendChild(root)
    root.append(visible, hidden)
    hidden.appendChild(hiddenChild)
    root.setAttribute("style", boxStyle(200, 80, "#111111"))
    visible.setAttribute("style", boxStyle(40, 20, "#ff0000"))
    hidden.hidden = true
    hiddenChild.setAttribute(
      "style",
      `${boxStyle(40, 20, "#0000ff")}; transform:translateX(10px)`,
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 120},
    })
    const initial = renderer.flush()
    expect(initial.boxByNode.has(hidden)).toBeFalse()
    expect(initial.boxByNode.has(hiddenChild)).toBeFalse()

    root.setAttribute(
      "style",
      `${boxStyle(200, 80, "#111111")}; transform:translateX(12px); transform-origin:0 0`,
    )
    const patched = renderer.flush()
    expect(patched.boxByNode.has(hidden)).toBeFalse()
    expect(patched.boxByNode.has(hiddenChild)).toBeFalse()
    expect(background(patched, visible).transform.translateX).toBe(12)

    const forced = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 120},
    })
    const rebuilt = forced.flush()
    expect(patched.boxes).toEqual(rebuilt.boxes)
    expect(patched.displayList).toEqual(rebuilt.displayList)
    expect([...patched.hits]).toEqual([...rebuilt.hits])
    forced.dispose()

    hidden.hidden = false
    const revealed = renderer.flush()
    expect(revealed.boxByNode.has(hidden)).toBeTrue()
    expect(revealed.boxByNode.has(hiddenChild)).toBeTrue()
    expect(background(revealed, hiddenChild).transform.translateX).toBe(22)
    renderer.dispose()
  })
})

function background(frame: RenderFrame, node: Element): Extract<DisplayItem, {kind: "rect"}> {
  const item = frame.displayList.find((candidate): candidate is Extract<DisplayItem, {kind: "rect"}> =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "background"
  )
  if (!item) throw new Error("Expected background display item")
  return item
}

function boxStyle(width: number, height: number, background: string): string {
  return `box-sizing:border-box; width:${width}px; height:${height}px; padding:0; border:0; background:${background}`
}
