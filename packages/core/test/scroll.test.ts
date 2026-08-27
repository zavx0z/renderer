import {describe, expect, it} from "bun:test"
import {WheelEvent, createDocument} from "@zavx0z/dom"
import {
  createDocumentInteractionController,
  createDocumentRenderer,
} from "../src/index.ts"

describe("scroll layout projection", () => {
  it("clamps requested offsets, shifts descendants and preserves a clean frame", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("div")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute(
      "style",
      "box-sizing:border-box; width:100px; height:50px; padding:5px; overflow:auto; background:red",
    )
    child.setAttribute(
      "style",
      "width:200px; height:120px; background:blue",
    )
    root.scrollLeft = 30
    root.scrollTop = 40
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 50},
    })
    const first = renderer.flush()
    const metrics = first.scrolls.get(root)

    expect(metrics).toEqual({
      node: root,
      clientWidth: 100,
      clientHeight: 50,
      scrollWidth: 210,
      scrollHeight: 130,
      requestedScrollLeft: 30,
      requestedScrollTop: 40,
      scrollLeft: 30,
      scrollTop: 40,
      maxScrollLeft: 110,
      maxScrollTop: 80,
    })
    expect(first.boxByNode.get(root)).toMatchObject({x: 0, y: 0})
    expect(first.boxByNode.get(child)).toMatchObject({x: -25, y: -35})
    expect(
      first.displayList.find((item) => item.node === child),
    ).toMatchObject({x: -25, y: -35})
    expect(first.hits.get(child)).toMatchObject({x: -25, y: -35})
    expect(first.hits.get(child)?.clips[0]).toMatchObject({x: 0, y: 0})
    expect(Object.isFrozen(metrics)).toBe(true)
    expect(Object.isFrozen(first.scrolls)).toBe(true)
    expect("set" in first.scrolls).toBe(false)
    expect(renderer.flush()).toBe(first)

    root.scrollLeft = 1_000
    root.scrollTop = 1_000
    const clamped = renderer.flush()
    expect(clamped).not.toBe(first)
    expect(clamped.revision).toBe(first.revision + 1)
    expect(clamped.scrolls.get(root)).toMatchObject({
      requestedScrollLeft: 1_000,
      requestedScrollTop: 1_000,
      scrollLeft: 110,
      scrollTop: 80,
      maxScrollLeft: 110,
      maxScrollTop: 80,
    })
    expect(clamped.boxByNode.get(child)).toMatchObject({x: -105, y: -75})
    expect(first.boxByNode.get(child)).toMatchObject({x: -25, y: -35})

    root.scrollLeft = 1_000
    root.scrollTop = 1_000
    expect(renderer.flush()).toBe(clamped)
    renderer.dispose()
  })

  it("never scrolls overflow:clip and invalidates future non-scroll state records", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("div")
    const input = document.createElement("input")
    document.appendChild(root)
    root.appendChild(child)
    root.appendChild(input)
    root.setAttribute(
      "style",
      "width:40px; height:30px; overflow:clip; background:red",
    )
    child.setAttribute("style", "width:80px; height:60px")
    root.scrollLeft = 20
    root.scrollTop = 10
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 80, height: 80},
    })
    const first = renderer.flush()

    expect(first.scrolls.has(root)).toBe(false)
    expect(first.boxByNode.get(child)).toMatchObject({x: 0, y: 0})
    input.value = "state channel"
    const stateFrame = renderer.flush()
    expect(stateFrame).not.toBe(first)
    expect(stateFrame.revision).toBe(first.revision + 1)
    expect(renderer.flush()).toBe(stateFrame)
    renderer.dispose()
  })
})

describe("wheel interaction", () => {
  it("dispatches a bubbling WheelEvent and applies accepted deltas", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("button")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute("style", "width:100px; height:50px; overflow:auto")
    child.setAttribute(
      "style",
      "display:block; width:100px; height:150px; padding:0",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 50},
    })
    const interaction = createDocumentInteractionController({document})
    const initial = renderer.flush()
    const events: string[] = []
    child.addEventListener("wheel", (event) => {
      expect(event).toBeInstanceOf(WheelEvent)
      expect((event as WheelEvent).deltaY).toBe(30)
      events.push("child")
    }, {once: true})
    root.addEventListener("wheel", () => events.push("root"))

    expect(interaction.wheel(initial, {
      clientX: 10,
      clientY: 10,
      deltaY: 30,
    })).toBe(child)
    expect(events).toEqual(["child", "root"])
    expect(root.scrollTop).toBe(30)

    interaction.wheel(initial, {
      clientX: 10,
      clientY: 10,
      deltaY: 15,
    })
    expect(root.scrollTop).toBe(45)

    const scrolled = renderer.flush()
    expect(scrolled.scrolls.get(root)).toMatchObject({scrollTop: 45})
    expect(scrolled.boxByNode.get(child)).toMatchObject({y: -45})

    child.addEventListener("wheel", (event) => event.preventDefault())
    interaction.wheel(scrolled, {clientX: 10, clientY: 10, deltaY: 20})
    expect(root.scrollTop).toBe(45)
    expect(renderer.flush()).toBe(scrolled)
    interaction.dispose()
    renderer.dispose()
  })

  it("chooses the deepest ancestor with remaining range on each axis", () => {
    const document = createDocument()
    const outer = document.createElement("div")
    const inner = document.createElement("div")
    const content = document.createElement("div")
    const spacer = document.createElement("div")
    document.appendChild(outer)
    outer.appendChild(inner)
    outer.appendChild(spacer)
    inner.appendChild(content)
    outer.setAttribute("style", "width:100px; height:100px; overflow:auto")
    inner.setAttribute("style", "width:100px; height:80px; overflow:auto")
    content.setAttribute("style", "width:100px; height:200px")
    spacer.setAttribute("style", "width:100px; height:100px")
    const renderer = createDocumentRenderer({
      document,
      root: outer,
      viewport: {width: 100, height: 100},
    })
    const interaction = createDocumentInteractionController({document})
    let frame = renderer.flush()
    const innerMaximum = frame.scrolls.get(inner)?.maxScrollTop
    if (innerMaximum === undefined) throw new Error("Expected inner scroll metrics")
    inner.scrollTop = innerMaximum - 10
    frame = renderer.flush()

    interaction.wheel(frame, {clientX: 10, clientY: 10, deltaY: 10})
    expect(inner.scrollTop).toBe(innerMaximum)
    expect(outer.scrollTop).toBe(0)
    interaction.wheel(frame, {clientX: 10, clientY: 10, deltaY: 25})
    expect(inner.scrollTop).toBe(innerMaximum)
    expect(outer.scrollTop).toBe(25)
    frame = renderer.flush()
    expect(frame.scrolls.get(outer)).toMatchObject({scrollTop: 25})
    expect(frame.hits.get(content)?.clips).toHaveLength(2)
    expect(frame.hits.get(content)?.clips[0]).toMatchObject({y: 0})
    expect(frame.hits.get(content)?.clips[1]).toMatchObject({y: -25})

    interaction.wheel(frame, {clientX: 10, clientY: 10, deltaY: -10})
    expect(inner.scrollTop).toBe(innerMaximum - 10)
    expect(outer.scrollTop).toBe(25)
    interaction.dispose()
    renderer.dispose()
  })
})
