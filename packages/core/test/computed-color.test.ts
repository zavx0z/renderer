import {describe, expect, test} from "bun:test"
import {createDocument} from "@zavx0z/dom"
import {computeStyle, parseStyleSheets} from "../src/css.ts"
import {createDocumentRenderer} from "../src/index.ts"

describe("computed color transport", () => {
  test("normalizes the admitted named colors before display projection", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.appendChild(element)
    element.append("Color")
    element.setAttribute(
      "style",
      "display:block;width:20px;height:20px;color:red;background:blue;border:1px solid green;box-shadow:0 0 1px purple",
    )

    const frame = createDocumentRenderer({
      document,
      root: element,
      viewport: {width: 40, height: 40},
    }).flush()
    const background = frame.displayList.find((item) =>
      item.kind === "rect" && item.node === element && item.key === "background"
    )
    const shadow = frame.displayList.find((item) =>
      item.kind === "rect" && item.node === element && item.key === "shadow"
    )
    const text = frame.displayList.find((item) => item.kind === "text")

    expect(background).toMatchObject({
      color: "#0000ff",
      border: {colors: {
        top: "#008000",
        right: "#008000",
        bottom: "#008000",
        left: "#008000",
      }},
    })
    expect(shadow).toMatchObject({color: "#800080"})
    expect(text).toMatchObject({color: "#ff0000"})
  })

  test("discards a direct malformed color before cascade priority", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.appendChild(element)
    element.setAttribute(
      "style",
      "background:48 48 48;color:#1234567;border-color:48 48 48",
    )
    const rules = parseStyleSheets([
      "div{background-color:#123456;color:#234567;border:1px solid #345678}",
    ])
    const style = computeStyle(element, null, rules)

    expect(style.background).toBe("#123456")
    expect(style.color).toBe("#234567")
    expect(style.borderColors).toEqual({
      top: "#345678",
      right: "#345678",
      bottom: "#345678",
      left: "#345678",
    })
  })

  test("makes a variable-substituted malformed color invalid at computed-value time", () => {
    const document = createDocument()
    const owner = document.createElement("main")
    const element = document.createElement("div")
    document.appendChild(owner)
    owner.appendChild(element)
    owner.setAttribute("style", "color:#abcdef")
    element.setAttribute(
      "style",
      "--surface:48 48 48;background:var(--surface);color:var(--surface);border-color:var(--surface)",
    )
    const rules = parseStyleSheets([
      "div{background-color:#123456;color:#234567;border:1px solid #345678}",
    ])
    const ownerStyle = computeStyle(owner, null, rules)
    const style = computeStyle(element, ownerStyle, rules)

    expect(style.background).toBeNull()
    expect(style.color).toBe("#abcdef")
    expect(style.borderColors).toEqual({
      top: "#abcdef",
      right: "#abcdef",
      bottom: "#abcdef",
      left: "#abcdef",
    })
  })
})
