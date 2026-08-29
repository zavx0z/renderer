/** Renderer-owned external Storybook story support. */
import {describe, expect, test} from "bun:test"
import {createDocument, HTMLButtonElement, HTMLInputElement, HTMLSelectElement} from "@zavx0z/dom"
import {
  createElementDomStory,
  elementDomStoryCss,
} from "./element-dom-story.ts"
import {ELEMENT_DOM_STORY_ROUTES} from "./dom-routes.ts"

describe("standard DOM replacements for old Elements stories", () => {
  test("creates every declared exact route without retained UI owners", async () => {
    for (const route of ELEMENT_DOM_STORY_ROUTES) {
      const story = createElementDomStory(createDocument(), route)
      expect(story.element.localName, route).toBe("section")
      expect(story.element.childNodes.length, route).toBe(1)
      expect(story.source.html, route).toContain("element-dom-story")
      expect(story.source.css, route).toBe(elementDomStoryCss)
      expect(story.source.typescript, route).toContain('from "@zavx0z/dom"')
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
    expect(button.element.firstChild).toBeInstanceOf(HTMLButtonElement)
    expect(input.element.firstChild).toBeInstanceOf(HTMLInputElement)
    expect(select.element.firstChild).toBeInstanceOf(HTMLSelectElement)
    expect((select.element.firstChild as HTMLSelectElement).disabled).toBeTrue()
  })

  test("builds actual overflow and listbox trees instead of manual scrollbar callbacks", () => {
    const scroll = createElementDomStory(createDocument(), "elements/primitives/div/scroll/both")
    const list = createElementDomStory(createDocument(), "elements/primitives/list/mode/interactive")
    expect(scroll.element.querySelector(".element-dom-story__scroll-content")).not.toBeNull()
    expect(list.element.querySelector('[role="listbox"]')).not.toBeNull()
    expect(list.element.querySelector('[aria-selected="true"]')?.textContent).toBe("Item 2")
  })
})
