import {describe, expect, it} from "bun:test"
import {Element, Node, Text, createDocument, type MutationBatch} from "@zavx0z/dom"
import {
  createRoot,
  component,
  keyedComponents,
  memo,
  useState,
  when,
  type ComponentValue,
  type StateDispatch
} from "../src/index.ts"
import {
  bindChild,
  bindConditional,
  bindKeyed,
  bindProperty,
  bindRef,
  bindText,
  defineCompiledTemplate,
  writeBinding
} from "@zavx0z/template/compiled"
import type {CallbackRef} from "../src/composition.ts"

describe("compiled component composition", () => {
  it("reuses A to B nesting, forwards parent props, and isolates child-local state", () => {
    let parentRenders = 0
    let childRenders = 0
    let setChild: StateDispatch<number> | null = null
    const ChildB = defineCompiledTemplate<{label: string}>({
      bindingCount: 1,
      displayName: "ChildB",
      mount(document) {
        const span = document.createElement("span")
        const text = document.createTextNode("")
        span.appendChild(text)
        return {bindings: [bindText(text)], nodes: [span]}
      },
      render(props, values) {
        childRenders += 1
        const [count, dispatch] = useState(0)
        setChild = dispatch
        writeBinding(values, 0, `${props.label}:${count}`)
      }
    })
    const ParentA = singleChildTemplate<{label: string}>("ParentA", props => {
      parentRenders += 1
      return component(ChildB, {label: props.label}, "child-b")
    })
    const {root, semanticRoot} = mountedRoot()

    root.render(ParentA, {label: "first"})
    const childElement = semanticRoot.querySelector("span")!
    const childText = childElement.firstChild as Text
    expect(childText.data).toBe("first:0")

    root.render(ParentA, {label: "second"})
    expect(semanticRoot.querySelector("span")).toBe(childElement)
    expect(childElement.firstChild).toBe(childText)
    expect(childText.data).toBe("second:0")
    expect(parentRenders).toBe(2)
    expect(childRenders).toBe(2)

    setChild!(value => value + 1)
    expect(childText.data).toBe("second:1")
    expect(parentRenders).toBe(2)
    expect(childRenders).toBe(3)
  })

  it("applies memo only when explicitly wrapped and supports a custom comparator", () => {
    let ordinaryRenders = 0
    let memoRenders = 0
    let customRenders = 0
    let customCompares = 0
    let memoDispatch: StateDispatch<number> | null = null
    const Ordinary = textComponent<{value: number}>("Ordinary", props => {
      ordinaryRenders += 1
      return props.value
    })
    const MemoSource = textComponent<{value: number}>("MemoSource", props => {
      memoRenders += 1
      const [state, dispatch] = useState(0)
      memoDispatch = dispatch
      return `${props.value}:${state}`
    })
    const CustomSource = textComponent<{ignored: number; value: number}>("CustomSource", props => {
      customRenders += 1
      return props.value
    })
    const MemoChild = memo(MemoSource)
    const CustomMemo = memo(CustomSource, (previous, next) => {
      customCompares += 1
      return previous.value === next.value
    })
    const Parent = defineCompiledTemplate<{ignored: number; tick: number; value: number}>({
      bindingCount: 3,
      displayName: "MemoParent",
      mount(document) {
        const wrapper = document.createElement("div")
        const anchors = Array.from({length: 6}, (_, index) => document.createComment(`m${index}`))
        wrapper.append(...anchors)
        return {
          bindings: [
            bindChild(anchors[0]!, anchors[1]!),
            bindChild(anchors[2]!, anchors[3]!),
            bindChild(anchors[4]!, anchors[5]!)
          ],
          nodes: [wrapper]
        }
      },
      render(props, values) {
        writeBinding(values, 0, component(Ordinary, {value: props.value}, "ordinary"))
        writeBinding(values, 1, component(MemoChild, {value: props.value}, "memo"))
        writeBinding(values, 2, component(
          CustomMemo,
          {ignored: props.ignored, value: props.value},
          "custom"
        ))
        void props.tick
      }
    })
    const {root} = mountedRoot()

    root.render(Parent, {ignored: 0, tick: 0, value: 4})
    root.render(Parent, {ignored: 1, tick: 1, value: 4})
    expect(ordinaryRenders).toBe(2)
    expect(memoRenders).toBe(1)
    expect(customRenders).toBe(1)

    memoDispatch!(value => value + 1)
    expect(memoRenders).toBe(2)
    root.render(Parent, {ignored: 2, tick: 2, value: 5})
    expect(memoRenders).toBe(3)
    expect(customRenders).toBe(2)
    expect(customCompares).toBe(2)
  })

  it("preserves conditional branch identity while type and key stay unchanged", () => {
    let setValue: StateDispatch<number> | null = null
    const Branch = textComponent<{label: string}>("Branch", props => {
      const [value, dispatch] = useState(1)
      setValue = dispatch
      return `${props.label}:${value}`
    })
    const Parent = conditionalTemplate<{label: string; show: boolean}>(props =>
      when(props.show, Branch, {label: props.label}, "branch")
    )
    const {root, semanticRoot} = mountedRoot()

    root.render(Parent, {label: "a", show: true})
    const text = semanticRoot.querySelector("span")!.firstChild as Text
    setValue!(value => value + 1)
    root.render(Parent, {label: "b", show: true})
    expect(semanticRoot.querySelector("span")!.firstChild).toBe(text)
    expect(text.data).toBe("b:2")

    root.render(Parent, {label: "hidden", show: false})
    expect(semanticRoot.querySelector("span")).toBeNull()
    root.render(Parent, {label: "new", show: true})
    expect(semanticRoot.querySelector("span")!.firstChild).not.toBe(text)
    expect(semanticRoot.textContent).toBe("new:1")
  })

  it("reconciles keyed reorder, insert and delete with DOM, hook and ref identity", () => {
    type Item = {id: string; label: string}
    const dispatches = new Map<string, StateDispatch<number>>()
    const refEvents: string[] = []
    const refs = new Map<string, CallbackRef>()
    let itemMounts = 0
    const refFor = (id: string): CallbackRef => {
      let reference = refs.get(id)
      if (!reference) {
        reference = target => {
          if (!target) return
          refEvents.push(`${id}:attach`)
          return () => refEvents.push(`${id}:cleanup`)
        }
        refs.set(id, reference)
      }
      return reference
    }
    const ItemComponent = defineCompiledTemplate<Item & {reference: CallbackRef}>({
      bindingCount: 3,
      displayName: "KeyedItem",
      mount(document) {
        itemMounts += 1
        const item = document.createElement("li")
        const text = document.createTextNode("")
        item.appendChild(text)
        return {
          bindings: [bindProperty(item, "id"), bindText(text), bindRef(item)],
          nodes: [item]
        }
      },
      render(props, values) {
        const [local, setLocal] = useState(0)
        dispatches.set(props.id, setLocal)
        writeBinding(values, 0, props.id)
        writeBinding(values, 1, `${props.label}:${local}`)
        writeBinding(values, 2, props.reference)
      }
    })
    const List = keyedListTemplate<Item>(item => component(
      ItemComponent,
      {...item, reference: refFor(item.id)},
      item.id
    ))
    const {root, semanticRoot} = mountedRoot()

    root.render(List, {items: items("a", "b", "c")})
    const initial = elementsById(semanticRoot)
    const initialTexts = textNodesById(semanticRoot)
    dispatches.get("b")!(value => value + 7)
    expect(initialTexts.get("b")!.data).toBe("b:7")

    const beforeReorder = root.stats()
    root.render(List, {items: items("c", "a", "b")})
    expect(elementIds(semanticRoot)).toEqual(["c", "a", "b"])
    expect(elementsById(semanticRoot).get("a")).toBe(initial.get("a"))
    expect(elementsById(semanticRoot).get("b")).toBe(initial.get("b"))
    expect(textNodesById(semanticRoot).get("b")).toBe(initialTexts.get("b"))
    expect(initialTexts.get("b")!.data).toBe("b:7")
    expect(root.stats().moves - beforeReorder.moves).toBe(1)

    root.render(List, {items: items("c", "d", "a", "b")})
    expect(elementIds(semanticRoot)).toEqual(["c", "d", "a", "b"])
    expect(itemMounts).toBe(4)
    root.render(List, {items: items("c", "d", "b")})
    expect(elementIds(semanticRoot)).toEqual(["c", "d", "b"])
    expect(elementsById(semanticRoot).get("b")).toBe(initial.get("b"))
    expect(refEvents.filter(event => event === "a:cleanup")).toHaveLength(1)
    expect(refEvents.filter(event => event === "b:attach")).toHaveLength(1)
  })

  it("uses bounded placement plans for rotations, one insertion and one deletion", () => {
    const ItemSource = defineCompiledTemplate<{id: string}>({
      bindingCount: 2,
      displayName: "PlacementItem",
      mount(document) {
        const item = document.createElement("li")
        const text = document.createTextNode("")
        item.appendChild(text)
        return {bindings: [bindProperty(item, "id"), bindText(text)], nodes: [item]}
      },
      render(props, values) {
        writeBinding(values, 0, props.id)
        writeBinding(values, 1, props.id)
      }
    })
    const Item = memo(ItemSource)
    const List = keyedListTemplate<{id: string}>(item => component(Item, item, item.id))
    const {root, semanticRoot} = mountedRoot()
    const initial = ["a", "b", "c", "d", "e"].map(id => ({id}))

    root.render(List, {items: initial})
    const identities = elementsById(semanticRoot)

    const beforeLeft = root.stats()
    root.render(List, {items: ["b", "c", "d", "e", "a"].map(id => ({id}))})
    expect(elementIds(semanticRoot)).toEqual(["b", "c", "d", "e", "a"])
    expect(root.stats().moves - beforeLeft.moves).toBe(1)

    const beforeRight = root.stats()
    root.render(List, {items: initial})
    expect(elementIds(semanticRoot)).toEqual(["a", "b", "c", "d", "e"])
    expect(root.stats().moves - beforeRight.moves).toBe(1)

    const beforeInsert = root.stats()
    root.render(List, {items: ["a", "b", "x", "c", "d", "e"].map(id => ({id}))})
    expect(elementIds(semanticRoot)).toEqual(["a", "b", "x", "c", "d", "e"])
    expect(root.stats().mounts - beforeInsert.mounts).toBe(1)
    expect(root.stats().moves - beforeInsert.moves).toBe(0)

    const beforeDelete = root.stats()
    root.render(List, {items: initial})
    expect(elementIds(semanticRoot)).toEqual(["a", "b", "c", "d", "e"])
    expect(root.stats().disposes - beforeDelete.disposes).toBe(1)
    expect(root.stats().moves - beforeDelete.moves).toBe(0)

    const beforeArbitrary = root.stats()
    root.render(List, {items: ["c", "a", "e", "b", "d"].map(id => ({id}))})
    expect(elementIds(semanticRoot)).toEqual(["c", "a", "e", "b", "d"])
    expect(root.stats().moves - beforeArbitrary.moves).toBe(2)
    for (const [id, element] of identities) {
      expect(elementsById(semanticRoot).get(id)).toBe(element)
    }
  })

  it("preserves generic arbitrary keyed reorder correctness", () => {
    const ItemSource = defineCompiledTemplate<{id: string}>({
      bindingCount: 1,
      displayName: "ArbitraryPlacementItem",
      mount(document) {
        const item = document.createElement("li")
        return {bindings: [bindProperty(item, "id")], nodes: [item]}
      },
      render(props, values) {
        writeBinding(values, 0, props.id)
      }
    })
    const Item = memo(ItemSource)
    const List = keyedListTemplate<{id: string}>(item => component(Item, item, item.id))
    const {root, semanticRoot} = mountedRoot()
    const ids = Array.from({length: 24}, (_, index) => `item-${index}`)
    root.render(List, {items: ids.map(id => ({id}))})
    const identities = elementsById(semanticRoot)

    for (let seed = 1; seed <= 12; seed += 1) {
      const order = deterministicPermutation(ids, seed)
      root.render(List, {items: order.map(id => ({id}))})
      expect(elementIds(semanticRoot)).toEqual(order)
      const current = elementsById(semanticRoot)
      for (const id of ids) expect(current.get(id)).toBe(identities.get(id))
    }
  })

  it("coalesces one consecutive arbitrary placement run into one fragment insertion", () => {
    const Item = memo(defineCompiledTemplate<{id: string}>({
      bindingCount: 2,
      displayName: "PlacementRunItem",
      mount(document) {
        const item = document.createElement("li")
        const text = document.createTextNode("")
        item.appendChild(text)
        return {bindings: [bindProperty(item, "id"), bindText(text)], nodes: [item]}
      },
      render(props, values) {
        writeBinding(values, 0, props.id)
        writeBinding(values, 1, props.id)
      }
    }))
    const List = keyedListTemplate<{id: string}>(item => component(Item, item, item.id))
    const {document, root, semanticRoot} = mountedRoot()
    const initial = ["a", "b", "c", "d", "e"].map(id => ({id}))
    root.render(List, {items: initial})
    const before = root.stats()
    const batches: MutationBatch[] = []
    const unsubscribe = document.subscribeMutations(batch => batches.push(batch))

    root.render(List, {items: [...initial].reverse()})
    unsubscribe()

    expect(elementIds(semanticRoot)).toEqual(["e", "d", "c", "b", "a"])
    expect(root.stats().moves - before.moves).toBe(4)
    const list = semanticRoot.querySelector("ul")!
    const additions = batches.flatMap(batch => batch.records).filter(record =>
      record.type === "childList" && record.target === list && record.addedNodes.length > 0
    )
    expect(additions).toHaveLength(1)
    expect(additions[0]?.type === "childList" ? additions[0].addedNodes : []).toHaveLength(12)
  })

  it("revalidates cached keyed anchors after connected and detached external mutations", () => {
    const Item = memo(textComponent<{id: string}>("AnchorItem", props => props.id))
    const createList = (capture: (start: Node, end: Node) => void) =>
      defineCompiledTemplate<{ids: readonly string[]}>({
        bindingCount: 1,
        displayName: "AnchorList",
        mount(document) {
          const list = document.createElement("ul")
          const start = document.createComment("items")
          const end = document.createComment("/items")
          list.append(start, end)
          capture(start, end)
          return {bindings: [bindKeyed(start, end)], nodes: [list]}
        },
        render(props, values) {
          writeBinding(values, 0, keyedComponents(props.ids.map(id => component(Item, {id}, id))))
        }
      })

    for (const connected of [true, false]) {
      const document = createDocument()
      const container = connected ? document.createElement("div") : document.createDocumentFragment()
      if (connected) document.appendChild(container)
      let start: Node | null = null
      let end: Node | null = null
      const List = createList((nextStart, nextEnd) => {
        start = nextStart
        end = nextEnd
      })
      const root = createRoot(container)
      root.render(List, {ids: ["a", "b", "c"]})
      const before = root.stats()

      start!.parentNode!.insertBefore(end!, start)
      expect(() => root.render(List, {ids: ["b", "c", "a"]})).toThrow(
        "lost its ordered anchors"
      )
      expect(root.stats().moves).toBe(before.moves)
    }
  })

  it("validates duplicate keys before any DOM mutation", () => {
    const Item = textComponent<{id: string}>("DuplicateItem", props => props.id)
    const List = keyedListTemplate<{id: string}>(item => component(Item, item, item.id))
    const {root, semanticRoot} = mountedRoot()

    root.render(List, {items: [{id: "a"}, {id: "b"}]})
    const nodes = [...semanticRoot.querySelectorAll("span")]
    const before = root.stats()
    expect(() => root.render(List, {items: [{id: "b"}, {id: "b"}]})).toThrow(
      "Duplicate keyed component b"
    )
    expect([...semanticRoot.querySelectorAll("span")]).toEqual(nodes)
    expect(semanticRoot.textContent).toBe("ab")
    expect(root.stats().moves).toBe(before.moves)
    expect(root.stats().disposes).toBe(before.disposes)
  })

  it("rolls back parent and prepared siblings when one nested child render fails", () => {
    type Item = {fail: boolean; id: string; label: string}
    const dispatches = new Map<string, StateDispatch<number>>()
    const ItemComponent = textComponent<Item>("FallibleItem", props => {
      const [local, setLocal] = useState(0)
      dispatches.set(props.id, setLocal)
      if (props.fail) throw new Error(`failed:${props.id}`)
      return `${props.label}:${local}`
    })
    const Parent = defineCompiledTemplate<{header: string; items: Item[]}>({
      bindingCount: 2,
      displayName: "AtomicParent",
      mount(document) {
        const wrapper = document.createElement("div")
        const heading = document.createElement("span")
        const text = document.createTextNode("")
        heading.appendChild(text)
        const start = document.createComment("items")
        const end = document.createComment("/items")
        wrapper.append(heading, start, end)
        return {bindings: [bindText(text), bindKeyed(start, end)], nodes: [wrapper]}
      },
      render(props, values) {
        writeBinding(values, 0, props.header)
        writeBinding(values, 1, keyedComponents(props.items.map(item =>
          component(ItemComponent, item, item.id)
        )))
      }
    })
    const {root, semanticRoot} = mountedRoot()
    const original = [
      {fail: false, id: "a", label: "A"},
      {fail: false, id: "b", label: "B"}
    ]

    root.render(Parent, {header: "old", items: original})
    dispatches.get("a")!(5)
    const headingText = semanticRoot.querySelector("span")!.firstChild
    const childNodes = [...semanticRoot.querySelectorAll("span")]
    expect(() => root.render(Parent, {
      header: "new",
      items: [
        {fail: false, id: "a", label: "A2"},
        {fail: true, id: "b", label: "B2"}
      ]
    })).toThrow("failed:b")

    expect(semanticRoot.querySelector("span")!.firstChild).toBe(headingText)
    expect([...semanticRoot.querySelectorAll("span")]).toEqual(childNodes)
    expect(semanticRoot.textContent).toBe("oldA:5B:0")
    root.render(Parent, {
      header: "new",
      items: [
        {fail: false, id: "a", label: "A2"},
        {fail: false, id: "b", label: "B2"}
      ]
    })
    expect(semanticRoot.textContent).toBe("newA2:5B2:0")
  })

  it("preserves the old nested region on a cross-Document child mount failure", () => {
    const foreignDocument = createDocument()
    const Good = textComponent<Record<string, never>>("GoodChild", () => "good")
    const Bad = defineCompiledTemplate<Record<string, never>>({
      bindingCount: 0,
      displayName: "BadCrossDocumentChild",
      mount() {
        return {bindings: [], nodes: [foreignDocument.createElement("div")]}
      },
      render() {}
    })
    const Parent = singleChildTemplate<{bad: boolean}>("CrossDocumentParent", props =>
      component(props.bad ? Bad : Good, {}, "child")
    )
    const {root, semanticRoot} = mountedRoot()

    root.render(Parent, {bad: false})
    const child = semanticRoot.querySelector("span")!
    expect(() => root.render(Parent, {bad: true})).toThrow("cross-Document Node")
    expect(semanticRoot.querySelector("span")).toBe(child)
    expect(semanticRoot.textContent).toBe("good")
  })

  it("runs nested cleanup child-first", () => {
    const events: string[] = []
    const reference = (name: string): CallbackRef => target => {
      if (!target) return
      return () => events.push(name)
    }
    const Child = defineCompiledTemplate<Record<string, never>>({
      bindingCount: 1,
      displayName: "CleanupChild",
      mount(document) {
        const span = document.createElement("span")
        return {bindings: [bindRef(span)], nodes: [span]}
      },
      render(_props, values) {
        writeBinding(values, 0, reference("child"))
      }
    })
    const Parent = defineCompiledTemplate<Record<string, never>>({
      bindingCount: 2,
      displayName: "CleanupParent",
      mount(document) {
        const wrapper = document.createElement("div")
        const start = document.createComment("child")
        const end = document.createComment("/child")
        wrapper.append(start, end)
        return {bindings: [bindRef(wrapper), bindChild(start, end)], nodes: [wrapper]}
      },
      render(_props, values) {
        writeBinding(values, 0, reference("parent"))
        writeBinding(values, 1, component(Child, {}, "child"))
      }
    })
    const {root} = mountedRoot()

    root.render(Parent, {})
    root.unmount()
    expect(events).toEqual(["child", "parent"])
  })
})

