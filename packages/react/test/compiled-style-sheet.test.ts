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

const workbenchStyleSheet = Object.freeze({
  id: "react.workbench",
  cssText: "[data-z-workbench]{display:block}",
  source: Object.freeze({
    kind: "authored-css" as const,
    moduleId: "@scope/storybook/workbench",
    componentName: "Workbench",
    cssText: "main { display: block }"
  })
})

const storyStyleSheet = Object.freeze({
  id: "react.story",
  cssText: "[data-z-story]{display:block}"
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

const Workbench = defineCompiledTemplate<Record<string, never>>({
  bindingCount: 0,
  displayName: "Workbench",
  styleSheets: [workbenchStyleSheet, itemStyleSheet],
  mount(document) {
    const item = document.createElement("main")
    item.setAttribute("data-z-workbench", "")
    return {bindings: [], nodes: [item]}
  },
  render() {}
})

const Story = defineCompiledTemplate<Record<string, never>>({
  bindingCount: 0,
  displayName: "Story",
  styleSheets: [itemStyleSheet, storyStyleSheet],
  mount(document) {
    const item = document.createElement("section")
    item.setAttribute("data-z-story", "")
    return {bindings: [], nodes: [item]}
  },
  render() {}
})

describe("ComponentRoot compiled stylesheet adoption", () => {
  test("adopts one template sheet for one thousand instances and releases it on unmount", () => {
    const document = createDocument()
    const host = document.createElement("main")
    document.appendChild(host)
    const root = createRoot(host)
    const empty = root.readStyleSheets()
    expect(empty).toEqual({revision: 0, styleSheets: []})
    expect(root.readStyleSheets()).toBe(empty)

    root.render(Items, {count: 1_000})
    expect(host.querySelectorAll("button")).toHaveLength(1_000)
    expect(readDocumentCompiledStyleSheets(document)).toMatchObject({
      revision: 1,
      styleSheets: [itemStyleSheet]
    })
    const snapshot = root.readStyleSheets()
    expect(snapshot).toEqual({revision: 1, styleSheets: [itemStyleSheet]})
    expect(snapshot.styleSheets[0]).toBe(Item.styleSheets[0])
    expect(Object.isFrozen(snapshot)).toBeTrue()
    root.render(Items, {count: 500})
    expect(readDocumentCompiledStyleSheets(document).revision).toBe(1)
    expect(root.readStyleSheets()).toBe(snapshot)

    root.unmount()
    expect(readDocumentCompiledStyleSheets(document)).toEqual({revision: 2, styleSheets: []})
    expect(() => root.readStyleSheets()).toThrow("unmounted")
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

  test("keeps Workbench and story snapshots isolated while the Document deduplicates", () => {
    const document = createDocument()
    const owner = document.createElement("main")
    const workbenchHost = document.createElement("div")
    const storyHost = document.createElement("div")
    owner.append(workbenchHost, storyHost)
    document.appendChild(owner)
    const workbenchRoot = createRoot(workbenchHost)
    const storyRoot = createRoot(storyHost)

    workbenchRoot.render(Workbench, {})
    storyRoot.render(Story, {})
    expect(workbenchRoot.readStyleSheets()).toEqual({
      revision: 1,
      styleSheets: [workbenchStyleSheet, itemStyleSheet]
    })
    expect(storyRoot.readStyleSheets()).toEqual({
      revision: 1,
      styleSheets: [itemStyleSheet, storyStyleSheet]
    })
    expect(workbenchRoot.readStyleSheets().styleSheets[0]).toBe(Workbench.styleSheets[0])
    expect(workbenchRoot.readStyleSheets().styleSheets[0]?.source).toEqual({
      kind: "authored-css",
      moduleId: "@scope/storybook/workbench",
      componentName: "Workbench",
      cssText: "main { display: block }"
    })
    expect(storyRoot.readStyleSheets().styleSheets[1]).toBe(Story.styleSheets[1])
    expect(readDocumentCompiledStyleSheets(document).styleSheets).toEqual([
      {id: workbenchStyleSheet.id, cssText: workbenchStyleSheet.cssText},
      {id: itemStyleSheet.id, cssText: itemStyleSheet.cssText},
      {id: storyStyleSheet.id, cssText: storyStyleSheet.cssText}
    ])

    workbenchRoot.unmount()
    expect(readDocumentCompiledStyleSheets(document).styleSheets).toEqual([
      itemStyleSheet,
      storyStyleSheet
    ])
    expect(storyRoot.readStyleSheets().styleSheets).toEqual([itemStyleSheet, storyStyleSheet])
    storyRoot.unmount()
  })

  test("rejects a cross-template id collision without replacing the committed root", () => {
    const document = createDocument()
    const host = document.createElement("main")
    document.appendChild(host)
    const root = createRoot(host)
    root.render(Item, {index: 1})
    const committed = host.querySelector("button")
    const before = readDocumentCompiledStyleSheets(document)
    const rootBefore = root.readStyleSheets()
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
    expect(root.readStyleSheets()).toBe(rootBefore)
    root.unmount()
  })

  test("preserves exact stylesheet metadata through memo", () => {
    const MemoItem = memo(Item)
    expect(MemoItem.styleSheets).toEqual(Item.styleSheets)
    expect(Object.isFrozen(MemoItem.styleSheets)).toBeTrue()
  })
})
