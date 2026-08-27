import {describe, expect, it} from "bun:test"
import {NodeList, createDocument} from "../src/index.ts"

function fixture() {
  const document = createDocument()
  const root = document.createElement("div")
  root.id = "app"
  root.className = "shell active"
  const panel = document.createElement("section")
  panel.className = "panel"
  panel.setAttribute("data-state", "ready")
  const button = document.createElement("button")
  button.id = "save"
  button.className = "action primary"
  button.title = "Save now"
  button.disabled = true
  const label = document.createElement("span")
  label.className = "action"
  panel.append(button, label)
  root.append(panel)
  document.append(root)
  return {button, document, label, panel, root}
}

describe("selector subset", () => {
  it("matches tag, universal, id, classes, attributes and descendants", () => {
    const {button, document, label, panel, root} = fixture()

    expect(document.getElementById("save")).toBe(button)
    expect(document.getElementById("")).toBeNull()
    expect(document.querySelector("#save")).toBe(button)
    expect(document.querySelector("div section button")).toBe(button)
    expect(document.querySelector("*.panel [title='Save now']")).toBe(button)
    expect(button.matches("button#save.action.primary[disabled][title=\"Save now\"]")).toBe(true)
    expect(button.matches("span.action")).toBe(false)
    expect(button.closest("div.shell .panel")).toBe(panel)
    expect(root.closest("#app")).toBe(root)
    expect(panel.querySelector(".panel")).toBeNull()
    expect(panel.querySelector("*.action")).toBe(button)
    expect(panel.querySelectorAll(".action").item(1)).toBe(label)
  })

  it("returns an immutable static NodeList snapshot in tree order", () => {
    const {button, document, label, panel} = fixture()
    const result = document.querySelectorAll(".action")

    expect(result).toBeInstanceOf(NodeList)
    expect(Array.isArray(result)).toBe(false)
    expect(Object.isFrozen(result)).toBe(true)
    expect(result.length).toBe(2)
    expect(result.item(0)).toBe(button)
    expect(result[1]).toBe(label)
    expect(result.item(-1)).toBeNull()
    expect([...result]).toEqual([button, label])
    const visited: unknown[] = []
    result.forEach((element, index, parent) => visited.push([element, index, parent]))
    expect(visited[1]).toEqual([label, 1, result])

    const later = document.createElement("span")
    later.className = "action"
    panel.append(later)
    expect(result.length).toBe(2)
    expect(document.querySelectorAll(".action").length).toBe(3)
    expect(() => new NodeList()).toThrow("Illegal constructor")
  })

  it("queries detached DocumentFragment descendants", () => {
    const document = createDocument()
    const fragment = document.createDocumentFragment()
    const wrapper = document.createElement("div")
    const child = document.createElement("span")
    child.className = "target"
    wrapper.append(child)
    fragment.append(wrapper)

    expect(fragment.querySelector("div .target")).toBe(child)
    expect(fragment.querySelectorAll("*").length).toBe(2)
  })

  it("throws SyntaxError for every selector form outside the declared subset", () => {
    const {button, document} = fixture()
    const unsupported = [
      "",
      "div, span",
      "div > span",
      "div + span",
      "div ~ span",
      ":hover",
      "[data-state~=ready]",
      "button:first-child",
      "div || span",
      ".escaped\\:name"
    ]

    for (const selector of unsupported) {
      for (const invoke of [
        () => document.querySelector(selector),
        () => document.querySelectorAll(selector),
        () => button.matches(selector),
        () => button.closest(selector)
      ]) {
        try {
          invoke()
          throw new Error(`Expected selector ${selector} to fail`)
        } catch (error) {
          expect((error as Error).name).toBe("SyntaxError")
        }
      }
    }
  })
})
