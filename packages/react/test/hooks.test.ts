import {describe, expect, it} from "bun:test"
import {Text, createDocument} from "@zavx0z/dom"
import {
  HookContractError,
  component,
  createContext,
  createRoot,
  memo,
  provideContext,
  useContext,
  useDebugValue,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ComponentValue,
  type RefCallback,
  type StateDispatch
} from "../src/index.ts"
import {
  bindChild,
  bindRef,
  bindText,
  defineCompiledTemplate,
  writeBinding
} from "@zavx0z/template/compiled"

describe("compiled React-shaped hooks", () => {
  it("propagates closest context values through memo ancestors and preserves fallback", () => {
    const Theme = createContext("fallback")
    let leafRenders = 0
    let passThroughRenders = 0
    const Leaf = memo(textTemplate("ContextLeaf", () => {
      leafRenders += 1
      return useContext(Theme)
    }))
    const PassThrough = memo(childTemplate("ContextPassThrough", () => {
      passThroughRenders += 1
      return component(Leaf, {}, "leaf")
    }))
    const Provider = childTemplate<{theme: string}>("ContextProvider", props =>
      provideContext(Theme, props.theme, component(PassThrough, {}, "pass"))
    )
    const fallbackRoot = mountedRoot()
    fallbackRoot.root.render(Leaf, {})
    expect(fallbackRoot.semanticRoot.textContent).toBe("fallback")

    const {root, semanticRoot} = mountedRoot()
    root.render(Provider, {theme: "dark"})
    const text = semanticRoot.querySelector("span")!.firstChild as Text
    expect(text.data).toBe("dark")
    root.render(Provider, {theme: "light"})
    expect(semanticRoot.querySelector("span")!.firstChild).toBe(text)
    expect(text.data).toBe("light")
    expect(leafRenders).toBe(3)
    expect(passThroughRenders).toBe(2)

    root.render(Provider, {theme: "light"})
    expect(leafRenders).toBe(3)
    expect(passThroughRenders).toBe(2)
  })

  it("keeps committed context and descendants unchanged when preparation fails", () => {
    const Theme = createContext("fallback")
    const Leaf = textTemplate<{fail: boolean}>("FallibleContextLeaf", props => {
      const theme = useContext(Theme)
      if (props.fail) throw new Error("context render failed")
      return theme
    })
    const Provider = childTemplate<{fail: boolean; theme: string}>("FallibleProvider", props =>
      provideContext(
        Theme,
        props.theme,
        component(Leaf, {fail: props.fail}, "leaf")
      )
    )
    const {root, semanticRoot} = mountedRoot()

    root.render(Provider, {fail: false, theme: "dark"})
    const text = semanticRoot.querySelector("span")!.firstChild
    expect(() => root.render(Provider, {fail: true, theme: "light"})).toThrow(
      "context render failed"
    )
    expect(semanticRoot.querySelector("span")!.firstChild).toBe(text)
    expect(semanticRoot.textContent).toBe("dark")
    root.render(Provider, {fail: false, theme: "light"})
    expect(semanticRoot.textContent).toBe("light")
  })

  it("commits effect phases in order and cleans changed dependencies before setup", () => {
    const events: string[] = []
    const reference = (target: unknown) => {
      if (!target) return
      events.push("ref:attach")
      return () => events.push("ref:cleanup")
    }
    const EffectOrder = defineCompiledTemplate<{value: number}>({
      bindingCount: 2,
      displayName: "EffectOrder",
      mount(document) {
        const element = document.createElement("div")
        const text = document.createTextNode("")
        element.appendChild(text)
        return {bindings: [bindRef(element), bindText(text)], nodes: [element]}
      },
      render(props, values) {
        useInsertionEffect(() => {
          events.push(`insertion:${props.value}`)
          return () => events.push(`insertion-clean:${props.value}`)
        }, [props.value])
        useLayoutEffect(() => {
          events.push(`layout:${props.value}`)
          return () => events.push(`layout-clean:${props.value}`)
        }, [props.value])
        useEffect(() => {
          events.push(`passive:${props.value}`)
          return () => events.push(`passive-clean:${props.value}`)
        }, [props.value])
        writeBinding(values, 0, reference)
        writeBinding(values, 1, props.value)
      }
    })
    const {root} = mountedRoot()

    root.render(EffectOrder, {value: 1})
    expect(events).toEqual(["insertion:1", "ref:attach", "layout:1", "passive:1"])
    events.length = 0
    root.render(EffectOrder, {value: 2})
    expect(events).toEqual([
      "insertion-clean:1",
      "insertion:2",
      "layout-clean:1",
      "layout:2",
      "passive-clean:1",
      "passive:2"
    ])
    events.length = 0
    root.render(EffectOrder, {value: 2})
    expect(events).toEqual([])
    root.unmount()
    expect(events).toEqual([
      "insertion-clean:2",
      "layout-clean:2",
      "passive-clean:2",
      "ref:cleanup"
    ])
  })

  it("does not run effect cleanup or setup for a failed render", () => {
    const events: string[] = []
    const Fallible = defineCompiledTemplate<{fail: boolean; value: number}>({
      bindingCount: 1,
      displayName: "FallibleEffect",
      mount(document) {
        const text = document.createTextNode("")
        return {bindings: [bindText(text)], nodes: [text]}
      },
      render(props, values) {
        useEffect(() => {
          events.push(`setup:${props.value}`)
          return () => events.push(`cleanup:${props.value}`)
        }, [props.value])
        if (props.fail) throw new Error("render failed")
        writeBinding(values, 0, props.value)
      }
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(Fallible, {fail: false, value: 1})
    expect(events).toEqual(["setup:1"])
    expect(() => root.render(Fallible, {fail: true, value: 2})).toThrow("render failed")
    expect(events).toEqual(["setup:1"])
    expect(semanticRoot.textContent).toBe("1")
    root.render(Fallible, {fail: false, value: 2})
    expect(events).toEqual(["setup:1", "cleanup:1", "setup:2"])
  })

  it("keeps Effect Events on the latest committed closure with render-local identity", () => {
    const events: string[] = []
    const identities: Array<() => void> = []
    let fire: (() => void) | null = null
    const EventFixture = defineCompiledTemplate<{fail: boolean; value: string}>({
      bindingCount: 1,
      displayName: "EffectEventFixture",
      mount(document) {
        const text = document.createTextNode("")
        return {bindings: [bindText(text)], nodes: [text]}
      },
      render(props, values) {
        const event = useEffectEvent(() => events.push(props.value))
        identities.push(event)
        useEffect(() => {
          fire = () => event()
        }, [])
        if (props.fail) throw new Error("event render failed")
        writeBinding(values, 0, props.value)
      }
    })
    const {root} = mountedRoot()

    root.render(EventFixture, {fail: false, value: "a"})
    fire!()
    root.render(EventFixture, {fail: false, value: "b"})
    expect(identities[1]).not.toBe(identities[0])
    fire!()
    expect(events).toEqual(["a", "b"])
    expect(() => root.render(EventFixture, {fail: true, value: "failed"})).toThrow(
      "event render failed"
    )
    fire!()
    expect(events).toEqual(["a", "b", "b"])
  })

  it("commits imperative handles in layout phase and preserves them on failed render", () => {
    const events: string[] = []
    const reference: RefCallback<{value: number}> = handle => {
      if (!handle) {
        events.push("null")
        return
      }
      events.push(`handle:${handle.value}`)
      return () => events.push(`handle-clean:${handle.value}`)
    }
    const Imperative = defineCompiledTemplate<{fail: boolean; value: number}>({
      bindingCount: 1,
      displayName: "ImperativeFixture",
      mount(document) {
        const text = document.createTextNode("")
        return {bindings: [bindText(text)], nodes: [text]}
      },
      render(props, values) {
        useImperativeHandle(reference, () => ({value: props.value}), [props.value])
        if (props.fail) throw new Error("imperative render failed")
        writeBinding(values, 0, props.value)
      }
    })
    const {root} = mountedRoot()

    root.render(Imperative, {fail: false, value: 1})
    expect(events).toEqual(["handle:1"])
    root.render(Imperative, {fail: false, value: 1})
    expect(events).toEqual(["handle:1"])
    expect(() => root.render(Imperative, {fail: true, value: 2})).toThrow(
      "imperative render failed"
    )
    expect(events).toEqual(["handle:1"])
    root.render(Imperative, {fail: false, value: 2})
    expect(events).toEqual(["handle:1", "handle-clean:1", "handle:2"])
    root.unmount()
    expect(events).toEqual(["handle:1", "handle-clean:1", "handle:2", "handle-clean:2"])
  })

  it("subscribes external stores once, updates retained DOM, and catches render-to-commit tearing", () => {
    let snapshot = 1
    let renders = 0
    let subscriptions = 0
    let unsubscriptions = 0
    const listeners = new Set<() => void>()
    const subscribe = (listener: () => void) => {
      subscriptions += 1
      listeners.add(listener)
      return () => {
        unsubscriptions += 1
        listeners.delete(listener)
      }
    }
    const StoreFixture = textTemplate("StoreFixture", () => {
      renders += 1
      return useSyncExternalStore(subscribe, () => snapshot)
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(StoreFixture, {})
    const text = semanticRoot.querySelector("span")!.firstChild
    expect(semanticRoot.textContent).toBe("1")
    expect(subscriptions).toBe(1)
    for (const listener of listeners) listener()
    expect(renders).toBe(1)
    snapshot = 2
    for (const listener of [...listeners]) listener()
    expect(semanticRoot.textContent).toBe("2")
    expect(semanticRoot.querySelector("span")!.firstChild).toBe(text)
    expect(renders).toBe(2)
    expect(subscriptions).toBe(1)
    root.unmount()
    expect(unsubscriptions).toBe(1)

    let reads = 0
    let tearingRenders = 0
    const TearingFixture = textTemplate("TearingFixture", () => {
      tearingRenders += 1
      return useSyncExternalStore(
        () => () => {},
        () => {
          reads += 1
          return reads === 1 ? "old" : "new"
        }
      )
    })
    const tearing = mountedRoot()
    tearing.root.render(TearingFixture, {})
    expect(tearing.semanticRoot.textContent).toBe("new")
    expect(tearingRenders).toBe(2)
  })

  it("resubscribes only after a successful subscribe identity change", () => {
    const events: string[] = []
    const subscribeA = (_listener: () => void) => {
      events.push("subscribe:a")
      return () => events.push("unsubscribe:a")
    }
    const subscribeB = (_listener: () => void) => {
      events.push("subscribe:b")
      return () => events.push("unsubscribe:b")
    }
    const Store = textTemplate<{
      fail: boolean
      subscribe: (listener: () => void) => () => void
    }>("ResubscribeStore", props => {
      const snapshot = useSyncExternalStore(props.subscribe, () => 1)
      if (props.fail) throw new Error("subscription render failed")
      return snapshot
    })
    const {root} = mountedRoot()

    root.render(Store, {fail: false, subscribe: subscribeA})
    expect(events).toEqual(["subscribe:a"])
    expect(() => root.render(Store, {fail: true, subscribe: subscribeB})).toThrow(
      "subscription render failed"
    )
    expect(events).toEqual(["subscribe:a"])
    root.render(Store, {fail: false, subscribe: subscribeB})
    expect(events).toEqual(["subscribe:a", "unsubscribe:a", "subscribe:b"])
    root.unmount()
    expect(events).toEqual([
      "subscribe:a",
      "unsubscribe:a",
      "subscribe:b",
      "unsubscribe:b"
    ])
  })

  it("fails closed for uncached external snapshots and keeps debug formatting lazy", () => {
    let formats = 0
    const Uncached = textTemplate("UncachedStore", () => {
      const snapshot = useSyncExternalStore(() => () => {}, () => ({}))
      useDebugValue(snapshot, value => {
        formats += 1
        return value
      })
      return "never"
    })
    const {root, semanticRoot} = mountedRoot()

    expect(() => root.render(Uncached, {})).toThrow(HookContractError)
    expect(semanticRoot.textContent).toBe("")
    expect(formats).toBe(0)
  })

  it("rejects state updates from insertion effects", () => {
    let dispatch: StateDispatch<number> | null = null
    const InvalidInsertion = textTemplate("InvalidInsertion", () => {
      const [value, setValue] = useState(0)
      dispatch = setValue
      useInsertionEffect(() => setValue(1), [])
      return value
    })
    const {root, semanticRoot} = mountedRoot()

    expect(() => root.render(InvalidInsertion, {})).toThrow(HookContractError)
    expect(semanticRoot.textContent).toBe("0")
    expect(dispatch).not.toBeNull()
  })
})

function mountedRoot() {
  const document = createDocument()
  const semanticRoot = document.createElement("div")
  document.appendChild(semanticRoot)
  return {document, root: createRoot(semanticRoot), semanticRoot}
}

function textTemplate<Props = Record<string, never>>(
  name: string,
  read: (props: Readonly<Props>) => unknown
) {
  return defineCompiledTemplate<Props>({
    bindingCount: 1,
    displayName: name,
    mount(document) {
      const span = document.createElement("span")
      const text = document.createTextNode("")
      span.appendChild(text)
      return {bindings: [bindText(text)], nodes: [span]}
    },
    render(props, values) {
      writeBinding(values, 0, read(props))
    }
  })
}

function childTemplate<Props>(
  name: string,
  read: (props: Readonly<Props>) => ComponentValue
) {
  return defineCompiledTemplate<Props>({
    bindingCount: 1,
    displayName: name,
    mount(document) {
      const wrapper = document.createElement("div")
      const start = document.createComment("child")
      const end = document.createComment("/child")
      wrapper.append(start, end)
      return {bindings: [bindChild(start, end)], nodes: [wrapper]}
    },
    render(props, values) {
      writeBinding(values, 0, read(props))
    }
  })
}
