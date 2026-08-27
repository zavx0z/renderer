import {describe, expect, it} from "bun:test"
import type {
  MutationBatch,
  StateChangeBatch
} from "../src/index.ts"
import {createDocument} from "../src/index.ts"

describe("HTMLElement requested scroll state", () => {
  it("is lazy, non-reflected and stores finite non-negative requested offsets", () => {
    const document = createDocument()
    const element = document.createElement("div")
    const ownProperties = Object.getOwnPropertyNames(element)
    const documentState = () => (document as unknown as {
      stateChangeState: unknown
    }).stateChangeState

    expect(documentState()).toBeNull()
    expect(element.scrollLeft).toBe(0)
    expect(element.scrollTop).toBe(0)
    element.scrollTo()
    element.scrollBy()
    element.scrollTop = 0
    expect(Object.getOwnPropertyNames(element)).toEqual(ownProperties)
    expect(element.getAttributeNames()).toEqual([])
    expect(documentState()).toBeNull()

    element.scrollTop = 12.5
    element.scrollLeft = 7.25
    expect(element.scrollTop).toBe(12.5)
    expect(element.scrollLeft).toBe(7.25)
    expect(Object.getOwnPropertyNames(element)).toEqual(ownProperties)
    expect(element.getAttribute("scrolltop")).toBeNull()
    element.setAttribute("scrolltop", "99")
    expect(element.scrollTop).toBe(12.5)

    element.scrollTop = -10
    element.scrollLeft = Number.POSITIVE_INFINITY
    expect(element.scrollTop).toBe(0)
    expect(element.scrollLeft).toBe(0)
    expect(documentState()).toBeNull()

    element.scrollTo(1_000_000_000, 2_000_000_000)
    expect(element.scrollLeft).toBe(1_000_000_000)
    expect(element.scrollTop).toBe(2_000_000_000)
  })

  it("implements scrollTo and scrollBy overload semantics", () => {
    const document = createDocument()
    const element = document.createElement("div")

    element.scrollTo(10, 20)
    element.scrollTo({top: 30})
    expect([element.scrollLeft, element.scrollTop]).toEqual([10, 30])
    element.scrollTo({left: 15, behavior: "instant"})
    expect([element.scrollLeft, element.scrollTop]).toEqual([15, 30])

    element.scrollBy(5, -50)
    expect([element.scrollLeft, element.scrollTop]).toEqual([20, 0])
    element.scrollBy({top: 2.5, behavior: "auto"})
    expect([element.scrollLeft, element.scrollTop]).toEqual([20, 2.5])
    element.scrollBy({left: Number.NaN, top: Number.NEGATIVE_INFINITY})
    expect([element.scrollLeft, element.scrollTop]).toEqual([20, 2.5])

    element.scrollTo({left: Number.NaN, top: Number.POSITIVE_INFINITY})
    expect([element.scrollLeft, element.scrollTop]).toEqual([0, 0])
  })

  it("fails closed for unsupported behavior before changing state", () => {
    const document = createDocument()
    const element = document.createElement("div")
    element.scrollTo(10, 20)

    try {
      element.scrollTo({left: 30, behavior: "smooth"} as never)
      throw new Error("Expected smooth scrolling to fail")
    } catch (error) {
      expect((error as Error).name).toBe("NotSupportedError")
    }
    expect([element.scrollLeft, element.scrollTop]).toEqual([10, 20])

    expect(() => element.scrollBy({behavior: "future"} as never)).toThrow(TypeError)
    const numericScrollTo = element.scrollTo.bind(element) as (...coordinates: number[]) => void
    expect(() => numericScrollTo(1)).toThrow(TypeError)
    expect([element.scrollLeft, element.scrollTop]).toEqual([10, 20])
  })
})

describe("Document state-change adapter", () => {
  it("keeps scroll state batches separate from mutation batches", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const mutationBatches: MutationBatch[] = []
    const stateBatches: StateChangeBatch[] = []
    document.append(root)
    document.subscribeMutations(batch => mutationBatches.push(batch))
    document.subscribeStateChanges(batch => stateBatches.push(batch))

    root.scrollTop = 5
    expect(mutationBatches).toEqual([])
    expect(stateBatches).toHaveLength(1)
    expect(stateBatches[0]).toEqual({
      document,
      version: 1,
      records: [{
        type: "scroll",
        target: root,
        oldScrollLeft: 0,
        oldScrollTop: 0,
        scrollLeft: 0,
        scrollTop: 5
      }]
    })
    expect(Object.isFrozen(stateBatches[0])).toBe(true)
    expect(Object.isFrozen(stateBatches[0]?.records)).toBe(true)
    expect(Object.isFrozen(stateBatches[0]?.records[0])).toBe(true)

    root.scrollTop = 5
    expect(stateBatches).toHaveLength(1)

    document.transaction(() => {
      root.scrollTop = 10
      root.scrollLeft = 4
      root.scrollTop = 12
      root.setAttribute("data-state", "scrolled")
    })
    expect(mutationBatches).toHaveLength(1)
    expect(stateBatches).toHaveLength(2)
    expect(stateBatches[1]?.records).toEqual([{
      type: "scroll",
      target: root,
      oldScrollLeft: 0,
      oldScrollTop: 5,
      scrollLeft: 4,
      scrollTop: 12
    }])
    expect(document.stateVersion).toBe(2)

    document.transaction(() => {
      root.scrollTop = 20
      root.scrollTop = 12
    })
    expect(stateBatches).toHaveLength(2)
    expect(document.stateVersion).toBe(2)
  })

  it("records only connected changes and coalesces once per target", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("div")
    const batches: StateChangeBatch[] = []
    document.append(root)
    document.subscribeStateChanges(batch => batches.push(batch))

    child.scrollTop = 7
    expect(batches).toEqual([])
    root.append(child)
    child.scrollTop = 7
    expect(batches).toEqual([])

    document.transaction(() => {
      root.scrollTo({left: 2, top: 3})
      root.scrollBy({left: 4, top: 5})
      child.scrollTop = 8
      child.scrollLeft = 9
    })
    expect(batches).toHaveLength(1)
    expect(batches[0]?.records).toHaveLength(2)
    expect(batches[0]?.records[0]).toMatchObject({
      target: root,
      oldScrollLeft: 0,
      oldScrollTop: 0,
      scrollLeft: 6,
      scrollTop: 8
    })
    expect(batches[0]?.records[1]).toMatchObject({
      target: child,
      oldScrollLeft: 0,
      oldScrollTop: 7,
      scrollLeft: 9,
      scrollTop: 8
    })
  })

  it("does not fabricate scroll or wheel events", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const events: string[] = []
    document.append(root)
    root.addEventListener("scroll", event => events.push(event.type))
    root.addEventListener("wheel", event => events.push(event.type))

    root.scrollTop = 10
    root.scrollTo({left: 4})
    root.scrollBy(2, 3)
    expect(events).toEqual([])
  })
})
