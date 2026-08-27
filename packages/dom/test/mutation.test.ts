import {describe, expect, it} from "bun:test"
import type {MutationBatch} from "../src/index.ts"
import {createDocument} from "../src/index.ts"

describe("Document mutation adapter", () => {
  it("reports a child mutation whose target is the connected Document root", () => {
    const document = createDocument()
    const batches: MutationBatch[] = []
    document.subscribeMutations(batch => batches.push(batch))

    const root = document.createElement("div")
    document.appendChild(root)

    expect(batches).toHaveLength(1)
    expect(batches[0]?.records).toHaveLength(1)
    expect(batches[0]?.records[0]?.type).toBe("childList")
    expect(batches[0]?.records[0]?.target).toBe(document)
  })

  it("batches one immutable notification per outer transaction", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const initialVersion = document.version
    const batches: MutationBatch[] = []
    const unsubscribe = document.subscribeMutations(batch => batches.push(batch))

    const child = document.createElement("span")
    document.transaction(() => {
      root.appendChild(child)
      document.transaction(() => child.setAttribute("title", "Child"))
      child.textContent = "value"
    })

    expect(batches).toHaveLength(1)
    expect(batches[0]?.version).toBe(initialVersion + 1)
    expect(batches[0]?.records.map(record => record.type)).toEqual([
      "childList",
      "attributes",
      "childList"
    ])
    expect(Object.isFrozen(batches[0])).toBe(true)
    expect(Object.isFrozen(batches[0]?.records)).toBe(true)

    child.firstChild!.nodeValue = "next"
    expect(batches).toHaveLength(2)
    expect(batches[1]?.records).toHaveLength(1)
    expect(batches[1]?.records[0]?.type).toBe("characterData")

    unsubscribe()
    child.setAttribute("data-state", "idle")
    expect(batches).toHaveLength(2)
  })

  it("does not report detached fragment preparation", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const fragment = document.createDocumentFragment()
    const child = document.createElement("span")
    const batches: MutationBatch[] = []
    document.appendChild(root)
    document.subscribeMutations(batch => batches.push(batch))

    fragment.appendChild(child)
    child.setAttribute("title", "prepared")
    expect(batches).toEqual([])

    root.appendChild(fragment)
    expect(batches).toHaveLength(1)
    expect(batches[0]?.records[0]?.type).toBe("childList")
    expect(batches[0]?.records[0]?.target).toBe(root)
  })

  it("queues subscriber mutations as the next transaction", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const versions: number[] = []
    document.appendChild(root)

    document.subscribeMutations(batch => {
      versions.push(batch.version)
      if (versions.length === 1) root.setAttribute("data-follow-up", "true")
    })

    root.setAttribute("title", "first")
    expect(versions).toEqual([2, 3])
  })

  it("reports connected Comment data changes as characterData mutations", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const anchor = document.createComment("region:start")
    const batches: MutationBatch[] = []
    document.appendChild(root)
    root.appendChild(anchor)
    document.subscribeMutations(batch => batches.push(batch))

    anchor.data = "region:updated"

    expect(anchor.nodeValue).toBe("region:updated")
    expect(anchor.textContent).toBe("region:updated")
    expect(batches).toHaveLength(1)
    expect(batches[0]?.records).toEqual([{
      type: "characterData",
      target: anchor,
      oldValue: "region:start",
      newValue: "region:updated"
    }])

    root.removeChild(anchor)
    batches.length = 0
    anchor.appendData(":detached")
    expect(batches).toEqual([])
  })
})
