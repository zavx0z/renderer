import {describe, expect, test} from "bun:test"
import {
  createDocument,
  readDocumentCompiledStyleSheets
} from "@zavx0z/dom"
import {
  bindKeyed,
  defineCompiledTemplate,
  writeBinding
} from "@zavx0z/template/compiled"
import {
  component,
  createRoot,
  keyedComponents,
  memo
} from "../src/index.ts"

const itemStyleSheet = Object.freeze({
  id: "react.item",
  cssText: "[data-z-item]{display:block;width:20px;height:10px}"
})

const Item = defineCompiledTemplate<{index: number}>({
  bindingCount: 0,
  displayName: "StyleItem",
  styleSheets: [itemStyleSheet],
  mount(document) {
    const item = document.createElement("button")
    item.setAttribute("data-z-item", "")
    return {bindings: [], nodes: [item]}
  },
  render() {}
})

const Items = defineCompiledTemplate<{count: number}>({
  bindingCount: 1,
  displayName: "StyleItems",
  mount(document) {
    const start = document.createComment("items:start")
    const end = document.createComment("items:end")
    return {bindings: [bindKeyed(start, end)], nodes: [start, end]}
  },
  render(props, values) {
    writeBinding(values, 0, keyedComponents(
      Array.from({length: props.count}, (_, index) => component(Item, {index}, index))
    ))
  }
})

describe("ComponentRoot compiled stylesheet adoption", () => {
  test("adopts one template sheet for one thousand instances and releases it on unmount", () => {
    const document = createDocument()
    const host = document.createElement("main")
    document.appendChild(host)
    const root = createRoot(host)

    root.render(Items, {count: 1_000})
    expect(host.querySelectorAll("button")).toHaveLength(1_000)
    expect(readDocumentCompiledStyleSheets(document)).toMatchObject({
      revision: 1,
      styleSheets: [itemStyleSheet]
    })
    root.render(Items, {count: 500})
    expect(readDocumentCompiledStyleSheets(document).revision).toBe(1)

    root.unmount()
    expect(readDocumentCompiledStyleSheets(document)).toEqual({revision: 2, styleSheets: []})
  })

  test("deduplicates the same sheet across roots until the last root unmounts", () => {
    const document = createDocument()
    const owner = document.createElement("main")
    const left = document.createElement("div")
    const right = document.createElement("div")
    owner.append(left, right)
    document.appendChild(owner)
    const leftRoot = createRoot(left)
    const rightRoot = createRoot(right)

    leftRoot.render(Item, {index: 1})
    rightRoot.render(Item, {index: 2})
    expect(readDocumentCompiledStyleSheets(document).revision).toBe(1)
    expect(readDocumentCompiledStyleSheets(document).styleSheets).toHaveLength(1)

    leftRoot.unmount()
    expect(readDocumentCompiledStyleSheets(document).revision).toBe(1)
    rightRoot.unmount()
    expect(readDocumentCompiledStyleSheets(document)).toEqual({revision: 2, styleSheets: []})
  })

  test("rejects a cross-template id collision without replacing the committed root", () => {
    const document = createDocument()
    const host = document.createElement("main")
    document.appendChild(host)
    const root = createRoot(host)
    root.render(Item, {index: 1})
    const committed = host.querySelector("button")
    const before = readDocumentCompiledStyleSheets(document)
    const Conflict = defineCompiledTemplate<Record<string, never>>({
      bindingCount: 0,
      displayName: "ConflictingStyle",
      styleSheets: [{id: itemStyleSheet.id, cssText: "[data-z-item]{height:99px}"}],
      mount(ownerDocument) {
        return {bindings: [], nodes: [ownerDocument.createElement("div")]}
      },
      render() {}
    })

    expect(() => root.render(Conflict, {})).toThrow("id collision")
    expect(host.querySelector("button")).toBe(committed)
    expect(readDocumentCompiledStyleSheets(document)).toBe(before)
    root.unmount()
  })

  test("preserves exact stylesheet metadata through memo", () => {
    const MemoItem = memo(Item)
    expect(MemoItem.styleSheets).toEqual(Item.styleSheets)
    expect(Object.isFrozen(MemoItem.styleSheets)).toBeTrue()
  })
})
