import {describe, expect, test} from "bun:test"
import {
  acquireDocumentCompiledStyleSheets,
  createDocument,
  readDocumentCompiledStyleSheets,
  subscribeDocumentCompiledStyleSheets
} from "../src/index.ts"

describe("Document compiled stylesheet ownership", () => {
  test("deduplicates exact records and releases the active set by lease", () => {
    const document = createDocument()
    const changes: number[] = []
    const unsubscribe = subscribeDocumentCompiledStyleSheets(document, change => {
      expect(change.document).toBe(document)
      expect(Object.isFrozen(change.styleSheets)).toBeTrue()
      changes.push(change.revision)
    })
    const initial = readDocumentCompiledStyleSheets(document)
    expect(initial).toEqual({revision: 0, styleSheets: []})
    expect(Object.isFrozen(initial)).toBeTrue()

    const first = acquireDocumentCompiledStyleSheets(document, [
      {id: "button", cssText: "[data-button]{height:22px}"},
      {id: "button", cssText: "[data-button]{height:22px}"}
    ])
    const second = acquireDocumentCompiledStyleSheets(document, [
      {id: "button", cssText: "[data-button]{height:22px}"}
    ])
    expect(readDocumentCompiledStyleSheets(document)).toMatchObject({
      revision: 1,
      styleSheets: [{id: "button", cssText: "[data-button]{height:22px}"}]
    })
    expect(changes).toEqual([1])

    first.release()
    first.release()
    expect(readDocumentCompiledStyleSheets(document).revision).toBe(1)
    second.release()
    expect(readDocumentCompiledStyleSheets(document)).toEqual({revision: 2, styleSheets: []})
    expect(changes).toEqual([1, 2])
    unsubscribe()
  })

  test("rejects id collisions atomically", () => {
    const document = createDocument()
    const owner = acquireDocumentCompiledStyleSheets(document, [
      {id: "owner", cssText: "button{color:white}"}
    ])
    const before = readDocumentCompiledStyleSheets(document)

    expect(() => acquireDocumentCompiledStyleSheets(document, [
      {id: "duplicate", cssText: "button{color:red}"},
      {id: "duplicate", cssText: "button{color:blue}"}
    ])).toThrow("id collision")
    expect(() => acquireDocumentCompiledStyleSheets(document, [
      {id: "owner", cssText: "button{color:black}"}
    ])).toThrow("id collision")
    expect(() => acquireDocumentCompiledStyleSheets(document, [
      {id: "   ", cssText: "button{color:black}"}
    ])).toThrow("id cannot be empty")
    expect(readDocumentCompiledStyleSheets(document)).toBe(before)

    owner.release()
  })

  test("publishes only the final active set of one Document transaction", () => {
    const document = createDocument()
    const revisions: number[] = []
    subscribeDocumentCompiledStyleSheets(document, change => revisions.push(change.revision))

    document.transaction(() => {
      const temporary = acquireDocumentCompiledStyleSheets(document, [
        {id: "temporary", cssText: "button{opacity:0.5}"}
      ])
      temporary.release()
    })

    expect(readDocumentCompiledStyleSheets(document)).toEqual({revision: 0, styleSheets: []})
    expect(revisions).toEqual([])
  })
})
