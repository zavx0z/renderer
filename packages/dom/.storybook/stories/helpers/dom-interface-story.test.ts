/** Renderer-owned external Storybook story support. */
import {describe, expect, test} from "bun:test"
import {
  createDocument,
  HTMLButtonElement,
  HTMLDivElement,
  HTMLElement,
  HTMLFieldSetElement,
  HTMLHeadingElement,
  HTMLImageElement,
  HTMLInputElement,
  HTMLLabelElement,
  HTMLLegendElement,
  HTMLLIElement,
  HTMLMeterElement,
  HTMLOptionElement,
  HTMLParagraphElement,
  HTMLProgressElement,
  HTMLSelectElement,
  HTMLSpanElement,
  HTMLTableCellElement,
  HTMLTableElement,
  HTMLTableRowElement,
  HTMLTableSectionElement,
  HTMLTextAreaElement,
  HTMLUListElement,
} from "@zavx0z/dom"
import {
  createDomInterfaceStory,
  DOM_INTERFACE_API_NAMES,
  domInterfaceStoryCss,
} from "./dom-interface-story.ts"

const implementedInterfaces = Object.freeze([
  "EventTarget",
  "Node",
  "Document",
  "DocumentFragment",
  "CharacterData",
  "Text",
  "Comment",
  "NodeList",
  "DOMTokenList",
  "Element",
  "HTMLElement",
  "HTMLDivElement",
  "HTMLSpanElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLImageElement",
  "HTMLSelectElement",
  "HTMLOptionElement",
  "HTMLProgressElement",
  "HTMLMeterElement",
  "HTMLTextAreaElement",
  "HTMLLabelElement",
  "HTMLFieldSetElement",
  "HTMLLegendElement",
  "HTMLUListElement",
  "HTMLLIElement",
  "HTMLHeadingElement",
  "HTMLParagraphElement",
  "HTMLTableElement",
  "HTMLTableSectionElement",
  "HTMLTableRowElement",
  "HTMLTableCellElement",
  "Event",
  "CustomEvent",
  "ToggleEvent",
  "UIEvent",
  "FocusEvent",
  "MouseEvent",
  "PointerEvent",
  "WheelEvent",
  "KeyboardEvent",
  "InputEvent",
  "CompositionEvent",
] as const)

const htmlSamples = Object.freeze([
  ["HTMLDivElement", HTMLDivElement, ".dom-interface-story__sample"],
  ["HTMLSpanElement", HTMLSpanElement, ".dom-interface-story__sample"],
  ["HTMLButtonElement", HTMLButtonElement, ".dom-interface-story__sample"],
  ["HTMLInputElement", HTMLInputElement, ".dom-interface-story__sample"],
  ["HTMLImageElement", HTMLImageElement, ".dom-interface-story__sample"],
  ["HTMLSelectElement", HTMLSelectElement, ".dom-interface-story__sample"],
  ["HTMLOptionElement", HTMLOptionElement, "option.dom-interface-story__sample"],
  ["HTMLProgressElement", HTMLProgressElement, ".dom-interface-story__sample"],
  ["HTMLMeterElement", HTMLMeterElement, ".dom-interface-story__sample"],
  ["HTMLTextAreaElement", HTMLTextAreaElement, ".dom-interface-story__sample"],
  ["HTMLLabelElement", HTMLLabelElement, ".dom-interface-story__sample"],
  ["HTMLFieldSetElement", HTMLFieldSetElement, ".dom-interface-story__sample"],
  ["HTMLLegendElement", HTMLLegendElement, "legend.dom-interface-story__sample"],
  ["HTMLUListElement", HTMLUListElement, ".dom-interface-story__sample"],
  ["HTMLLIElement", HTMLLIElement, "li.dom-interface-story__sample"],
  ["HTMLHeadingElement", HTMLHeadingElement, ".dom-interface-story__sample"],
  ["HTMLParagraphElement", HTMLParagraphElement, ".dom-interface-story__sample"],
  ["HTMLTableElement", HTMLTableElement, "table.dom-interface-story__sample"],
  ["HTMLTableSectionElement", HTMLTableSectionElement, "tbody.dom-interface-story__sample"],
  ["HTMLTableRowElement", HTMLTableRowElement, "tr.dom-interface-story__sample"],
  ["HTMLTableCellElement", HTMLTableCellElement, "th.dom-interface-story__sample"],
] as const)

function story(apiName: string) {
  return createDomInterfaceStory(createDocument(), {
    apiName,
    title: apiName,
    route: `dom/interfaces/${apiName}`,
  })
}