function mountedRoot() {
  const document = createDocument()
  const semanticRoot = document.createElement("div")
  document.appendChild(semanticRoot)
  return {document, root: createRoot(semanticRoot), semanticRoot}
}

function textComponent<Props>(name: string, read: (props: Readonly<Props>) => unknown) {
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

function singleChildTemplate<Props>(
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

function conditionalTemplate<Props>(
  read: (props: Readonly<Props>) => ComponentValue | null
) {
  return defineCompiledTemplate<Props>({
    bindingCount: 1,
    displayName: "ConditionalParent",
    mount(document) {
      const wrapper = document.createElement("div")
      const start = document.createComment("when")
      const end = document.createComment("/when")
      wrapper.append(start, end)
      return {bindings: [bindConditional(start, end)], nodes: [wrapper]}
    },
    render(props, values) {
      writeBinding(values, 0, read(props))
    }
  })
}

function keyedListTemplate<Item>(read: (item: Item) => ComponentValue) {
  return defineCompiledTemplate<{items: readonly Item[]}>({
    bindingCount: 1,
    displayName: "KeyedList",
    mount(document) {
      const list = document.createElement("ul")
      const start = document.createComment("items")
      const end = document.createComment("/items")
      list.append(start, end)
      return {bindings: [bindKeyed(start, end)], nodes: [list]}
    },
    render(props, values) {
      writeBinding(values, 0, keyedComponents(props.items.map(read)))
    }
  })
}

function items(...ids: string[]) {
  return ids.map(id => ({id, label: id}))
}

function deterministicPermutation(values: readonly string[], seed: number): string[] {
  const result = [...values]
  let state = seed >>> 0
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    const target = state % (index + 1)
    const current = result[index]!
    result[index] = result[target]!
    result[target] = current
  }
  return result
}

function elementIds(root: Element): string[] {
  return [...root.querySelectorAll("li")].map(element => element.id)
}

function elementsById(root: Element): Map<string, Node> {
  return new Map([...root.querySelectorAll("li")].map(element => [element.id, element]))
}

function textNodesById(root: Element): Map<string, Text> {
  return new Map([...root.querySelectorAll("li")].map(element => [
    element.id,
    element.firstChild as Text
  ]))
}
