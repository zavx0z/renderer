import {describe, expect, test} from "bun:test"
import {claimBrowserPresentationHost} from "../src/presentation-host.ts"

describe("renderer-browser presentation host claim", () => {
  test("allows exactly one host per native Document and exact canvas", () => {
    const firstDocument = {}
    const secondDocument = {}
    const firstCanvas = canvas(firstDocument)
    const siblingCanvas = canvas(firstDocument)
    const foreignCanvas = canvas(secondDocument)
    const first = claimBrowserPresentationHost(firstCanvas)

    expect(() => claimBrowserPresentationHost(firstCanvas)).toThrow("canvas already owns")
    expect(() => claimBrowserPresentationHost(siblingCanvas)).toThrow("Document already owns")
    const foreign = claimBrowserPresentationHost(foreignCanvas)

    first.release()
    const replacement = claimBrowserPresentationHost(siblingCanvas)
    replacement.release()
    foreign.release()
  })

  test("falls back to exact canvas ownership when a test seam has no native Document", () => {
    const owner = canvas(undefined)
    const first = claimBrowserPresentationHost(owner)
    expect(() => claimBrowserPresentationHost(owner)).toThrow("canvas already owns")
    first.release()
    claimBrowserPresentationHost(owner).release()
  })
})

const canvas = (ownerDocument: object | undefined): HTMLCanvasElement => ({
  ...(ownerDocument === undefined ? {} : {ownerDocument}),
}) as unknown as HTMLCanvasElement