function hierarchy(apiName: string): string {
  return story(apiName).element.querySelector(".dom-interface-story__chain")?.textContent ?? ""
}

describe("DOM interface Storybook stories", () => {
  test("covers every implemented runtime interface with one exact descriptor story", () => {
    expect(implementedInterfaces).toHaveLength(43)
    expect(DOM_INTERFACE_API_NAMES).toEqual(implementedInterfaces)
    for (const apiName of implementedInterfaces) {
      const current = story(apiName)
      expect(current.element).toBeInstanceOf(HTMLElement)
      expect(current.element.getAttribute("data-interface")).toBe(apiName)
      expect(current.element.textContent).toContain(apiName)
      expect(current.source.css).toBe(domInterfaceStoryCss)
      expect(current.source.typescript).toContain('from "@zavx0z/dom"')
      expect(current.source.typescript.length).toBeGreaterThan(40)
    }
  })

  test("creates every exact HTML prototype from its standard tag", () => {
    for (const [apiName, prototype, selector] of htmlSamples) {
      const current = story(apiName)
      expect(current.element.querySelector(selector), apiName).toBeInstanceOf(prototype)
      expect(current.element.textContent, apiName)
        .toContain("EventTarget→Node→Element→HTMLElement")
      expect(current.element.textContent, apiName).toContain(apiName)
    }
  })

  test("emits executable TypeScript syntax for all interface samples", () => {
    const transpiler = new Bun.Transpiler({loader: "ts"})
    for (const apiName of implementedInterfaces) {
      expect(() => transpiler.transformSync(story(apiName).source.typescript), apiName).not.toThrow()
    }
  })

  test("shows exact non-HTML and Event hierarchy without fabricated inheritance", () => {
    expect(hierarchy("EventTarget")).toBe("EventTarget")
    expect(hierarchy("Node")).toBe("EventTarget→Node")
    expect(hierarchy("Document")).toBe("EventTarget→Node→Document")
    expect(hierarchy("Text")).toBe("EventTarget→Node→CharacterData→Text")
    expect(hierarchy("NodeList")).toBe("NodeList")
    expect(hierarchy("Event")).toBe("Event")
    expect(hierarchy("CustomEvent")).toBe("Event→CustomEvent")
    expect(hierarchy("PointerEvent")).toBe("Event→UIEvent→MouseEvent→PointerEvent")
    expect(hierarchy("KeyboardEvent")).toBe("Event→UIEvent→KeyboardEvent")
  })

  test("documents title at the HTMLElement level with a live reflected attribute", () => {
    const current = createDomInterfaceStory(createDocument(), {
      apiName: "HTMLElement",
      title: "HTMLElement · title",
      route: "dom/interfaces/html-element/title/default",
    })
    const sample = current.element.querySelector(".dom-interface-story__sample")
    expect(sample).toBeInstanceOf(HTMLElement)
    expect((sample as HTMLElement).title).toBe("HTMLElement.title")
    expect(current.element.textContent).toContain("title находится именно здесь")
    expect(current.source.html).toContain('title="HTMLElement.title"')
    expect(current.source.typescript).toContain('node.title = "HTMLElement.title"')
  })

  test("uses only implemented bounded members in specialized samples", () => {
    const image = story("HTMLImageElement").source.typescript
    expect(image).toContain("node.src")
    expect(image).toContain("node.alt")
    expect(image).not.toContain("naturalWidth")
    expect(image).not.toContain("complete")
    expect(image).not.toContain("decode(")

    const label = story("HTMLLabelElement").source.typescript
    expect(label).toContain("node.htmlFor")
    expect(label).toContain("node.control")
    expect(label).not.toContain("node.form")

    const fieldset = story("HTMLFieldSetElement").source.typescript
    expect(fieldset).toContain("node.disabled")
    expect(fieldset).toContain("node.name")
    expect(fieldset).not.toContain("validity")

    const table = story("HTMLTableCellElement").source.typescript
    expect(table).toContain("cell.colSpan")
    expect(table).toContain("cell.scope")
    expect(table).not.toContain("insertRow")
    expect(table).not.toContain("cellIndex")

    expect(story("PointerEvent").source.typescript).not.toContain("setPointerCapture")
    expect(story("NodeList").source.typescript).toContain("querySelectorAll")
    expect(story("DOMTokenList").source.typescript).toContain("classList.toggle")
  })

  test("fails closed instead of substituting HTMLElement for an unsupported name", () => {
    expect(() => story("HTMLUnknownElement")).toThrow("Unsupported DOM interface story: HTMLUnknownElement")
  })
})
