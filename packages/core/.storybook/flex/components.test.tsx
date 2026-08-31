import {describe, expect, test} from "bun:test"
import {
  createDocument,
  Event,
  type Element,
  type HTMLButtonElement,
} from "@zavx0z/dom"
import {createRoot} from "@zavx0z/react"
import {isCompiledTemplate} from "@zavx0z/template/compiled"
import {
  FLEX_STORY_CHANNEL_BRAND,
  type FlexStoryChannel,
  type FlexStorySubscriber,
} from "./contract.ts"
import {FlexControlsWidget} from "./controls.tsx"
import {FlexStoryPreview} from "./preview.tsx"
import {createFlexStoryChannel} from "./store.ts"

describe("Renderer CSS Flex compiled Storybook components", () => {
  test("shares one retained channel across preview and Inspector roots", () => {
    expect(isCompiledTemplate(FlexStoryPreview)).toBeTrue()
    expect(isCompiledTemplate(FlexControlsWidget)).toBeTrue()

    const document = createDocument()
    const application = document.createElement("main")
    const previewHost = document.createElement("div")
    const controlsHost = document.createElement("aside")
    application.appendChild(previewHost)
    application.appendChild(controlsHost)
    document.appendChild(application)

    const subscription = {calls: 0, active: 0}
    const sourceChannel = createFlexStoryChannel("packing")
    const channel = observedChannel(sourceChannel, subscription)
    const previewRoot = createRoot(previewHost)
    const controlsRoot = createRoot(controlsHost)
    previewRoot.render(FlexStoryPreview as any, {channel})
    controlsRoot.render(FlexControlsWidget as any, {value: channel})

    expect(subscription).toEqual({calls: 2, active: 2})
    const preview = requiredElement(
      previewHost.querySelector("[data-flex-story-preview]"),
      "preview",
    )
    const controls = requiredElement(
      controlsHost.querySelector('[data-flex-controls-widget="live"]'),
      "controls",
    )
    for (const tag of ["fieldset", "label", "select", "option", "input", "button"]) {
      expect(preview.querySelectorAll(tag)).toHaveLength(0)
    }
    expect(controls.querySelectorAll("fieldset").length).toBeGreaterThanOrEqual(7)

    const container = requiredElement(
      preview.querySelector("[data-flex-story-container]"),
      "Flex container",
    )
    const firstItem = requiredElement(
      preview.querySelector('[data-flex-story-item="item-1"]'),
      "first item",
    )
    const secondItem = requiredElement(
      preview.querySelector('[data-flex-story-item="item-2"]'),
      "second item",
    )
    expect(container.getAttribute("data-direction")).toBe("row")
    expect(container.getAttribute("style")).toContain("flex-direction: row")
    expect(firstItem.getAttribute("data-selected")).toBe("true")
    expect(firstItem.getAttribute("aria-current")).toBe("true")
    expect(firstItem.getAttribute("aria-label")).toBe("Элемент 1, выбран")

    clickChoice(controls, "Направление (flex-direction)", "column")
    expect(preview.querySelector("[data-flex-story-container]")).toBe(container)
    expect(container.getAttribute("data-direction")).toBe("column")
    expect(container.getAttribute("style")).toContain("flex-direction: column")
    clickChoice(controls, "Раздел", "Элемент")
    expect(controls.querySelector('[data-flex-controls-group="container"]')?.hasAttribute("hidden"))
      .toBeTrue()
    expect(controls.querySelector('[data-flex-controls-group="selected-item"]')?.hasAttribute("hidden"))
      .toBeFalse()
    clickChoice(controls, "Выбранный элемент", "Элемент 2")
    expect(preview.querySelector('[data-flex-story-item="item-1"]')).toBe(firstItem)
    expect(preview.querySelector('[data-flex-story-item="item-2"]')).toBe(secondItem)
    expect(firstItem.hasAttribute("data-selected")).toBeFalse()
    expect(firstItem.hasAttribute("aria-current")).toBeFalse()
    expect(secondItem.getAttribute("data-selected")).toBe("true")
    expect(secondItem.getAttribute("aria-current")).toBe("true")

    clickChoice(controls, "Режим высоты", "auto")
    expect(secondItem.getAttribute("style")).toContain("height: auto")
    increaseNumber(controls, "Ширина элемента")
    expect(preview.querySelector('[data-flex-story-item="item-2"]')).toBe(secondItem)
    expect(secondItem.getAttribute("style")).toContain("width: 104px")

    clickChoice(controls, "Раздел", "Выравнивание")
    const alignContent = choiceButton(controls, "Строки (align-content)", "normal")
    expect(alignContent.disabled).toBeFalse()
    clickChoice(controls, "Раздел", "Основное")
    clickChoice(controls, "Перенос (flex-wrap)", "nowrap")
    clickChoice(controls, "Раздел", "Выравнивание")
    expect(choiceButton(controls, "Строки (align-content)", "normal")).toBe(alignContent)
    expect(alignContent.disabled).toBeTrue()
    expect(subscription).toEqual({calls: 2, active: 2})

    clickChoice(controls, "Раздел", "Основное")
    const reset = controls.querySelector('[aria-label="Сбросить параметры Flex"]')
    if (reset === null) throw new Error("Missing reset control")
    reset.dispatchEvent(new Event("click", {bubbles: true}))
    expect(container.getAttribute("data-direction")).toBe("row")
    expect(firstItem.getAttribute("data-selected")).toBe("true")
    expect(subscription).toEqual({calls: 2, active: 2})

    const finalSnapshot = channel.getSnapshot()
    channel.dispose()
    expect(channel.getSnapshot()).toBe(finalSnapshot)
    expect(() => previewRoot.render(FlexStoryPreview as any, {channel})).not.toThrow()
    expect(() => controlsRoot.render(FlexControlsWidget as any, {value: channel})).not.toThrow()

    controlsRoot.unmount()
    previewRoot.unmount()
    expect(subscription).toEqual({calls: 2, active: 0})
    channel.dispose()
  })

  test("renders a passive widget for foreign values and keeps construction governed", async () => {
    const document = createDocument()
    const host = document.createElement("aside")
    document.appendChild(host)
    const root = createRoot(host)
    root.render(FlexControlsWidget as any, {value: Object.freeze({})})
    expect(host.textContent).toBe("Выберите вариант CSS / Flex")
    expect(host.querySelector('[data-flex-controls-widget="passive"]')).not.toBeNull()
    root.unmount()

    const previewSource = await Bun.file(new URL("./preview.tsx", import.meta.url)).text()
    const controlsSource = await Bun.file(new URL("./controls.tsx", import.meta.url)).text()
    for (const token of [
      "createElement(",
      "getBoundingClientRect(",
      "offsetWidth",
      "offsetHeight",
      "position: absolute",
      "style={{",
      "style={[",
    ]) expect(previewSource).not.toContain(token)
    for (const token of ["<fieldset", "<output", "<button"]) {
      expect(previewSource).not.toContain(token)
      expect(controlsSource).toContain(token)
    }
    expect(controlsSource).not.toContain("<input")
    expect(controlsSource).not.toContain("<select")
    expect(controlsSource).not.toContain("<option")
    expect(controlsSource).not.toContain("valueAsNumber")
    expect(controlsSource).not.toMatch(/\bNumber\s*\(/u)
    expect(controlsSource).not.toContain("@ui/components")
    expect(controlsSource).toContain("useSyncExternalStore")
    expect(previewSource).toContain("useSyncExternalStore")
  })
})

function observedChannel(
  channel: FlexStoryChannel,
  subscription: {calls: number; active: number},
): FlexStoryChannel {
  return Object.freeze({
    [FLEX_STORY_CHANNEL_BRAND]: true as const,
    protocol: channel.protocol,
    version: channel.version,
    getSnapshot: channel.getSnapshot,
    subscribe(subscriber: FlexStorySubscriber): () => void {
      subscription.calls += 1
      subscription.active += 1
      const unsubscribe = channel.subscribe(subscriber)
      let active = true
      return () => {
        if (!active) return
        active = false
        subscription.active -= 1
        unsubscribe()
      }
    },
    dispatch: channel.dispatch,
    reset: channel.reset,
    dispose: channel.dispose,
  })
}

function requiredElement(value: Element | null, label: string): Element {
  if (value === null) throw new Error(`Missing ${label}`)
  return value
}

function choiceButton(root: Element, label: string, choice: string): HTMLButtonElement {
  const value = root.querySelector(
    `button[aria-label="${label}: ${choice}"]`,
  ) as HTMLButtonElement | null
  if (value === null) throw new Error(`Missing choice control: ${label}: ${choice}`)
  return value
}

function clickChoice(root: Element, label: string, choice: string): void {
  choiceButton(root, label, choice).dispatchEvent(new Event("click", {bubbles: true}))
}

function increaseNumber(root: Element, label: string): void {
  const button = root.querySelector(
    `button[aria-label="Увеличить: ${label}"]`,
  ) as HTMLButtonElement | null
  if (button === null) throw new Error(`Missing numeric step control: ${label}`)
  button.dispatchEvent(new Event("click", {bubbles: true}))
}
