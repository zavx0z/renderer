import { describe, expect, it } from "bun:test"
import { createDocument } from "@zavx0z/dom"
import { DirtyTracker } from "../src/dirty.ts"
import { createDocumentRenderer, type DisplayItem } from "../src/index.ts"

describe("CPU document renderer", () => {
  it("creates immutable block, paint and hit records and reuses a clean frame", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const panel = document.createElement("div")
    const button = document.createElement("button")
    document.appendChild(root)
    root.appendChild(panel)
    panel.appendChild(button)
    panel.setAttribute(
      "style",
      "width: 100px; height: 20px; background: #112233",
    )
    button.textContent = "Go"

    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: { width: 300, height: 200 },
    })
    const frame = renderer.flush()

    expect(frame.boxByNode.get(root)).toMatchObject({ x: 0, y: 0, width: 300 })
    expect(frame.boxByNode.get(panel)).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    })
    expect(
      frame.displayList.find(
        (item) => item.kind === "rect" && item.node === panel,
      ),
    ).toEqual({
      kind: "rect",
      key: "background",
      node: panel,
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      color: "#112233",
          opacity: 1,
          shadow: null,
          clips: [],
          transform: {scaleX: 1, scaleY: 1, translateX: 0, translateY: 0},
      border: {
        widths: {top: 0, right: 0, bottom: 0, left: 0},
        colors: {
          top: "#000000",
          right: "#000000",
          bottom: "#000000",
          left: "#000000",
        },
        radii: {topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0},
      },
    })
    expect(frame.hits.get(button)).toMatchObject({
      node: button,
      interactive: true,
      disabled: false,
      role: "button",
    })
    expect(Object.isFrozen(frame)).toBe(true)
    expect(Array.isArray(frame.boxes)).toBe(true)
    expect(Object.isFrozen(frame.boxes[0])).toBe(true)
    expect(Array.isArray(frame.displayList)).toBe(true)
    const firstBox = frame.boxes[0]
    expect(() => Reflect.set(frame.boxes, "0", null)).toThrow("immutable")
    expect(() => (frame.displayList as DisplayItem[]).push(frame.displayList[0]!)).toThrow(
      "immutable",
    )
    expect(frame.boxes[0]).toBe(firstBox)
    expect("set" in frame.hits).toBe(false)
    expect(renderer.flush()).toBe(frame)
    expect(renderer.render()).toBe(frame)
  })

  it("applies UA defaults, selector specificity, inheritance and inline precedence", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    document.appendChild(root)
    root.className = "panel"
    root.appendChild(button)
    button.id = "output"
    button.textContent = "Output"
    button.setAttribute("style", "background: #333333")

    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: { width: 320, height: 200 },
      styleSheets: [
        `
          button { color: blue; font-size: 10px; background: #111111 }
          .panel button { color: green; padding: 4px }
          #output { color: red }
        `,
      ],
    })
    const frame = renderer.flush()
    const text = frame.displayList.find((item) => item.kind === "text")
    const buttonBox = frame.boxByNode.get(button)

    expect(text).toMatchObject({
      kind: "text",
      key: "text",
      text: "Output",
      color: "red",
      fontSize: 10,
    })
    expect(buttonBox?.padding).toEqual({ top: 4, right: 4, bottom: 4, left: 4 })
    expect(
      frame.displayList.find(
        (item) => item.kind === "rect" && item.node === button,
      ),
    ).toMatchObject({
      color: "#333333",
    })
  })

  it("resolves currentcolor for computed color and backgrounds before display projection", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const glyph = document.createElement("span")
    const literal = document.createElement("span")
    const transparent = document.createElement("span")
    document.appendChild(root)
    root.append(glyph, literal, transparent)
    root.setAttribute("style", "color:rgb(71 114 179)")
    glyph.setAttribute(
      "style",
      "display:block; width:12px; height:12px; color:currentcolor; background:currentcolor; border:1px solid currentcolor; box-shadow:0 0 2px currentcolor",
    )
    literal.setAttribute(
      "style",
      "display:block; width:12px; height:12px; color:#102030; background:#abcdef; border:1px solid currentcolor",
    )
    transparent.setAttribute(
      "style",
      "display:block; width:12px; height:12px; color:#405060; background:transparent; border:1px solid currentcolor",
    )

    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 100},
    })
    const frame = renderer.flush()
    const glyphBackground = frame.displayList.find((item) =>
      item.kind === "rect" && item.node === glyph && item.key === "background"
    )
    const glyphShadow = frame.displayList.find((item) =>
      item.kind === "rect" && item.node === glyph && item.key === "shadow"
    )
    const literalBackground = frame.displayList.find((item) =>
      item.kind === "rect" && item.node === literal && item.key === "background"
    )
    const transparentBackground = frame.displayList.find((item) =>
      item.kind === "rect" && item.node === transparent && item.key === "background"
    )

    expect(glyphBackground).toMatchObject({
      color: "rgb(71 114 179)",
      border: {colors: {
        top: "rgb(71 114 179)",
        right: "rgb(71 114 179)",
        bottom: "rgb(71 114 179)",
        left: "rgb(71 114 179)",
      }},
    })
    expect(glyphShadow).toMatchObject({color: "rgb(71 114 179)"})
    expect(literalBackground).toMatchObject({
      color: "#abcdef",
      border: {colors: {top: "#102030", right: "#102030", bottom: "#102030", left: "#102030"}},
    })
    expect(transparentBackground).toMatchObject({
      color: "transparent",
      border: {colors: {top: "#405060", right: "#405060", bottom: "#405060", left: "#405060"}},
    })
    for (const item of frame.displayList) {
      if (item.kind !== "rect") continue
      expect(item.color.toLowerCase()).not.toBe("currentcolor")
      for (const color of Object.values(item.border.colors)) {
        expect(color.toLowerCase()).not.toBe("currentcolor")
      }
    }
    renderer.dispose()
  })

  it("lays out deterministic flex rows and columns with growth, gap and padding", () => {
    const document = createDocument()
    const row = document.createElement("div")
    const growing = document.createElement("div")
    const fixed = document.createElement("div")
    document.appendChild(row)
    row.setAttribute(
      "style",
      "display: flex; flex-direction: row; width: 300px; height: 40px; gap: 10px; padding: 5px",
    )
    growing.setAttribute("style", "flexGrow: 1; height: 20px; background: red")
    fixed.setAttribute("style", "width: 50px; height: 20px; background: blue")
    row.appendChild(growing)
    row.appendChild(fixed)

    const renderer = createDocumentRenderer({
      document,
      root: row,
      viewport: { width: 400, height: 200 },
    })
    const frame = renderer.flush()

    expect(frame.boxByNode.get(row)).toMatchObject({
      width: 310,
      height: 50,
      contentX: 5,
      contentY: 5,
      contentWidth: 300,
      contentHeight: 40,
    })
    expect(frame.boxByNode.get(growing)).toMatchObject({
      x: 5,
      y: 5,
      width: 240,
      height: 20,
    })
    expect(frame.boxByNode.get(fixed)).toMatchObject({
      x: 255,
      y: 5,
      width: 50,
      height: 20,
    })

    row.setAttribute(
      "style",
      "display: flex; flex-direction: column; height: 100px; gap: 10px",
    )
    growing.setAttribute("style", "grow: 1; height: 10px")
    fixed.setAttribute("style", "height: 20px")
    const columnFrame = renderer.flush()

    expect(columnFrame.boxByNode.get(growing)).toMatchObject({
      x: 0,
      y: 0,
      height: 70,
    })
    expect(columnFrame.boxByNode.get(fixed)).toMatchObject({
      x: 0,
      y: 80,
      height: 20,
    })
  })

  it("invalidates from committed leaf mutations and preserves identity between clean flushes", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const branch = document.createElement("div")
    const leaf = document.createElement("span")
    const sibling = document.createElement("span")
    const text = document.createTextNode("one")
    document.appendChild(root)
    root.appendChild(branch)
    root.appendChild(sibling)
    branch.appendChild(leaf)
    leaf.appendChild(text)

    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: { width: 200, height: 100 },
    })
    const first = renderer.flush()
    expect(renderer.flush()).toBe(first)

    text.data = "longer"
    const second = renderer.flush()
    expect(second).not.toBe(first)
    expect(second.revision).toBe(first.revision + 1)
    expect(
      second.displayList.find((item) => item.kind === "text"),
    ).toMatchObject({ text: "longer" })
    expect(renderer.flush()).toBe(second)

    renderer.dispose()
    text.data = "detached renderer"
    expect(() => renderer.flush()).toThrow("disposed")
  })

  it("recomputes a mutated semantic subtree for inherited and descendant styles", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const firstParent = document.createElement("div")
    const secondParent = document.createElement("div")
    const label = document.createElement("span")
    const text = document.createTextNode("Label")
    document.appendChild(root)
    root.appendChild(firstParent)
    root.appendChild(secondParent)
    firstParent.appendChild(label)
    label.appendChild(text)
    firstParent.setAttribute("style", "color: red")
    secondParent.setAttribute("style", "color: blue")

    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: { width: 200, height: 100 },
      styleSheets: [".selected span { color: purple }"],
    })
    expect(
      renderer.flush().displayList.find((item) => item.kind === "text"),
    ).toMatchObject({
      color: "red",
    })

    secondParent.appendChild(label)
    expect(
      renderer.flush().displayList.find((item) => item.kind === "text"),
    ).toMatchObject({
      color: "blue",
    })

    secondParent.className = "selected"
    expect(
      renderer.flush().displayList.find((item) => item.kind === "text"),
    ).toMatchObject({
      color: "purple",
    })
  })

  it("removes display:none subtrees from boxes, paint and hits", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const hidden = document.createElement("button")
    document.appendChild(root)
    root.appendChild(hidden)
    hidden.setAttribute("style", "display: none")
    hidden.textContent = "Invisible"

    const frame = createDocumentRenderer({
      document,
      root,
      viewport: { width: 200, height: 100 },
    }).flush()

    expect(frame.boxByNode.has(hidden)).toBe(false)
    expect(frame.hits.has(hidden)).toBe(false)
    expect(
      frame.displayList.some(
        (item) => item.node === hidden || item.node === hidden.firstChild,
      ),
    ).toBe(false)
  })

  it("ignores Comment anchors and collapses formatting-only HTML whitespace", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const before = document.createComment("region:start")
    const indentation = document.createTextNode("\n    ")
    const label = document.createElement("span")
    const after = document.createComment("region:end")
    document.appendChild(root)
    root.appendChild(before)
    root.appendChild(indentation)
    root.appendChild(label)
    root.appendChild(after)
    label.textContent = "Visible"

    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 100},
    }).flush()

    expect(frame.boxByNode.has(before)).toBe(false)
    expect(frame.boxByNode.has(after)).toBe(false)
    expect(frame.boxByNode.get(indentation)).toMatchObject({width: 0, height: 0})
    expect(frame.displayList.filter((item) => item.kind === "text")).toEqual([
      expect.objectContaining({node: label.firstChild, text: "Visible"}),
    ])

    const fixed = document.createElement("span")
    fixed.textContent = "Fixed"
    root.appendChild(fixed)
    root.setAttribute("style", "display:flex; flex-direction:column; height:100px; flex-grow:1")
    label.setAttribute("style", "flex-grow:1")
    fixed.setAttribute("style", "height:20px")
    const flexFrame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 100},
    }).flush()
    expect(flexFrame.boxByNode.get(label)).toMatchObject({y: 0, height: 80})
    expect(flexFrame.boxByNode.get(fixed)).toMatchObject({y: 80, height: 20})
  })
})

