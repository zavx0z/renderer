/** Renderer-owned external Storybook story support. */
import {describe, expect, test} from "bun:test"
import {createDocument, HTMLButtonElement, HTMLInputElement, HTMLSelectElement} from "@zavx0z/dom"
import {
  createElementDomStory,
} from "./element-dom-story.ts"
import {ELEMENT_DOM_STORY_ROUTES} from "./dom-routes.ts"

describe("standard DOM replacements for old Elements stories", () => {
  test("creates every declared exact route without retained UI owners", async () => {
    for (const route of ELEMENT_DOM_STORY_ROUTES) {
      const story = createElementDomStory(createDocument(), route)
      expect(story.element.localName, route).toBe("section")
      expect(story.source.html, route).toContain("element-dom-story")
      expect(story.source.typescript, route).toContain('from "@zavx0z/dom"')
      expect(story.componentRoot.readStyleSheets().styleSheets.length, route).toBeGreaterThan(0)
      expect(story.componentRoot.readStyleSheets().styleSheets.every(sheet =>
        sheet.source?.kind === "authored-css"), route).toBeTrue()
    }
    const source = await Bun.file(new URL("./element-dom-story.ts", import.meta.url)).text()
    for (const forbidden of ["@layout/core", "@ui/elements", "UiSurface", "surface,"]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("uses exact standard controls for button, input and select routes", () => {
    const button = createElementDomStory(createDocument(), "elements/primitives/button/state/clickable")
    const input = createElementDomStory(createDocument(), "elements/primitives/input/state/active")
    const select = createElementDomStory(createDocument(), "elements/primitives/select/state/disabled")
    expect(button.element.querySelector('[data-element-sample="button"]')).toBeInstanceOf(HTMLButtonElement)
    expect(input.element.querySelector('[data-element-sample="input"]')).toBeInstanceOf(HTMLInputElement)
    const selectElement = select.element.querySelector('[data-element-sample="select"]')
    expect(selectElement).toBeInstanceOf(HTMLSelectElement)
    expect((selectElement as HTMLSelectElement).disabled).toBeTrue()
  })

  test("builds actual overflow and listbox trees instead of manual scrollbar callbacks", () => {
    const scroll = createElementDomStory(createDocument(), "elements/primitives/div/scroll/both")
    const list = createElementDomStory(createDocument(), "elements/primitives/list/mode/interactive")
    expect(scroll.element.querySelector('[data-element-sample="div"]')?.textContent).toContain("Overflow")
    expect(list.element.querySelector('[role="listbox"]')).not.toBeNull()
    expect(list.element.querySelector('[aria-selected="true"]')?.textContent).toBe("Item 2")
  })
})
