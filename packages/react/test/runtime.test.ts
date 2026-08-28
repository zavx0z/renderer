import {describe, expect, it} from "bun:test"
import {
  Event,
  HTMLInputElement,
  HTMLOptionElement,
  HTMLSelectElement,
  HTMLTextAreaElement,
  Node,
  Text,
  createDocument
} from "@zavx0z/dom"
import {
  HookContractError,
  UnsupportedReactFeatureError,
  createRoot,
  defineStyles,
  reactCompatibility,
  useCallback,
  useTransition,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type StateDispatch
} from "../src/index.ts"
import {
  bindEvent,
  bindProperty,
  bindRef,
  bindStyle,
  bindText,
  defineCompiledTemplate,
  writeBinding
} from "@zavx0z/template/compiled"
import type {CallbackRef} from "../src/composition.ts"

describe("compiled component runtime", () => {
  it("reruns ordinary derived locals and preserves exact host/Text identity", () => {
    let mounts = 0
    let renders = 0
    let setCount: StateDispatch<number> | null = null
    const template = defineCompiledTemplate<{label: string}>({
      bindingCount: 1,
      displayName: "DerivedCounter",
      mount(document) {
        mounts += 1
        const span = document.createElement("span")
        const text = document.createTextNode("")
        span.appendChild(text)
        return {bindings: [bindText(text)], nodes: [span]}
      },
      render(props, values) {
        renders += 1
        const [count, dispatch] = useState(1)
        setCount = dispatch
        const doubled = count * 2
        writeBinding(values, 0, `${props.label}:${doubled}`)
      }
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {label: "A"})
    const span = semanticRoot.querySelector("span")!
    const text = span.firstChild as Text
    expect(text.data).toBe("A:2")
    expect(renders).toBe(1)

    setCount!(2)
    expect(span.firstChild).toBe(text)
    expect(semanticRoot.querySelector("span")).toBe(span)
    expect(text.data).toBe("A:4")
    expect(renders).toBe(2)

    root.render(template, {label: "B"})
    expect(semanticRoot.querySelector("span")).toBe(span)
    expect(span.firstChild).toBe(text)
    expect(text.data).toBe("B:4")
    expect(renders).toBe(3)
    expect(mounts).toBe(1)
  })

  it("keeps dispatch, ref, callback and id stable and batches one root render", () => {
    let firstDispatch: StateDispatch<number> | null = null
    let latestDispatch: StateDispatch<number> | null = null
    let firstRef: {current: number} | null = null
    let latestRef: {current: number} | null = null
    let firstCallback: (() => number) | null = null
    let latestCallback: (() => number) | null = null
    let firstId = ""
    let latestId = ""
    let renders = 0
    const template = textTemplate(() => {
      renders += 1
      const [count, dispatch] = useState(0)
      const reference = useRef(7)
      const callback = useCallback(() => count, [count])
      const id = useId()
      firstDispatch ??= dispatch
      latestDispatch = dispatch
      firstRef ??= reference
      latestRef = reference
      firstCallback ??= callback
      latestCallback = callback
      firstId ||= id
      latestId = id
      return String(count)
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {})
    root.batch(() => {
      latestDispatch!(1)
      latestDispatch!(previous => previous + 1)
    })

    expect(semanticRoot.textContent).toBe("2")
    expect(renders).toBe(2)
    expect(latestDispatch).toBe(firstDispatch)
    expect(latestRef).toBe(firstRef)
    expect(latestId).toBe(firstId)
    expect(latestCallback).not.toBe(firstCallback)
    expect(latestCallback!()).toBe(2)
  })

  it("implements reducer and memo dependencies with Object.is semantics", () => {
    let dispatch: ((amount: number) => void) | null = null
    let memoRuns = 0
    let renders = 0
    const template = textTemplate((props: {factor: number}) => {
      renders += 1
      const [count, send] = useReducer((state: number, amount: number) => state + amount, 1)
      dispatch = send
      const result = useMemo(() => {
        memoRuns += 1
        return count * props.factor
      }, [count, props.factor])
      return result
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {factor: 2})
    root.render(template, {factor: 2})
    expect(memoRuns).toBe(1)
    dispatch!(2)
    expect(semanticRoot.textContent).toBe("6")
    expect(memoRuns).toBe(2)
    expect(renders).toBe(3)
  })

  it("keeps state committed and its O(1) queued update retryable after render failure", () => {
    let dispatch: StateDispatch<number> | null = null
    const template = textTemplate((props: {allow: boolean}) => {
      const [value, setValue] = useState(0)
      dispatch = setValue
      if (value === 1 && !props.allow) throw new Error("state render blocked")
      return value
    }, "StateRetry")
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {allow: false})
    const text = semanticRoot.childNodes[1]
    expect(() => dispatch!(value => value + 1)).toThrow("state render blocked")
    expect(semanticRoot.childNodes[1]).toBe(text)
    expect(semanticRoot.textContent).toBe("0")

    root.render(template, {allow: true})
    expect(semanticRoot.childNodes[1]).toBe(text)
    expect(semanticRoot.textContent).toBe("1")
    root.render(template, {allow: true})
    expect(semanticRoot.textContent).toBe("1")
  })

  it("keeps reducer state committed and its queued action retryable after failure", () => {
    let dispatch: ((amount: number) => void) | null = null
    const template = textTemplate((props: {allow: boolean}) => {
      const [value, send] = useReducer((state: number, amount: number) => state + amount, 0)
      dispatch = send
      if (value === 2 && !props.allow) throw new Error("reducer render blocked")
      return value
    }, "ReducerRetry")
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {allow: false})
    const text = semanticRoot.childNodes[1]
    expect(() => dispatch!(2)).toThrow("reducer render blocked")
    expect(semanticRoot.childNodes[1]).toBe(text)
    expect(semanticRoot.textContent).toBe("0")

    root.render(template, {allow: true})
    expect(semanticRoot.childNodes[1]).toBe(text)
    expect(semanticRoot.textContent).toBe("2")
    root.render(template, {allow: true})
    expect(semanticRoot.textContent).toBe("2")
  })

  it("uses one stable event proxy while the current closure changes", () => {
    const calls: string[] = []
    const template = defineCompiledTemplate<{label: string}>({
      bindingCount: 2,
      displayName: "StableEvent",
      mount(document) {
        const button = document.createElement("button")
        const text = document.createTextNode("")
        button.appendChild(text)
        return {bindings: [bindText(text), bindEvent(button, "click")], nodes: [button]}
      },
      render(props, values) {
        writeBinding(values, 0, props.label)
        writeBinding(values, 1, () => calls.push(props.label))
      }
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {label: "first"})
    const button = semanticRoot.querySelector("button")!
    button.dispatchEvent(new Event("click"))
    root.render(template, {label: "second"})
    button.dispatchEvent(new Event("click"))

    expect(semanticRoot.querySelector("button")).toBe(button)
    expect(calls).toEqual(["first", "second"])
    root.unmount()
    button.dispatchEvent(new Event("click"))
    expect(calls).toEqual(["first", "second"])
  })

  it("supports callback ref cleanup returns and avoids churn for an identical ref", () => {
    const events: string[] = []
    const first: CallbackRef = target => {
      if (!target) {
        events.push("first:null")
        return
      }
      events.push("first:attach")
      return () => events.push("first:cleanup")
    }
    const second: CallbackRef = target => {
      if (target) events.push("second:attach")
      else events.push("second:null")
    }
    const template = defineCompiledTemplate<{reference: CallbackRef}>({
      bindingCount: 1,
      displayName: "CallbackRef",
      mount(document) {
        const div = document.createElement("div")
        return {bindings: [bindRef(div)], nodes: [div]}
      },
      render(props, values) {
        writeBinding(values, 0, props.reference)
      }
    })
    const {root} = mountedRoot()

    root.render(template, {reference: first})
    root.render(template, {reference: first})
    root.render(template, {reference: second})
    root.unmount()

    expect(events).toEqual([
      "first:attach",
      "first:cleanup",
      "second:attach",
      "second:null"
    ])
  })

  it("attaches refs only after connection and cleans the old replacement before new attach", () => {
    const events: string[] = []
    const referencedTemplate = (name: string) => defineCompiledTemplate<Record<string, never>>({
      bindingCount: 1,
      displayName: name,
      mount(document) {
        const div = document.createElement("div")
        div.id = name
        return {bindings: [bindRef(div)], nodes: [div]}
      },
      render(_props, values) {
        writeBinding(values, 0, (target: Node | null) => {
          if (!target) return
          events.push(`${name}:attach:${target.isConnected}`)
          return () => events.push(`${name}:cleanup:${target.isConnected}`)
        })
      }
    })
    const {root, semanticRoot} = mountedRoot()
    const first = referencedTemplate("first")
    const second = referencedTemplate("second")

    root.render(first, {})
    expect(events).toEqual(["first:attach:true"])
    expect(semanticRoot.querySelector("#first")?.isConnected).toBe(true)
    root.render(second, {})

    expect(events).toEqual([
      "first:attach:true",
      "first:cleanup:false",
      "second:attach:true"
    ])
    expect(semanticRoot.querySelector("#second")?.isConnected).toBe(true)
  })

  it("fails closed on hook order/count changes and keeps the committed DOM", () => {
    const template = defineCompiledTemplate<{extra: boolean}>({
      bindingCount: 1,
      displayName: "ConditionalHooks",
      mount(document) {
        const text = document.createTextNode("")
        return {bindings: [bindText(text)], nodes: [text]}
      },
      render(props, values) {
        const [value] = useState("committed")
        if (props.extra) useRef(null)
        writeBinding(values, 0, props.extra ? "broken" : value)
      }
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {extra: false})
    const text = semanticRoot.childNodes[1]
    expect(() => root.render(template, {extra: true})).toThrow(HookContractError)
    expect(semanticRoot.childNodes[1]).toBe(text)
    expect(semanticRoot.textContent).toBe("committed")
  })

  it("bounds render-phase updates", () => {
    const template = textTemplate(() => {
      const [value, setValue] = useState(0)
      setValue(value + 1)
      return value
    })
    const {root, semanticRoot} = mountedRoot()

    expect(() => root.render(template, {})).toThrow("exceeded 25 render-phase updates")
    expect(semanticRoot.childNodes.length).toBe(0)
  })

  it("stages replacement and binding validation before touching the committed region", () => {
    const good = textTemplate(() => "stable", "Good")
    const badRender = defineCompiledTemplate<Record<string, never>>({
      bindingCount: 2,
      displayName: "BadRender",
      mount(document) {
        const div = document.createElement("div")
        const text = document.createTextNode("")
        div.appendChild(text)
        return {bindings: [bindText(text), bindProperty(div, "payload")], nodes: [div]}
      },
      render(_props, values) {
        writeBinding(values, 0, "not committed")
        writeBinding(values, 1, {unsupported: true})
      }
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(good, {})
    const committed = semanticRoot.childNodes[1]
    expect(() => root.render(badRender, {})).toThrow("requires a primitive value")
    expect(semanticRoot.childNodes[1]).toBe(committed)
    expect(semanticRoot.textContent).toBe("stable")
  })

  it("validates a same-instance property render before changing committed bindings", () => {
    const template = defineCompiledTemplate<{payload: unknown}>({
      bindingCount: 2,
      displayName: "PropertyRollback",
      mount(document) {
        const div = document.createElement("div")
        const text = document.createTextNode("")
        div.appendChild(text)
        return {
          bindings: [bindText(text), bindProperty(div, "data-payload")],
          nodes: [div]
        }
      },
      render(props, values) {
        writeBinding(values, 0, String(props.payload))
        writeBinding(values, 1, props.payload)
      }
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {payload: "committed"})
    const div = semanticRoot.querySelector("div")!
    const text = div.firstChild
    expect(() => root.render(template, {payload: {invalid: true}})).toThrow(
      "requires a primitive value"
    )
    expect(semanticRoot.querySelector("div")).toBe(div)
    expect(div.firstChild).toBe(text)
    expect(div.textContent).toBe("committed")
    expect(div.getAttribute("data-payload")).toBe("committed")
  })

  it("uses template and key identity to decide state preservation", () => {
    let dispatch: StateDispatch<number> | null = null
    const template = textTemplate(() => {
      const [value, setValue] = useState(0)
      dispatch = setValue
      return value
    }, "KeyedRoot")
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {}, {key: "a"})
    const firstText = semanticRoot.childNodes[1]
    dispatch!(3)
    root.render(template, {}, {key: "a"})
    expect(semanticRoot.childNodes[1]).toBe(firstText)
    expect(semanticRoot.textContent).toBe("3")

    root.render(template, {}, {key: "b"})
    expect(semanticRoot.childNodes[1]).not.toBe(firstText)
    expect(semanticRoot.textContent).toBe("0")
  })

  it("rejects cross-Document static nodes before replacement", () => {
    const good = textTemplate(() => "stable", "Good")
    const foreignDocument = createDocument()
    const bad = defineCompiledTemplate<Record<string, never>>({
      bindingCount: 0,
      displayName: "Foreign",
      mount() {
        return {bindings: [], nodes: [foreignDocument.createElement("div")]}
      },
      render() {}
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(good, {})
    const committed = semanticRoot.childNodes[1]
    expect(() => root.render(bad, {})).toThrow("cross-Document Node")
    expect(semanticRoot.childNodes[1]).toBe(committed)
    expect(semanticRoot.textContent).toBe("stable")
  })

  it("updates controlled input, textarea, select and option properties directly", () => {
    const template = defineCompiledTemplate<{
      checked: boolean
      indeterminate: boolean
      selected: boolean
      text: string
      value: string
    }>({
      bindingCount: 6,
      displayName: "ControlledFields",
      mount(document) {
        const wrapper = document.createElement("div")
        const input = document.createElement("input")
        input.type = "checkbox"
        const textarea = document.createElement("textarea")
        const select = document.createElement("select")
        const first = document.createElement("option")
        first.value = "a"
        first.textContent = "A"
        const second = document.createElement("option")
        second.value = "b"
        second.textContent = "B"
        select.append(first, second)
        wrapper.append(input, textarea, select)
        return {
          bindings: [
            bindProperty(input, "checked"),
            bindProperty(input, "indeterminate"),
            bindProperty(input, "value"),
            bindProperty(textarea, "value"),
            bindProperty(select, "value"),
            bindProperty(second, "selected")
          ],
          nodes: [wrapper]
        }
      },
      render(props, values) {
        writeBinding(values, 0, props.checked)
        writeBinding(values, 1, props.indeterminate)
        writeBinding(values, 2, props.value)
        writeBinding(values, 3, props.text)
        writeBinding(values, 4, props.value)
        writeBinding(values, 5, props.selected)
      }
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {
      checked: true,
      indeterminate: true,
      selected: true,
      text: "body",
      value: "b"
    })
    const input = semanticRoot.querySelector("input") as HTMLInputElement
    const textarea = semanticRoot.querySelector("textarea") as HTMLTextAreaElement
    const select = semanticRoot.querySelector("select") as HTMLSelectElement
    const options = select.querySelectorAll("option")
    expect(input.checked).toBe(true)
    expect(input.indeterminate).toBe(true)
    expect(input.hasAttribute("indeterminate")).toBe(false)
    expect(input.value).toBe("b")
    expect(textarea.value).toBe("body")
    expect(select.value).toBe("b")
    expect((options[1] as HTMLOptionElement).selected).toBe(true)

    root.render(template, {
      checked: true,
      indeterminate: false,
      selected: true,
      text: "body",
      value: "b"
    })
    expect(input.indeterminate).toBe(false)
    expect(input.hasAttribute("indeterminate")).toBe(false)
  })

  it("applies direct style objects and performs zero work on a clean explicit flush", () => {
    const template = defineCompiledTemplate<{opacity: number}>({
      bindingCount: 1,
      displayName: "Styled",
      mount(document) {
        const div = document.createElement("div")
        return {bindings: [bindStyle(div)], nodes: [div]}
      },
      render(props, values) {
        writeBinding(values, 0, {display: "flex", opacity: props.opacity, width: 24})
      }
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(template, {opacity: 0.5})
    expect(semanticRoot.querySelector("div")!.getAttribute("style")).toBe(
      "display: flex; opacity: 0.5; width: 24px"
    )
    expect(root.flush()).toBe(0)
    expect(root.flush()).toBe(0)
  })

  it("composes class-free owner style tokens with one caller style override", () => {
    const styles = defineStyles("runtime.fixture", {
      root: {display: "flex", ":hover": {background: "rgb(101 101 101)"}},
      selected: {background: "rgb(71 114 179)"}
    })
    const template = defineCompiledTemplate<{selected: boolean}>({
      bindingCount: 1,
      displayName: "TokenStyled",
      mount(document) {
        const button = document.createElement("button")
        return {bindings: [bindStyle(button)], nodes: [button]}
      },
      render(props, values) {
        writeBinding(values, 0, [
          styles.root,
          props.selected && styles.selected,
          {height: 22}
        ])
      }
    })
    const {root, semanticRoot} = mountedRoot()
    root.render(template, {selected: true})
    const button = semanticRoot.querySelector("button")!

    expect(button.hasAttribute(styles.root.attributeName)).toBe(true)
    expect(button.hasAttribute(styles.selected.attributeName)).toBe(true)
    expect(button.getAttribute("style")).toBe("height: 22px")
    expect(button.className).toBe("")

    root.render(template, {selected: false})
    expect(semanticRoot.querySelector("button")).toBe(button)
    expect(button.hasAttribute(styles.root.attributeName)).toBe(true)
    expect(button.hasAttribute(styles.selected.attributeName)).toBe(false)
  })

  it("exposes remaining unsupported React 19.2 hooks only as explicit throws", () => {
    expect(reactCompatibility.hooks.useTransition).toBe("unsupported")
    expect(() => useTransition()).toThrow(UnsupportedReactFeatureError)
    try {
      useTransition()
    } catch (error) {
      expect((error as UnsupportedReactFeatureError).feature).toBe("useTransition")
    }
  })
})

function mountedRoot() {
  const document = createDocument()
  const semanticRoot = document.createElement("div")
  document.appendChild(semanticRoot)
  return {document, root: createRoot(semanticRoot), semanticRoot}
}

function textTemplate<Props extends object>(
  read: (props: Readonly<Props>) => unknown,
  displayName = "TextFixture"
) {
  return defineCompiledTemplate<Props>({
    bindingCount: 1,
    displayName,
    mount(document) {
      const text = document.createTextNode("")
      return {bindings: [bindText(text)], nodes: [text]}
    },
    render(props, values) {
      writeBinding(values, 0, read(props))
    }
  })
}