describe("dirty ancestry", () => {
  it("marks the exact leaf-to-root chain and rejects unrelated nodes atomically", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const branch = document.createElement("div")
    const leaf = document.createElement("span")
    const sibling = document.createElement("span")
    const unrelated = document.createElement("div")
    document.appendChild(root)
    root.appendChild(branch)
    root.appendChild(sibling)
    branch.appendChild(leaf)

    const tracker = new DirtyTracker(root)
    tracker.clear()
    tracker.invalidate(leaf)
    expect(tracker.snapshot()).toEqual([leaf, branch, root])
    expect(tracker.snapshot()).not.toContain(sibling)

    tracker.clear()
    expect(() => tracker.invalidate(unrelated)).toThrow(RangeError)
    expect(tracker.snapshot()).toEqual([])
  })
})

describe("production CSS box and flex slice", () => {
  it("resolves sizing aliases, min/max, box sizing, edges and complete rect paint", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const contentBox = document.createElement("div")
    const text = document.createTextNode("paint")
    document.appendChild(root)
    root.appendChild(contentBox)
    contentBox.appendChild(text)
    root.setAttribute(
      "style",
      [
        "box-sizing: border-box",
        "inline-size: 120px",
        "block-size: 80px",
        "min-inline-size: 100px",
        "max-inline-size: 110px",
        "min-block-size: 70px",
        "max-block-size: 75px",
        "margin: 1px 2px 3px 4px",
        "margin-left: 6px",
        "padding: 5px 6px 7px 8px",
        "border: 2px solid rgb(22, 22, 22)",
        "border-width: 2px 4px 2px 2px",
        "border-color: red green blue black",
        "border-radius: 12px 8px 4px 2px",
        "background: #ffffff",
        "opacity: 50%",
      ].join("; "),
    )
    contentBox.setAttribute(
      "style",
      "width: 20px; height: 10px; padding: 2px; border: 1px solid red",
    )

    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 120},
    }).flush()
    const rootBox = frame.boxByNode.get(root)
    const contentBoxRecord = frame.boxByNode.get(contentBox)
    const paint = frame.displayList.find(
      (item) => item.kind === "rect" && item.node === root,
    )
    const textPaint = frame.displayList.find(
      (item) => item.kind === "text" && item.node === text,
    )

    expect(rootBox).toMatchObject({
      x: 6,
      y: 1,
      width: 110,
      height: 75,
      contentX: 16,
      contentY: 8,
      contentWidth: 90,
      contentHeight: 59,
      margin: {top: 1, right: 2, bottom: 3, left: 6},
      padding: {top: 5, right: 6, bottom: 7, left: 8},
    })
    expect(contentBoxRecord).toMatchObject({
      width: 26,
      height: 16,
      contentWidth: 20,
      contentHeight: 10,
    })
    expect(paint).toMatchObject({
      kind: "rect",
      key: "background",
      color: "#ffffff",
      opacity: 0.5,
      border: {
        widths: {top: 2, right: 4, bottom: 2, left: 2},
        colors: {top: "red", right: "green", bottom: "blue", left: "black"},
        radii: {topLeft: 12, topRight: 8, bottomRight: 4, bottomLeft: 2},
      },
    })
    expect(textPaint).toMatchObject({opacity: 0.5})
  })

  it("distributes flex shorthand grow and shrink and aligns rows and columns", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const growRow = document.createElement("div")
    const firstGrow = document.createElement("div")
    const secondGrow = document.createElement("div")
    const fixed = document.createElement("div")
    const shrinkRow = document.createElement("div")
    const firstShrink = document.createElement("div")
    const secondShrink = document.createElement("div")
    const centered = document.createElement("div")
    const centerA = document.createElement("div")
    const centerB = document.createElement("div")
    const column = document.createElement("div")
    const columnA = document.createElement("div")
    const columnB = document.createElement("div")
    document.appendChild(root)
    root.appendChild(growRow)
    root.appendChild(shrinkRow)
    root.appendChild(centered)
    root.appendChild(column)
    growRow.appendChild(firstGrow)
    growRow.appendChild(secondGrow)
    growRow.appendChild(fixed)
    shrinkRow.appendChild(firstShrink)
    shrinkRow.appendChild(secondShrink)
    centered.appendChild(centerA)
    centered.appendChild(centerB)
    column.appendChild(columnA)
    column.appendChild(columnB)

    growRow.setAttribute(
      "style",
      "display:flex; width:300px; height:40px; gap:10px; align-items:center",
    )
    firstGrow.setAttribute("style", "flex:1; height:10px")
    secondGrow.setAttribute("style", "flex:2 1 0; height:10px")
    fixed.setAttribute(
      "style",
      "flex:none; width:30px; height:10px; margin-left:4px",
    )
    shrinkRow.setAttribute("style", "display:flex; width:100px; height:20px")
    firstShrink.setAttribute("style", "flex:0 1 80px; height:10px")
    secondShrink.setAttribute("style", "flex:0 1 80px; height:10px")
    centered.setAttribute(
      "style",
      "display:flex; width:200px; height:40px; justify-content:center; align-items:center",
    )
    centerA.setAttribute("style", "flex:none; width:20px; height:10px")
    centerB.setAttribute("style", "flex:none; width:20px; height:10px")
    column.setAttribute(
      "style",
      "display:flex; flex-direction:column; width:40px; height:100px; align-items:flex-end",
    )
    columnA.setAttribute("style", "flex:1; width:10px")
    columnB.setAttribute("style", "flex:1; width:10px; margin-top:4px")

    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 400, height: 300},
    }).flush()
    const firstGrowBox = frame.boxByNode.get(firstGrow)
    const secondGrowBox = frame.boxByNode.get(secondGrow)
    const fixedBox = frame.boxByNode.get(fixed)

    expect(firstGrowBox?.width).toBeCloseTo(82)
    expect(secondGrowBox?.width).toBeCloseTo(164)
    expect(firstGrowBox).toMatchObject({x: 0, y: 15, height: 10})
    expect(secondGrowBox?.x).toBeCloseTo(92)
    expect(fixedBox).toMatchObject({x: 270, y: 15, width: 30, height: 10})
    expect(frame.boxByNode.get(firstShrink)).toMatchObject({x: 0, y: 40, width: 50})
    expect(frame.boxByNode.get(secondShrink)).toMatchObject({x: 50, y: 40, width: 50})
    expect(frame.boxByNode.get(centerA)).toMatchObject({x: 80, y: 75})
    expect(frame.boxByNode.get(centerB)).toMatchObject({x: 100, y: 75})
    expect(frame.boxByNode.get(columnA)).toMatchObject({x: 30, y: 100, width: 10})
    expect(frame.boxByNode.get(columnA)?.height).toBeCloseTo(48)
    expect(frame.boxByNode.get(columnB)).toMatchObject({x: 30, y: 152, width: 10})
    expect(frame.boxByNode.get(columnB)?.height).toBeCloseTo(48)
  })

  it("lays out the live Inspector owner chain without component coordinates", () => {
    const document = createDocument()
    const root = document.createElement("aside")
    const toolbar = document.createElement("header")
    const search = document.createElement("input")
    const body = document.createElement("div")
    const rail = document.createElement("nav")
    const category = document.createElement("button")
    const content = document.createElement("main")
    const context = document.createElement("div")
    const sections = document.createElement("div")
    document.appendChild(root)
    root.appendChild(toolbar)
    root.appendChild(body)
    toolbar.appendChild(search)
    body.appendChild(rail)
    body.appendChild(content)
    rail.appendChild(category)
    content.appendChild(context)
    content.appendChild(sections)
    root.className = "ui-inspector"
    toolbar.className = "ui-inspector__toolbar"
    search.className = "ui-inspector__search"
    body.className = "ui-inspector__body"
    rail.className = "ui-inspector__rail"
    category.className = "ui-inspector__category"
    content.className = "ui-inspector__content"
    context.className = "ui-inspector__context"
    sections.className = "ui-inspector__sections"

    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 320, height: 240},
      styleSheets: [INSPECTOR_LAYOUT_CSS],
    })
    const frame = renderer.flush()

    expect(frame.boxByNode.get(root)).toMatchObject({
      x: 0,
      y: 0,
      width: 320,
      height: 240,
      contentX: 1,
      contentY: 1,
      contentWidth: 318,
      contentHeight: 238,
    })
    expect(frame.boxByNode.get(toolbar)).toMatchObject({x: 1, y: 1, width: 318, height: 30})
    expect(frame.boxByNode.get(search)).toMatchObject({x: 102.5, y: 5, width: 115, height: 22})
    expect(frame.boxByNode.get(body)).toMatchObject({x: 1, y: 31, width: 318, height: 208})
    expect(frame.boxByNode.get(rail)).toMatchObject({x: 1, y: 31, width: 30, height: 208})
    expect(frame.boxByNode.get(category)).toMatchObject({x: 5, y: 39, width: 26, height: 28})
    expect(frame.boxByNode.get(content)).toMatchObject({x: 31, y: 31, width: 288, height: 208})
    expect(frame.boxByNode.get(context)).toMatchObject({x: 31, y: 31, width: 288, height: 28})
    expect(frame.boxByNode.get(sections)).toMatchObject({x: 31, y: 59, width: 288, height: 180})
  })
})

const INSPECTOR_LAYOUT_CSS = String.raw`
  .ui-inspector {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    border: 1px solid rgb(22, 22, 22);
    border-radius: 6px;
    background: rgb(48, 48, 48);
    opacity: 1;
  }
  .ui-inspector__toolbar {
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 30px;
    padding: 4px;
  }
  .ui-inspector__search {
    box-sizing: border-box;
    width: 115px;
    height: 22px;
    padding: 2px 8px;
    border: 1px solid rgb(22, 22, 22);
    border-radius: 4px;
  }
  .ui-inspector__body {
    display: flex;
    flex-direction: row;
    width: 100%;
    flex-grow: 1;
  }
  .ui-inspector__rail {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 30px;
    height: 100%;
    padding: 8px 0;
  }
  .ui-inspector__category {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 28px;
    margin-left: 4px;
    padding: 0;
    border: 0;
  }
  .ui-inspector__content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex-grow: 1;
  }
  .ui-inspector__context {
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: 28px;
    padding: 6px;
  }
  .ui-inspector__sections {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
    flex-grow: 1;
    gap: 2px;
    padding: 7px;
  }
`
