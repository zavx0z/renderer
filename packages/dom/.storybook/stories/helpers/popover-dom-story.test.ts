/** Renderer-owned external Storybook story support. */
import {describe, expect, test} from "bun:test"
import {
  HTMLButtonElement,
  HTMLLIElement,
  HTMLUListElement,
  MouseEvent,
  createDocument,
  getPopoverVisibilityState,
} from "@zavx0z/dom"
import {
  createPopoverDomStory,
  isPopoverDomStoryRoute,
  popoverDomStoryCss,
} from "./popover-dom-story.ts"
import {POPOVER_DOM_STORY_ROUTES} from "./dom-routes.ts"

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5))
}

describe("DOM popover and compound select stories", () => {
  test("covers exactly the five remaining routes with stable executable sources", async () => {
    expect(POPOVER_DOM_STORY_ROUTES).toEqual([
      "elements/primitives/popover/state/closed",
      "elements/primitives/popover/state/open",
      "elements/primitives/select/state/open",
      "elements/primitives/select/state/header",
      "elements/primitives/select/state/flipped",
    ])
    for (const route of POPOVER_DOM_STORY_ROUTES) {
      const story = createPopoverDomStory(createDocument(), route)
      expect(isPopoverDomStoryRoute(route), route).toBeTrue()
      expect(story.element.localName, route).toBe("section")
      expect(story.source.html, route).toContain('popover="manual"')
      expect(story.source.css, route).toBe(popoverDomStoryCss)
      expect(story.source.typescript, route).toContain('from "@zavx0z/dom"')
      expect(story.source.typescript, route).toContain("showPopover")
      expect(Object.isFrozen(story.source), route).toBeTrue()
      expect(Object.isFrozen(story.refs), route).toBeTrue()
      story.dispose()
    }
    expect(isPopoverDomStoryRoute("elements/primitives/select/state/inactive")).toBeFalse()

    const source = await Bun.file(new URL("./popover-dom-story.ts", import.meta.url)).text()
    for (const forbidden of [
      "@layout/core",
      "@ui/elements",
      "@zavx0z/renderer",
      "UiSurface",
      "RenderHost",
    ]) {
      expect(source).not.toContain(forbidden)
    }
    expect(popoverDomStoryCss).not.toContain("&")
  })

  test("uses standard popover state for closed and open variants", async () => {
    const closedDocument = createDocument()
    const closed = createPopoverDomStory(
      closedDocument,
      "elements/primitives/popover/state/closed",
    )
    closedDocument.appendChild(closed.element)
    await nextTask()
    expect(closed.refs.trigger).toBeInstanceOf(HTMLButtonElement)
    expect(closed.refs.popover.popover).toBe("manual")
    expect(closed.refs.popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(closed.refs.trigger.getAttribute("aria-expanded")).toBe("false")

    const openDocument = createDocument()
    const open = createPopoverDomStory(
      openDocument,
      "elements/primitives/popover/state/open",
    )
    openDocument.appendChild(open.element)
    await nextTask()
    expect(open.refs.popover[getPopoverVisibilityState]()).toBe("showing")
    expect(open.refs.trigger.getAttribute("aria-expanded")).toBe("true")
    expect(open.refs.trigger.getAttribute("popovertarget")).toBe(open.refs.popover.id)
    expect(open.refs.popover.querySelector('[role="dialog"]')).not.toBeNull()

    const trigger = open.refs.trigger
    const popover = open.refs.popover
    const message = popover.firstElementChild
    const source = open.source
    trigger.click()
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    trigger.click()
    expect(popover[getPopoverVisibilityState]()).toBe("showing")
    expect(open.refs.trigger).toBe(trigger)
    expect(open.refs.popover).toBe(popover)
    expect(popover.firstElementChild).toBe(message)
    expect(open.source).toBe(source)

    open.dispose()
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    trigger.click()
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    closed.dispose()
    await nextTask()
  })

  test("models open, header and flipped select states as button plus popover listbox", async () => {
    for (const route of [
      "elements/primitives/select/state/open",
      "elements/primitives/select/state/header",
      "elements/primitives/select/state/flipped",
    ] as const) {
      const document = createDocument()
      const story = createPopoverDomStory(document, route)
      document.appendChild(story.element)
      await nextTask()

      expect(story.refs.trigger, route).toBeInstanceOf(HTMLButtonElement)
      expect(story.refs.trigger.getAttribute("aria-haspopup"), route).toBe("listbox")
      expect(story.element.querySelector("select"), route).toBeNull()
      expect(story.refs.listbox, route).toBeInstanceOf(HTMLUListElement)
      expect(story.refs.listbox?.getAttribute("role"), route).toBe("listbox")
      expect(story.refs.options, route).toHaveLength(4)
      expect(story.refs.options.every((option) => option instanceof HTMLLIElement), route).toBeTrue()
      expect(story.refs.options.every((option) => option.getAttribute("role") === "option"), route).toBeTrue()
      expect(story.refs.options.find((option) => option.getAttribute("aria-selected") === "true")?.textContent, route)
        .toBe("Умножение")
      expect(story.refs.popover[getPopoverVisibilityState](), route).toBe("showing")
      expect(story.refs.popover.getAttribute("data-placement"), route)
        .toBe(route.endsWith("/flipped") ? "above" : "below")
      expect(story.refs.popover.querySelector("header")?.textContent ?? null, route)
        .toBe(route.endsWith("/header") || route.endsWith("/flipped") ? "Операция" : null)

      story.dispose()
      await nextTask()
    }
  })

  test("updates one retained selection and closes the same popover", async () => {
    const document = createDocument()
    const story = createPopoverDomStory(
      document,
      "elements/primitives/select/state/header",
    )
    document.appendChild(story.element)
    await nextTask()
    const trigger = story.refs.trigger
    const popover = story.refs.popover
    const listbox = story.refs.listbox
    const options = [...story.refs.options]
    const selected = options.find((option) => option.getAttribute("data-value") === "subtract")!

    selected.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true}))
    expect(trigger.textContent).toContain("Вычитание")
    expect(selected.getAttribute("aria-selected")).toBe("true")
    expect(options.filter((option) => option.getAttribute("aria-selected") === "true")).toEqual([selected])
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(story.refs.trigger).toBe(trigger)
    expect(story.refs.popover).toBe(popover)
    expect(story.refs.listbox).toBe(listbox)
    expect(story.refs.options).toEqual(options)

    trigger.click()
    expect(popover[getPopoverVisibilityState]()).toBe("showing")
    expect(story.refs.options).toEqual(options)
    story.dispose()
    await nextTask()
  })
})
