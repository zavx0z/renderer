import type {DisplayItem, RenderFrame} from "./types.ts"

export type CanonicalRenderFrameOperation = Readonly<{
  fromIndex: number
  toIndex: number
  count: 1
  replacement: DisplayItem
}>

export type CanonicalRenderFrameChanges = Readonly<{
  previous: RenderFrame
  indexes: readonly number[]
  operations?: readonly CanonicalRenderFrameOperation[]
}>

type StoredCanonicalRenderFrameChanges = Readonly<{
  previous: WeakRef<RenderFrame>
  indexes: readonly number[]
  operations?: readonly CanonicalRenderFrameOperation[]
}>

const canonicalDisplayChanges = new WeakMap<RenderFrame, StoredCanonicalRenderFrameChanges>()

export function readCanonicalRenderFrameChangeState(
  frame: RenderFrame,
): CanonicalRenderFrameChanges | null {
  const stored = canonicalDisplayChanges.get(frame)
  if (stored === undefined) return null
  const previous = stored.previous.deref()
  if (previous === undefined) {
    canonicalDisplayChanges.delete(frame)
    return null
  }
  return Object.freeze({
    previous,
    indexes: stored.indexes,
    ...(stored.operations === undefined ? {} : {operations: stored.operations}),
  })
}

export function recordCanonicalRenderFrameChanges(
  frame: RenderFrame,
  previous: RenderFrame,
  indexes: readonly number[],
  operations?: readonly CanonicalRenderFrameOperation[],
): void {
  canonicalDisplayChanges.set(frame, Object.freeze({
    previous: new WeakRef(previous),
    indexes: Object.freeze([...indexes]),
    ...(operations === undefined ? {} : {
      operations: Object.freeze(operations.map((operation) => Object.freeze({...operation}))),
    }),
  }))
}
