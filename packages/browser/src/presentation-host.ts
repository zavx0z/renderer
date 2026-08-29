type PresentationHostClaim = Readonly<{
  release(): void
}>

type ClaimRecord = Readonly<{
  token: symbol
  canvas: object
  owner: object
}>

const claimsByCanvas = new WeakMap<object, ClaimRecord>()
const claimsByOwner = new WeakMap<object, ClaimRecord>()

/**
 * Claims the one renderer-browser presentation host allowed in a native page.
 *
 * Real canvases are keyed by their native `ownerDocument`. Test seams without
 * an owner Document fall back to exact canvas identity, preserving the same-
 * canvas exclusion without inventing a global browser realm.
 */
export const claimBrowserPresentationHost = (
  canvas: HTMLCanvasElement,
): PresentationHostClaim => {
  const canvasOwner = canvas as unknown as object
  const owner = nativeOwner(canvas)
  if (claimsByCanvas.has(canvasOwner)) {
    throw new Error("The canvas already owns a renderer-browser presentation host")
  }
  if (claimsByOwner.has(owner)) {
    throw new Error("The native Document already owns a renderer-browser presentation host")
  }

  const record = Object.freeze({token: Symbol("renderer-browser-host"), canvas: canvasOwner, owner})
  claimsByCanvas.set(canvasOwner, record)
  claimsByOwner.set(owner, record)
  let released = false

  return Object.freeze({
    release() {
      if (released) return
      released = true
      if (claimsByCanvas.get(canvasOwner)?.token === record.token) claimsByCanvas.delete(canvasOwner)
      if (claimsByOwner.get(owner)?.token === record.token) claimsByOwner.delete(owner)
    },
  })
}

const nativeOwner = (canvas: HTMLCanvasElement): object => {
  const ownerDocument = (canvas as unknown as {ownerDocument?: unknown}).ownerDocument
  return ownerDocument !== null && typeof ownerDocument === "object"
    ? ownerDocument
    : canvas as unknown as object
}
