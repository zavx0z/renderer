import {describe, expect, test} from "bun:test"
import {
  Element,
  Event,
  HTMLButtonElement,
  HTMLDivElement,
  HTMLInputElement,
  PointerEvent,
  Text,
  createDocument
} from "@zavx0z/dom"
import {
  createElement,
  useState
} from "react"
import type {ReactElement, ReactNode} from "react"
import {
  createRoot,
  injectIntoDevTools
} from "../src/index.ts"

function host(
  type: string,
  props: Record<string, unknown> | null,
  ...children: ReactNode[]
): ReactElement {
  return createElement(type, props, ...children)
}

function connectedContainer(): {container: HTMLDivElement; document: ReturnType<typeof createDocument>} {
  const document = createDocument()
  const container = document.createElement("div")
  document.appendChild(container)
  return {container, document}
}

describe("@zavx0z/dom-react", () => {
  test("creates exact DOM instances and preserves identity across addressed updates", () => {
    const document = createDocument()
    const container = document.createDocumentFragment()
    const root = createRoot(container)
    let publicInstance: unknown = null

    root.render(host(
      "div",
      {
        ref: (instance: unknown) => {
          publicInstance = instance
        },
        id: "panel",
        className: "ready",
        title: "Output",
        style: {display: "flex", gap: 4, opacity: 0.5},
        "data-state": "ready",
        "aria-hidden": false,
        tabIndex: 3,
        customCount: 4
      },
      host("span", null, "first")
    ))

    const panel = container.firstChild
    expect(panel).toBeInstanceOf(HTMLDivElement)
    expect(publicInstance).toBe(panel)
    expect(panel).toBeInstanceOf(Element)
    const span = panel!.firstChild
    const text = span!.firstChild
    expect(text).toBeInstanceOf(Text)
    expect((panel as Element).getAttribute("class")).toBe("ready")
    expect((panel as Element).getAttribute("title")).toBe("Output")
    expect((panel as Element).getAttribute("style")).toBe("display: flex; gap: 4px; opacity: 0.5")
    expect((panel as Element).getAttribute("aria-hidden")).toBe("false")
    expect((panel as Element).getAttribute("customcount")).toBe("4")

    root.render(host(
      "div",
      {
        ref: (instance: unknown) => {
          publicInstance = instance
        },
        id: "panel",
        className: "updated",
        title: "Updated",
        style: "display: block; width: 120px",
        "data-state": null,
        "aria-hidden": true,
        tabIndex: -1,
        customCount: 5
      },
      host("span", null, "second")
    ))

    expect(container.firstChild).toBe(panel)
    expect(panel!.firstChild).toBe(span)
    expect(span!.firstChild).toBe(text)
    expect(text!.textContent).toBe("second")
    expect((panel as Element).getAttribute("class")).toBe("updated")
    expect((panel as Element).getAttribute("data-state")).toBeNull()
    expect((panel as Element).getAttribute("aria-hidden")).toBe("true")
    expect((panel as Element).getAttribute("style")).toBe("display: block; width: 120px")
  })

  test("flushes component state through native capture and bubble listeners", () => {
    const {container} = connectedContainer()
    const root = createRoot(container)
    const order: string[] = []
    let firstHandlerCalls = 0
    let secondHandlerCalls = 0

    function Counter(props: {onActivate: () => void}): ReactElement {
      const [count, setCount] = useState(0)
      return host(
        "div",
        {onClickCapture: () => order.push("capture")},
        host(
          "button",
          {
            title: "Increment",
            onClick: () => {
              order.push("target")
              props.onActivate()
              setCount(value => value + 1)
            }
          },
          String(count)
        )
      )
    }

    root.render(createElement(Counter, {onActivate: () => {
      firstHandlerCalls += 1
    }}))
    const wrapper = container.firstChild!
    const button = wrapper.firstChild as HTMLButtonElement
    const text = button.firstChild

    button.click()
    expect(order).toEqual(["capture", "target"])
    expect(firstHandlerCalls).toBe(1)
    expect(button.firstChild).toBe(text)
    expect(button.textContent).toBe("1")

    root.render(createElement(Counter, {onActivate: () => {
      secondHandlerCalls += 1
    }}))
    expect(container.firstChild).toBe(wrapper)
    expect(wrapper.firstChild).toBe(button)
    button.click()
    expect(firstHandlerCalls).toBe(1)
    expect(secondHandlerCalls).toBe(1)
    expect(button.textContent).toBe("2")
  })

  test("reorders keyed children with insertBefore while retaining every host instance", () => {
    const document = createDocument()
    const container = document.createDocumentFragment()
    const root = createRoot(container)
    const row = (order: readonly string[]) => host(
      "div",
      null,
      ...order.map(key => host("span", {key, "data-key": key}, key))
    )

    root.render(row(["a", "b", "c"]))
    const parent = container.firstChild!
    const byKey = new Map(parent.childNodes.map(node => [
      (node as Element).getAttribute("data-key"),
      node
    ]))

    root.render(row(["c", "a", "b"]))
    expect(parent.childNodes.map(node => (node as Element).getAttribute("data-key"))).toEqual([
      "c",
      "a",
      "b"
    ])
    expect(parent.childNodes[0]).toBe(byKey.get("c"))
    expect(parent.childNodes[1]).toBe(byKey.get("a"))
    expect(parent.childNodes[2]).toBe(byKey.get("b"))
  })

  test("maps input, pointer and focus props onto the native DOM event path", () => {
    const {container, document} = connectedContainer()
    const root = createRoot(container)
    const events: string[] = []

    function Field(): ReactElement {
      const [snapshot, setSnapshot] = useState("initial")
      return host(
        "div",
        {
          onPointerDownCapture: () => events.push("pointer-capture"),
          onFocusCapture: () => events.push("focus-capture")
        },
        host("input", {
          type: "checkbox",
          checked: true,
          value: "seed",
          disabled: false,
          placeholder: "Value",
          "data-enabled": true,
          onPointerDown: () => events.push("pointer-target"),
          onFocus: () => events.push("focus-target"),
          onInput: (event: Event) => {
            setSnapshot((event.currentTarget as HTMLInputElement).value)
          }
        }),
        host("span", null, snapshot)
      )
    }

    root.render(createElement(Field))
    const wrapper = container.firstChild!
    const input = wrapper.firstChild as HTMLInputElement
    const output = wrapper.lastChild!
    expect(input).toBeInstanceOf(HTMLInputElement)
    expect(input.type).toBe("checkbox")
    expect(input.checked).toBe(true)
    expect(input.value).toBe("seed")
    expect(input.placeholder).toBe("Value")
    expect(input.hasAttribute("disabled")).toBe(false)
    expect(input.getAttribute("data-enabled")).toBe("true")

    input.dispatchEvent(new PointerEvent("pointerdown", {bubbles: true, pointerId: 7}))
    input.focus()
    expect(document.activeElement).toBe(input)
    expect(events).toEqual([
      "pointer-capture",
      "pointer-target",
      "focus-capture",
      "focus-target"
    ])

    input.value = "typed"
    input.dispatchEvent(new Event("input", {bubbles: true}))
    expect(output.textContent).toBe("typed")
  })

  test("batches a synchronous React commit into one Document mutation batch", () => {
    const {container, document} = connectedContainer()
    const root = createRoot(container)
    const batches: number[] = []
    const unsubscribe = document.subscribeMutations(batch => batches.push(batch.records.length))

    root.render(host("div", {id: "one"}, host("span", null, "A")))
    expect(batches).toHaveLength(1)

    batches.length = 0
    root.render(host("div", {id: "two", title: "Updated"}, host("span", null, "B")))
    expect(batches).toHaveLength(1)
    expect(batches[0]).toBeGreaterThanOrEqual(3)
    unsubscribe()
  })

  test("unmount removes host children and listeners and releases the container", () => {
    const {container} = connectedContainer()
    const root = createRoot(container)
    let calls = 0
    root.render(host("button", {onClick: () => {
      calls += 1
    }}, "Run"))
    const button = container.firstChild as HTMLButtonElement

    expect(() => createRoot(container)).toThrow("already has a live React root")
    root.unmount()
    root.unmount()
    expect(container.childNodes).toHaveLength(0)
    button.click()
    expect(calls).toBe(0)
    expect(() => root.render(null)).toThrow("unmounted React root")

    const nextRoot = createRoot(container)
    nextRoot.render(host("span", null, "New root"))
    expect(container.textContent).toBe("New root")
  })

  test("fails closed for inner HTML and only exposes the reconciler DevTools hook", () => {
    const document = createDocument()
    const container = document.createDocumentFragment()
    const root = createRoot(container)
    expect(() => root.render(host("div", {
      dangerouslySetInnerHTML: {__html: "<span>unsafe</span>"}
    }))).toThrow("dangerouslySetInnerHTML is not supported")
    expect(typeof injectIntoDevTools).toBe("function")
  })
})
