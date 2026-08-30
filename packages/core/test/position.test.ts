import {describe, expect, test} from "bun:test"
import {createDocument, type Element} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  hitTest,
  type RenderFrame,
} from "../src/index.ts"

describe("bounded positioned layout", () => {
  test("uses the nearest positioned block padding box and leaves absolute children out of flow", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const before = document.createElement("div")
    const bridge = document.createElement("div")
    const absolute = document.createElement("button")
    const after = document.createElement("div")
    document.appendChild(root)
    root.append(before, bridge, after)
    bridge.appendChild(absolute)
    root.setAttribute(
      "style",
      "position:relative; box-sizing:border-box; width:200px; height:120px; padding:10px; border:2px solid #111",
    )
    before.setAttribute("style", boxStyle(176, 20, "#111111"))
    bridge.setAttribute("style", `${boxStyle(100, 40, "#222222")}; margin-left:20px`)
    after.setAttribute("style", boxStyle(176, 20, "#333333"))
    absolute.setAttribute(
      "style",
      `${boxStyle(20, 10, "#ff0000")}; position:absolute; left:50%; top:25%`,
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 160},
    })

    const outerContainingBlock = renderer.flush()
    expect(outerContainingBlock.boxByNode.get(before)).toMatchObject({x: 12, y: 12})
    expect(outerContainingBlock.boxByNode.get(bridge)).toMatchObject({x: 32, y: 32})
    expect(outerContainingBlock.boxByNode.get(after)).toMatchObject({x: 12, y: 72})
    expect(outerContainingBlock.boxByNode.get(absolute)).toMatchObject({
      x: 100,
      y: 31,
      width: 20,
      height: 10,
    })
    expect(renderer.flush()).toBe(outerContainingBlock)

    bridge.setAttribute(
      "style",
      `${boxStyle(100, 40, "#222222")}; margin-left:20px; position:relative`,
    )
    const nestedContainingBlock = renderer.flush()
    expect(nestedContainingBlock.boxByNode.get(after)).toMatchObject({x: 12, y: 72})
    expect(nestedContainingBlock.boxByNode.get(absolute)).toMatchObject({x: 82, y: 42})

    document.transaction(() => {
      root.setAttribute(
        "style",
        "box-sizing:border-box; width:200px; height:120px; padding:10px; border:2px solid #111",
      )
      bridge.setAttribute(
        "style",
        `${boxStyle(100, 40, "#222222")}; margin-left:20px`,
      )
    })
    expect(renderer.flush().boxByNode.get(absolute)).toMatchObject({x: 120, y: 40})
    renderer.dispose()
  })

  test("offsets relative paint geometry while preserving the original block slot", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const relative = document.createElement("button")
    const after = document.createElement("button")
    document.appendChild(root)
    root.append(relative, after)
    root.setAttribute("style", boxStyle(200, 80, "#111111"))
    relative.id = "relative"
    relative.setAttribute("style", boxStyle(50, 20, "#ff0000"))
    after.setAttribute("style", boxStyle(50, 20, "#0000ff"))
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 120},
      styleSheets: [
        "#relative { position:relative; left:10%; top:5px; }",
        "#relative { position:fixed; left:calc(10px); top:unknown; }",
      ],
    })

    const first = renderer.flush()
    expect(first.boxByNode.get(relative)).toMatchObject({x: 10, y: 5})
    expect(first.boxByNode.get(after)).toMatchObject({x: 0, y: 20})

    relative.setAttribute(
      "style",
      `${boxStyle(50, 20, "#ff0000")}; position:relative; left:auto; right:10%; top:auto; bottom:5px`,
    )
    const oppositeInsets = renderer.flush()
    expect(oppositeInsets.boxByNode.get(relative)).toMatchObject({x: -20, y: -5})
    expect(oppositeInsets.boxByNode.get(after)).toMatchObject({x: 0, y: 20})

    relative.setAttribute(
      "style",
      `${boxStyle(50, 20, "#ff0000")}; position:relative; left:8px; right:50px; top:7px; bottom:30px`,
    )
    expect(renderer.flush().boxByNode.get(relative)).toMatchObject({x: 8, y: 7})
    renderer.dispose()
  })

  test("resolves absolute px/percentage/right/bottom and auto axes without consuming slots", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const before = document.createElement("div")
    const auto = document.createElement("button")
    const anchored = document.createElement("button")
    const stretched = document.createElement("div")
    const after = document.createElement("div")
    document.appendChild(root)
    root.append(before, auto, anchored, stretched, after)
    root.setAttribute("style", `${boxStyle(200, 100, "#111111")}; position:relative`)
    before.setAttribute("style", boxStyle(100, 20, "#222222"))
    auto.setAttribute(
      "style",
      `${boxStyle(30, 10, "#ff0000")}; position:absolute`,
    )
    anchored.setAttribute(
      "style",
      `${boxStyle(20, 10, "#00ff00")}; position:absolute; right:10%; bottom:10px`,
    )
    stretched.setAttribute(
      "style",
      "position:absolute; left:10%; right:20px; top:10px; bottom:20px; background:#0000ff",
    )
    after.setAttribute("style", boxStyle(100, 20, "#333333"))
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 140},
    })

    const frame = renderer.flush()
    expect(frame.boxByNode.get(auto)).toMatchObject({x: 0, y: 20, width: 30, height: 10})
    expect(frame.boxByNode.get(anchored)).toMatchObject({x: 160, y: 80})
    expect(frame.boxByNode.get(stretched)).toMatchObject({
      x: 20,
      y: 10,
      width: 160,
      height: 70,
    })
    expect(frame.boxByNode.get(after)).toMatchObject({x: 0, y: 20})
    renderer.dispose()
  })

  test("keeps absolute flex children out of flex sizing and uses flex static alignment for auto insets", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const normal = document.createElement("div")
    const absolute = document.createElement("button")
    document.appendChild(root)
    root.append(normal, absolute)
    root.setAttribute(
      "style",
      `${boxStyle(200, 40, "#111111")}; position:relative; display:flex; justify-content:center; align-items:flex-end`,
    )
    normal.setAttribute("style", "box-sizing:border-box; height:40px; flex:1; background:#222222")
    absolute.setAttribute(
      "style",
      `${boxStyle(50, 20, "#ff0000")}; position:absolute`,
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 80},
    })

    const frame = renderer.flush()
    expect(frame.boxByNode.get(normal)).toMatchObject({x: 0, y: 0, width: 200, height: 40})
    expect(frame.boxByNode.get(absolute)).toMatchObject({x: 75, y: 20, width: 50, height: 20})
    renderer.dispose()
  })

  test("uses the reversed flex cross axis for an absolute child's static position", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const absolute = document.createElement("button")
    document.appendChild(root)
    root.appendChild(absolute)
    root.setAttribute(
      "style",
      `${boxStyle(200, 40, "#111111")}; position:relative; display:flex; flex-wrap:wrap-reverse; justify-content:center; align-items:flex-start`,
    )
    absolute.setAttribute(
      "style",
      `${boxStyle(50, 20, "#ff0000")}; position:absolute; margin-top:4px; margin-bottom:3px`,
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 80},
    })

    expect(renderer.flush().boxByNode.get(absolute)).toMatchObject({
      x: 75,
      y: 17,
      width: 50,
      height: 20,
    })

    root.setAttribute(
      "style",
      `${boxStyle(200, 40, "#111111")}; position:relative; display:flex; flex-wrap:wrap-reverse; justify-content:center; align-items:flex-end`,
    )
    expect(renderer.flush().boxByNode.get(absolute)).toMatchObject({x: 75, y: 4})
    renderer.dispose()
  })

  test("projects final absolute geometry through overflow, hits, scrolling and positioned z-index", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const staticChild = document.createElement("button")
    const absolute = document.createElement("button")
    document.appendChild(root)
    root.append(staticChild, absolute)
    root.setAttribute(
      "style",
      `${boxStyle(100, 50, "#111111")}; position:relative; overflow:auto`,
    )
    staticChild.setAttribute(
      "style",
      `${boxStyle(100, 50, "#ff0000")}; z-index:999`,
    )
    absolute.setAttribute(
      "style",
      `${boxStyle(40, 30, "#0000ff")}; position:absolute; left:80px; top:40px; z-index:2`,
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 140, height: 90},
    })

    const first = renderer.flush()
    expect(first.scrolls.get(root)).toMatchObject({
      scrollWidth: 120,
      scrollHeight: 70,
      maxScrollLeft: 20,
      maxScrollTop: 20,
    })
    expect(imageOrder(first, staticChild, absolute)).toEqual([staticChild, absolute])
    expect(hitTest(first, 90, 45)?.node).toBe(absolute)
    expect(hitTest(first, 110, 45)).toBeNull()
    expect(first.displayList.find(({node}) => node === absolute)?.clips).toHaveLength(1)

    root.scrollTo({left: 20, top: 20})
    const scrolled = renderer.flush()
    expect(scrolled.boxByNode.get(absolute)).toMatchObject({x: 60, y: 20})
    expect(scrolled.hits.get(absolute)).toMatchObject({x: 60, y: 20})
    expect(hitTest(scrolled, 70, 25)?.node).toBe(absolute)

    absolute.setAttribute(
      "style",
      `${boxStyle(40, 30, "#0000ff")}; position:absolute; left:80px; top:40px; z-index:-1`,
    )
    const behind = renderer.flush()
    expect(imageOrder(behind, staticChild, absolute)).toEqual([absolute, staticChild])
    renderer.dispose()
  })
})

function boxStyle(width: number, height: number, background: string): string {
  return `box-sizing:border-box; width:${width}px; height:${height}px; padding:0; border:0; background:${background}`
}

function imageOrder(frame: RenderFrame, ...nodes: readonly Element[]): readonly Element[] {
  const accepted = new Set(nodes)
  return frame.displayList.flatMap((item) =>
    item.kind === "rect" && item.key === "background" && accepted.has(item.node as Element)
      ? [item.node as Element]
      : []
  )
}
