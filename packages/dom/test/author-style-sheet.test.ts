import {describe, expect, test} from "bun:test"
import {
  acquireDocumentAuthorStyleSheetOwner,
  createDocument,
  readDocumentAuthorStyleSheets,
  subscribeDocumentAuthorStyleSheets
} from "../src/index.ts"

describe("Document author stylesheet ownership", () => {
  test("publishes one immutable ordered set and releases it", () => {
    const document = createDocument()
    const revisions: number[] = []
    const unsubscribe = subscribeDocumentAuthorStyleSheets(document, change => {
      expect(change.document).toBe(document)
      expect(Object.isFrozen(change.styleSheets)).toBeTrue()
      revisions.push(change.revision)
    })
    expect(readDocumentAuthorStyleSheets(document)).toEqual({revision: 0, styleSheets: []})

    const owner = acquireDocumentAuthorStyleSheetOwner(document)
    owner.replace([
      {id: "tokens", cssText: ":root{--accent:#123456}"},
      {id: "controls", cssText: "button{color:var(--accent)}"},
      {id: "tokens", cssText: ":root{--accent:#123456}"}
    ])
    expect(readDocumentAuthorStyleSheets(document)).toEqual({
      revision: 1,
      styleSheets: [
        {id: "tokens", cssText: ":root{--accent:#123456}"},
        {id: "controls", cssText: "button{color:var(--accent)}"}
      ]
    })

    owner.replace([
      {id: "tokens", cssText: ":root{--accent:#123456}"},
      {id: "controls", cssText: "button{color:var(--accent)}"}
    ])
    expect(revisions).toEqual([1])
    owner.replace([
      {id: "controls", cssText: "button{color:var(--accent)}"},
      {id: "tokens", cssText: ":root{--accent:#123456}"}
    ])
    expect(readDocumentAuthorStyleSheets(document).revision).toBe(2)

    owner.release()
    owner.release()
    expect(readDocumentAuthorStyleSheets(document)).toEqual({revision: 3, styleSheets: []})
    expect(() => owner.replace([])).toThrow("released")
    unsubscribe()
  })

  test("rejects collisions and concurrent owners atomically", () => {
    const document = createDocument()
    const owner = acquireDocumentAuthorStyleSheetOwner(document)
    owner.replace([{id: "theme", cssText: ":root{color:white}"}])
    const before = readDocumentAuthorStyleSheets(document)

    expect(() => acquireDocumentAuthorStyleSheetOwner(document)).toThrow("already acquired")
    expect(() => owner.replace([
      {id: "theme", cssText: ":root{color:white}"},
      {id: "theme", cssText: ":root{color:black}"}
    ])).toThrow("id collision")
    expect(readDocumentAuthorStyleSheets(document)).toBe(before)

    owner.release()
    const replacement = acquireDocumentAuthorStyleSheetOwner(document)
    replacement.release()
  })

  test("coalesces transactional replacement to the final ordered set", () => {
    const document = createDocument()
    const owner = acquireDocumentAuthorStyleSheetOwner(document)
    const revisions: number[] = []
    subscribeDocumentAuthorStyleSheets(document, change => revisions.push(change.revision))

    document.transaction(() => {
      owner.replace([{id: "temporary", cssText: "button{opacity:.5}"}])
      owner.replace([])
    })

    expect(readDocumentAuthorStyleSheets(document)).toEqual({revision: 0, styleSheets: []})
    expect(revisions).toEqual([])
    owner.release()
  })
})
