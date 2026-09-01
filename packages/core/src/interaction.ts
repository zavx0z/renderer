import {
  Event,
  HTMLElement,
  HTMLInputElement,
  HTMLOptionElement,
  HTMLSelectElement,
  HTMLTextAreaElement,
  MouseEvent,
  PointerEvent,
  WheelEvent,
  type Document,
  type Element,
} from "@zavx0z/dom"
import type {
  DisplayItem,
  HitMetadata,
  RenderBorder,
  RenderClip,
  RenderClipRadius,
  RenderFrame,
  RenderScrollMetrics,
  RenderTransform,
} from "./types.ts"
import {appendImmutableArray} from "./immutable-array.ts"
import type {DocumentInteractionState} from "./pseudo-state.ts"

export type PointerInput = Readonly<{
  clientX: number
  clientY: number
  pointerId?: number
  pointerType?: string
  button?: number
  buttons?: number
  pressure?: number
  isPrimary?: boolean
  timeStamp?: number
}>

export type WheelInput = Readonly<{
  clientX: number
  clientY: number
  deltaX?: number
  deltaY?: number
  deltaZ?: number
  deltaMode?: number
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}>

export type TitleTooltip = Readonly<{
  source: Element
  target: Element
  text: string
  lines: readonly string[]
  x: number
  y: number
  width: number
  height: number
}>

export type CreateDocumentInteractionControllerOptions = Readonly<{
  document: Document
  tooltipDelayMs?: number
  tooltipFontSize?: number
  tooltipMaxWidth?: number
  tooltipBackground?: string
  tooltipColor?: string
  interactionState?: DocumentInteractionState
}>

export interface DocumentInteractionController {
  readonly document: Document
  readonly hoveredElement: Element | null
  readonly pressedElement: Element | null
  readonly tooltip: TitleTooltip | null
  pointerMove(frame: RenderFrame, input: PointerInput): Element | null
  pointerDown(frame: RenderFrame, input: PointerInput): Element | null
  pointerUp(frame: RenderFrame, input: PointerInput): Element | null
  pointerCancel(frame: RenderFrame, input: PointerInput): void
  wheel(frame: RenderFrame, input: WheelInput): Element | null
  composeFrame(frame: RenderFrame, now?: number): RenderFrame
  dispose(): void
}

export type TitleCandidate = Readonly<{
  source: Element
  target: Element
  text: string
}>

const UA_TITLE_BACKGROUND_KEY = "ua:title-background"
const UA_TITLE_TEXT_KEY = "ua:title-text:"
const NO_CLIPS: readonly RenderClip[] = Object.freeze([])
const IDENTITY_TRANSFORM = Object.freeze({
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
})
const UA_TITLE_BORDER: RenderBorder = Object.freeze({
  widths: Object.freeze({top: 0, right: 0, bottom: 0, left: 0}),
  colors: Object.freeze({
    top: "#000000",
    right: "#000000",
    bottom: "#000000",
    left: "#000000",
  }),
  radii: Object.freeze({topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0}),
})

export const createDocumentInteractionController = (
  options: CreateDocumentInteractionControllerOptions,
): DocumentInteractionController => {
  if (
    options.interactionState !== undefined &&
    options.interactionState.document !== options.document
  ) throw new TypeError("interactionState belongs to another Document")
  const tooltipDelayMs = nonNegative(options.tooltipDelayMs ?? 500, "tooltipDelayMs")
  const tooltipFontSize = positive(options.tooltipFontSize ?? 12, "tooltipFontSize")
  const tooltipMaxWidth = positive(options.tooltipMaxWidth ?? 320, "tooltipMaxWidth")
  const tooltipBackground = options.tooltipBackground ?? "#111827f2"
  const tooltipColor = options.tooltipColor ?? "#f9fafb"
  let hovered: Element | null = null
  let pressedTarget: Element | null = null
  let pressedOwner: Element | null = null
  let pressedOwnerDisabled = false
  let rangeDrag: Readonly<{
    input: HTMLInputElement
    pointerId: number
    changed: boolean
  }> | null = null
  let textSelectionDrag: Readonly<{
    textArea: HTMLTextAreaElement
    pointerId: number
    anchor: number
  }> | null = null
  let titleCandidate: TitleCandidate | null = null
  let hoverStartedAt = 0
  let pointerX = 0
  let pointerY = 0
  let hasPointerPosition = false
  const activePointers = new Set<number>()
  let currentTooltip: TitleTooltip | null = null
  let cachedBase: RenderFrame | null = null
  let cachedSignature = ""
  let cachedPresentation: RenderFrame | null = null
  let disposed = false

  const controller: DocumentInteractionController = {
    document: options.document,
    get hoveredElement() {
      return hovered
    },
    get pressedElement() {
      return pressedOwner
    },
    get tooltip() {
      return currentTooltip
    },
    pointerMove(frame, input) {
      assertActive()
      validateFrame(frame)
      validatePointer(input)
      pointerX = input.clientX
      pointerY = input.clientY
      hasPointerPosition = true
      const now = input.timeStamp ?? Date.now()
      const id = pointerIdOf(input)
      const target = rangeDrag?.pointerId === id ? rangeDrag.input :
        textSelectionDrag?.pointerId === id ? textSelectionDrag.textArea :
        options.document.readPointerCaptureTarget(id) ??
        hitTest(frame, pointerX, pointerY)?.node ?? null
      transitionHover(target, input, now)
      const accepted = target?.dispatchEvent(pointerEvent("pointermove", input, null, true, true)) ?? true
      if (accepted && rangeDrag?.pointerId === id) updateRangeDrag(frame, input)
      if (accepted && textSelectionDrag?.pointerId === id) updateTextSelectionDrag(frame, input)
      invalidatePresentation()
      return target
    },
    pointerDown(frame, input) {
      assertActive()
      validateFrame(frame)
      validatePointer(input)
      pointerX = input.clientX
      pointerY = input.clientY
      hasPointerPosition = true
      const now = input.timeStamp ?? Date.now()
      const id = pointerIdOf(input)
      options.document.beginPointer(id)
      activePointers.add(id)
      const hit = hitTest(frame, pointerX, pointerY)
      options.document.lightDismissPopovers(hit?.node ?? null)
      options.document.closeSelectPickerOutside(hit?.node ?? null)
      const ownerHit = resolvePointerOwnerHit(frame, hit)
      transitionHover(hit?.node ?? null, input, now)
      pressedTarget = hit?.node ?? null
      pressedOwner = ownerHit?.node ?? pressedTarget
      pressedOwnerDisabled = ownerHit?.disabled ?? hit?.disabled ?? false
      options.interactionState?.setActiveElement(pressedTarget)
      titleCandidate = null
      currentTooltip = null
      if (hit) {
        const accepted = hit.node.dispatchEvent(
          pointerEvent("pointerdown", input, null, true, true),
        )
        if (accepted && ownerHit?.interactive === true && !ownerHit.disabled) {
          focusElement(ownerHit.node)
          if (ownerHit.node instanceof HTMLInputElement && ownerHit.node.type === "range") {
            rangeDrag = Object.freeze({input: ownerHit.node, pointerId: id, changed: false})
            updateRangeDrag(frame, input)
          } else if (ownerHit.node instanceof HTMLTextAreaElement && (input.button ?? 0) === 0) {
            const anchor = textAreaOffsetAtPoint(frame, ownerHit.node, input)
            if (anchor !== null) {
              textSelectionDrag = Object.freeze({textArea: ownerHit.node, pointerId: id, anchor})
              updateTextSelectionDrag(frame, input)
            }
          }
        }
      }
      invalidatePresentation()
      return hit?.node ?? null
    },
    pointerUp(frame, input) {
      assertActive()
      validateFrame(frame)
      validatePointer(input)
      pointerX = input.clientX
      pointerY = input.clientY
      hasPointerPosition = true
      const now = input.timeStamp ?? Date.now()
      const hit = hitTest(frame, pointerX, pointerY)
      const id = pointerIdOf(input)
      const captured = options.document.readPointerCaptureTarget(id)
      const released = rangeDrag?.pointerId === id
        ? rangeDrag.input
        : textSelectionDrag?.pointerId === id
          ? textSelectionDrag.textArea
          : captured ?? hit?.node ?? null
      const ownerHit = resolvePointerOwnerHitForTarget(frame, released, hit)
      transitionHover(released, input, now)
      const releasedOwner = ownerHit?.node ?? released
      const releasedOwnerDisabled = ownerHit?.disabled ?? hit?.disabled ?? false
      try {
        const accepted = released?.dispatchEvent(pointerEvent("pointerup", input, null, true, true)) ?? true
        if (accepted && rangeDrag?.pointerId === id) updateRangeDrag(frame, input)
        if (accepted && textSelectionDrag?.pointerId === id) updateTextSelectionDrag(frame, input)
        if (
          releasedOwner !== null &&
          releasedOwner === pressedOwner &&
          !pressedOwnerDisabled &&
          !releasedOwnerDisabled
        ) {
          activateElement(
            released !== null && released === pressedTarget ? released : releasedOwner,
            input,
          )
        }
        finishRangeDrag(id, true)
        finishTextSelectionDrag(id)
      } finally {
        options.document.endPointer(id)
        activePointers.delete(id)
        pressedTarget = null
        pressedOwner = null
        pressedOwnerDisabled = false
        options.interactionState?.setActiveElement(null)
        refreshTitleCandidate(now)
        invalidatePresentation()
      }
      return released
    },
    pointerCancel(frame, input) {
      assertActive()
      validateFrame(frame)
      validatePointer(input)
      const id = pointerIdOf(input)
      const target = rangeDrag?.pointerId === id ? rangeDrag.input :
        textSelectionDrag?.pointerId === id ? textSelectionDrag.textArea :
        options.document.readPointerCaptureTarget(id) ?? pressedTarget ?? hovered
      try {
        target?.dispatchEvent(pointerEvent("pointercancel", input, null, true, false))
      } finally {
        finishRangeDrag(id, false)
        finishTextSelectionDrag(id)
        options.document.endPointer(id)
        activePointers.delete(id)
        pressedTarget = null
        pressedOwner = null
        pressedOwnerDisabled = false
        options.interactionState?.setActiveElement(null)
        currentTooltip = null
        refreshTitleCandidate(input.timeStamp ?? Date.now())
        invalidatePresentation()
      }
    },
    wheel(frame, input) {
      assertActive()
      validateFrame(frame)
      validateWheel(input)
      const target = hitTest(frame, input.clientX, input.clientY)?.node ?? null
      if (target === null) return null
      const accepted = target.dispatchEvent(wheelEvent(input))
      if (accepted) applyWheel(frame, target, input, options.document)
      currentTooltip = null
      invalidatePresentation()
      return target
    },
    composeFrame(frame, now = Date.now()) {
      assertActive()
      validateFrame(frame)
      synchronizeHover(frame, now)
      refreshTitleCandidate(now)
      const tooltip = createTooltip(
        titleCandidate,
        hovered,
        pointerX,
        pointerY,
        frame,
        now,
        hoverStartedAt,
        tooltipDelayMs,
        tooltipFontSize,
        tooltipMaxWidth,
      )
      currentTooltip = tooltip
      if (tooltip === null) {
        cachedBase = null
        cachedPresentation = null
        cachedSignature = ""
        return frame
      }

      const signature = [
        tooltip.text,
        tooltip.x,
        tooltip.y,
        tooltip.width,
        tooltip.height,
        ...tooltip.lines,
      ].join("\u0000")
      if (
        cachedBase === frame &&
        cachedPresentation !== null &&
        cachedSignature === signature
      ) {
        return cachedPresentation
      }

      const overlay = tooltipDisplayItems(
        tooltip,
        tooltipFontSize,
        tooltipBackground,
        tooltipColor,
      )
      const presentation = Object.freeze({
        ...frame,
        displayList: appendImmutableArray(frame.displayList, overlay),
      })
      cachedBase = frame
      cachedSignature = signature
      cachedPresentation = presentation
      return presentation
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const pointerId of activePointers) options.document.endPointer(pointerId)
      activePointers.clear()
      rangeDrag = null
      textSelectionDrag = null
      hovered = null
      pressedTarget = null
      pressedOwner = null
      pressedOwnerDisabled = false
      options.interactionState?.setHoveredElement(null)
      options.interactionState?.setActiveElement(null)
      titleCandidate = null
      currentTooltip = null
      invalidatePresentation()
    },
  }

  return Object.freeze(controller)

  function transitionHover(
    target: Element | null,
    input: PointerInput,
    now: number,
  ): void {
    if (target === hovered) {
      refreshTitleCandidate(now)
      return
    }

    const previous = hovered
    if (previous !== null) {
      previous.dispatchEvent(pointerEvent("pointerout", input, target, true, true))
      for (const element of exitedElements(previous, target)) {
        element.dispatchEvent(pointerEvent("pointerleave", input, target, false, false))
      }
    }

    hovered = target
    options.interactionState?.setHoveredElement(target)
    titleCandidate = resolveTitle(target)
    hoverStartedAt = now
    currentTooltip = null

    if (target !== null) {
      target.dispatchEvent(pointerEvent("pointerover", input, previous, true, true))
      for (const element of enteredElements(previous, target)) {
        element.dispatchEvent(pointerEvent("pointerenter", input, previous, false, false))
      }
    }
  }

  function synchronizeHover(frame: RenderFrame, now: number): void {
    if (!hasPointerPosition) return
    const target = hitTest(frame, pointerX, pointerY)?.node ?? null
    if (target === hovered) return
    transitionHover(target, {
      clientX: pointerX,
      clientY: pointerY,
      timeStamp: now,
    }, now)
  }

  function refreshTitleCandidate(now: number): void {
    const next = resolveTitle(hovered)
    if (
      next?.source === titleCandidate?.source &&
      next?.target === titleCandidate?.target &&
      next?.text === titleCandidate?.text
    ) {
      return
    }
    titleCandidate = next
    hoverStartedAt = now
    currentTooltip = null
  }

  function validateFrame(frame: RenderFrame): void {
    if (frame.document !== options.document) {
      throw new TypeError("Interaction frame belongs to another Document")
    }
  }

  function assertActive(): void {
    if (disposed) throw new Error("Cannot use a disposed interaction controller")
  }

  function invalidatePresentation(): void {
    cachedBase = null
    cachedSignature = ""
    cachedPresentation = null
  }

  function updateRangeDrag(frame: RenderFrame, input: PointerInput): void {
    const drag = rangeDrag
    if (drag === null || drag.pointerId !== pointerIdOf(input)) return
    const track = frame.displayList.find((item): item is Extract<DisplayItem, {kind: "rect"}> =>
      item.kind === "rect" && item.node === drag.input && item.key === "track"
    )
    if (track === undefined) return
    const point = inverseTransformPoint(track.transform, input.clientX, input.clientY)
    if (point === null) return
    const ratio = track.width <= 0 ? 0 : clamp((point.x - track.x) / track.width, 0, 1)
    const minimum = rangeEndpoint(drag.input.min) ?? 0
    const declaredMaximum = rangeEndpoint(drag.input.max) ?? 100
    const maximum = Math.max(minimum, declaredMaximum)
    const previous = drag.input.value
    drag.input.valueAsNumber = minimum + (maximum - minimum) * ratio
    if (drag.input.value === previous) return
    rangeDrag = Object.freeze({...drag, changed: true})
    drag.input.dispatchEvent(new Event("input", {bubbles: true, composed: true}))
  }

  function finishRangeDrag(pointerId: number, commit: boolean): void {
    const drag = rangeDrag
    if (drag === null || drag.pointerId !== pointerId) return
    rangeDrag = null
    if (commit && drag.changed) {
      drag.input.dispatchEvent(new Event("change", {bubbles: true}))
    }
  }

  function updateTextSelectionDrag(frame: RenderFrame, input: PointerInput): void {
    const drag = textSelectionDrag
    if (drag === null || drag.pointerId !== pointerIdOf(input)) return
    const focus = textAreaOffsetAtPoint(frame, drag.textArea, input)
    if (focus === null) return
    const start = Math.min(drag.anchor, focus)
    const end = Math.max(drag.anchor, focus)
    const direction = focus < drag.anchor ? "backward" : focus > drag.anchor ? "forward" : "none"
    if (
      drag.textArea.selectionStart === start &&
      drag.textArea.selectionEnd === end &&
      drag.textArea.selectionDirection === direction
    ) return
    drag.textArea.setSelectionRange(start, end, direction)
    drag.textArea.dispatchEvent(new Event("select", {bubbles: true, composed: true}))
  }

  function finishTextSelectionDrag(pointerId: number): void {
    if (textSelectionDrag?.pointerId === pointerId) textSelectionDrag = null
  }
}

const rangeEndpointPattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/

const rangeEndpoint = (value: string): number | null => {
  if (!rangeEndpointPattern.test(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const textAreaOffsetAtPoint = (
  frame: RenderFrame,
  textArea: HTMLTextAreaElement,
  input: PointerInput,
): number | null => {
  const hit = frame.hits.get(textArea)
  const metrics = hit?.textControl
  const box = frame.boxByNode.get(textArea)
  if (!hit || !metrics?.exactOffsetMapping || !box || metrics.lineHeight <= 0) return null
  const point = inverseTransformPoint(hit.transform, input.clientX, input.clientY)
  if (point === null) return null
  const lines = textArea.value.split("\n")
  const lineIndex = Math.max(
    0,
    Math.min(lines.length - 1, Math.floor((point.y - box.contentY) / metrics.lineHeight)),
  )
  const line = lines[lineIndex] ?? ""
  const lineItem = frame.displayList.find((item): item is Extract<DisplayItem, {kind: "text"}> =>
    item.kind === "text" && item.node === textArea && item.key === `value:${lineIndex}`
  )
  const lineX = lineItem?.x ?? box.contentX
  const column = metrics.characterAdvance <= 0
    ? 0
    : Math.max(0, Math.min(line.length, Math.round((point.x - lineX) / metrics.characterAdvance)))
  let offset = column
  for (let index = 0; index < lineIndex; index += 1) offset += (lines[index]?.length ?? 0) + 1
  return offset
}

export const hitTest = (
  frame: RenderFrame,
  x: number,
  y: number,
): HitMetadata | null => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const hits = frame.hitOrder ?? [...frame.hits.values()]
  for (let index = hits.length - 1; index >= 0; index--) {
    const hit = hits[index]
    const transform = hit === undefined ? null : hitTransform(frame, hit)
    const local = transform === null ? null : inverseTransformPoint(transform, x, y)
    if (
      hit !== undefined &&
      transform !== null &&
      local !== null &&
      (hit.path === undefined
        ? local.x >= hit.x &&
          local.y >= hit.y &&
          local.x < hit.x + hit.width &&
          local.y < hit.y + hit.height
        : pointInStrokedPath(hit, transform, x, y)) &&
      hit.clips.every((clip) => pointInClip(frame, clip, x, y))
    ) {
      return hit
    }
  }
  return null
}

const hitTransform = (frame: RenderFrame, hit: HitMetadata): RenderTransform => {
  const owner = hit.path?.presentationOwner
  return owner === null || owner === undefined
    ? hit.transform
    : frame.presentationTransforms?.get(owner) ?? hit.transform
}

const pointInStrokedPath = (
  hit: HitMetadata,
  transform: RenderTransform,
  x: number,
  y: number,
): boolean => {
  const path = hit.path
  if (path === undefined || transform.scaleX === 0 || transform.scaleY === 0) return false
  const bounds = path.geometry.bounds
  const first = transformedPathPoint(
    transform,
    path.originX + bounds.x,
    path.originY + bounds.y,
  )
  const second = transformedPathPoint(
    transform,
    path.originX + bounds.x + bounds.width,
    path.originY + bounds.y + bounds.height,
  )
  const coarseRadius = Math.max(
    path.pointerHitWidth,
    path.pointerHitWidth * Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY)),
    path.strokeWidth * Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY)),
  ) / 2
  if (
    x < Math.min(first.x, second.x) - coarseRadius ||
    y < Math.min(first.y, second.y) - coarseRadius ||
    x > Math.max(first.x, second.x) + coarseRadius ||
    y > Math.max(first.y, second.y) + coarseRadius
  ) return false

  for (const segment of path.geometry.segments) {
    const from = transformedPathPoint(
      transform,
      path.originX + segment.from.x,
      path.originY + segment.from.y,
    )
    const to = transformedPathPoint(
      transform,
      path.originX + segment.to.x,
      path.originY + segment.to.y,
    )
    const localX = segment.to.x - segment.from.x
    const localY = segment.to.y - segment.from.y
    const localLength = Math.hypot(localX, localY)
    const normalScale = localLength === 0
      ? 0
      : Math.hypot(
          transform.scaleX * -localY / localLength,
          transform.scaleY * localX / localLength,
        )
    const targetWidth = Math.max(
      path.pointerHitWidth,
      path.pointerHitWidth * normalScale,
      path.strokeWidth * normalScale,
    )
    if (pointSegmentDistanceSquared(x, y, from.x, from.y, to.x, to.y) <= (targetWidth / 2) ** 2) {
      return true
    }
  }
  return false
}

const transformedPathPoint = (
  transform: RenderTransform,
  x: number,
  y: number,
): Readonly<{x: number; y: number}> => ({
  x: transform.scaleX * x + transform.translateX,
  y: transform.scaleY * y + transform.translateY,
})

const pointSegmentDistanceSquared = (
  x: number,
  y: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number => {
  const segmentX = toX - fromX
  const segmentY = toY - fromY
  const lengthSquared = segmentX * segmentX + segmentY * segmentY
  if (lengthSquared === 0) return (x - fromX) ** 2 + (y - fromY) ** 2
  const amount = Math.max(
    0,
    Math.min(1, ((x - fromX) * segmentX + (y - fromY) * segmentY) / lengthSquared),
  )
  const nearestX = fromX + segmentX * amount
  const nearestY = fromY + segmentY * amount
  return (x - nearestX) ** 2 + (y - nearestY) ** 2
}

/** Resolves the nearest interactive or disabled semantic owner of an exact hit. */
export const resolvePointerOwnerHit = (
  frame: RenderFrame,
  hit: HitMetadata | null,
): HitMetadata | null => {
  if (hit === null) return null
  for (
    let element: Element | null = hit.node;
    element !== null;
    element = element.parentElement
  ) {
    const candidate = frame.hits.get(element)
    if (candidate?.interactive === true || candidate?.disabled === true) return candidate
  }
  return null
}

const resolvePointerOwnerHitForTarget = (
  frame: RenderFrame,
  target: Element | null,
  hit: HitMetadata | null,
): HitMetadata | null => {
  if (target === null) return null
  if (hit?.node === target) return resolvePointerOwnerHit(frame, hit)
  for (
    let element: Element | null = target;
    element !== null;
    element = element.parentElement
  ) {
    const candidate = frame.hits.get(element)
    if (candidate?.interactive === true || candidate?.disabled === true) return candidate
  }
  return null
}

const pointInClip = (frame: RenderFrame, clip: RenderClip, x: number, y: number): boolean => {
  const transform = clip.presentationOwner === null || clip.presentationOwner === undefined
    ? clip.transform
    : frame.presentationTransforms?.get(clip.presentationOwner) ?? clip.transform
  const local = inverseTransformPoint(transform, x, y)
  if (local === null) return false
  x = local.x
  y = local.y
  const right = clip.x + clip.width
  const bottom = clip.y + clip.height
  if (clip.clipX && (x < clip.x || x >= right)) return false
  if (clip.clipY && (y < clip.y || y >= bottom)) return false
  if (!clip.clipX || !clip.clipY) return true

  return pointInRoundedCorner(
    x,
    y,
    clip.x,
    clip.y,
    clip.radii.topLeft,
    "top-left",
  ) &&
    pointInRoundedCorner(
      x,
      y,
      right,
      clip.y,
      clip.radii.topRight,
      "top-right",
    ) &&
    pointInRoundedCorner(
      x,
      y,
      right,
      bottom,
      clip.radii.bottomRight,
      "bottom-right",
    ) &&
    pointInRoundedCorner(
      x,
      y,
      clip.x,
      bottom,
      clip.radii.bottomLeft,
      "bottom-left",
    )
}

const inverseTransformPoint = (
  transform: Readonly<{
    scaleX: number
    scaleY: number
    translateX: number
    translateY: number
  }>,
  x: number,
  y: number,
): Readonly<{x: number; y: number}> | null => {
  if (transform.scaleX === 0 || transform.scaleY === 0) return null
  const localX = (x - transform.translateX) / transform.scaleX
  const localY = (y - transform.translateY) / transform.scaleY
  return Number.isFinite(localX) && Number.isFinite(localY)
    ? {x: localX, y: localY}
    : null
}

const pointInRoundedCorner = (
  x: number,
  y: number,
  cornerX: number,
  cornerY: number,
  radius: RenderClipRadius,
  corner: "top-left" | "top-right" | "bottom-right" | "bottom-left",
): boolean => {
  if (radius.x <= 0 || radius.y <= 0) return true
  const left = corner === "top-left" || corner === "bottom-left"
  const top = corner === "top-left" || corner === "top-right"
  const centerX = cornerX + (left ? radius.x : -radius.x)
  const centerY = cornerY + (top ? radius.y : -radius.y)
  const inCornerX = left ? x < centerX : x >= centerX
  const inCornerY = top ? y < centerY : y >= centerY
  if (!inCornerX || !inCornerY) return true
  const dx = x - centerX
  const dy = y - centerY
  return (dx * dx) / (radius.x * radius.x) +
    (dy * dy) / (radius.y * radius.y) <= 1
}

export const resolveTitle = (target: Element | null): TitleCandidate | null => {
  if (target === null) return null
  for (let element: Element | null = target; element !== null; element = element.parentElement) {
    if (!element.hasAttribute("title")) continue
    const text = element.getAttribute("title") ?? ""
    if (text === "") return null
    return Object.freeze({source: element, target, text})
  }
  return null
}

const pointerEvent = (
  type: string,
  input: PointerInput,
  relatedTarget: Element | null,
  bubbles: boolean,
  cancelable: boolean,
): PointerEvent =>
  new PointerEvent(type, {
    bubbles,
    cancelable,
    composed: true,
    clientX: input.clientX,
    clientY: input.clientY,
    pointerId: input.pointerId ?? 1,
    pointerType: input.pointerType ?? "mouse",
    button: input.button ?? 0,
    buttons: input.buttons ?? 0,
    pressure: input.pressure ?? 0,
    isPrimary: input.isPrimary ?? true,
    relatedTarget,
  })

const pointerIdOf = (input: PointerInput): number => input.pointerId ?? 1

const wheelEvent = (input: WheelInput): WheelEvent =>
  new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: input.clientX,
    clientY: input.clientY,
    deltaX: input.deltaX ?? 0,
    deltaY: input.deltaY ?? 0,
    deltaZ: input.deltaZ ?? 0,
    deltaMode: input.deltaMode ?? WheelEvent.DOM_DELTA_PIXEL,
    ctrlKey: input.ctrlKey ?? false,
    shiftKey: input.shiftKey ?? false,
    altKey: input.altKey ?? false,
    metaKey: input.metaKey ?? false,
  })

const applyWheel = (
  frame: RenderFrame,
  target: Element,
  input: WheelInput,
  document: Document,
): void => {
  const xOwner = findScrollOwner(
    frame,
    target,
    "x",
    input.deltaX ?? 0,
  )
  const yOwner = findScrollOwner(
    frame,
    target,
    "y",
    input.deltaY ?? 0,
  )
  if (!xOwner && !yOwner) return

  document.transaction(() => {
    if (xOwner) {
      xOwner.element.scrollLeft = clamp(
        Math.min(xOwner.metrics.maxScrollLeft, xOwner.element.scrollLeft) +
          wheelDelta(
            input.deltaX ?? 0,
            input.deltaMode ?? WheelEvent.DOM_DELTA_PIXEL,
            xOwner.metrics.clientWidth,
          ),
        0,
        xOwner.metrics.maxScrollLeft,
      )
    }
    if (yOwner) {
      yOwner.element.scrollTop = clamp(
        Math.min(yOwner.metrics.maxScrollTop, yOwner.element.scrollTop) +
          wheelDelta(
            input.deltaY ?? 0,
            input.deltaMode ?? WheelEvent.DOM_DELTA_PIXEL,
            yOwner.metrics.clientHeight,
          ),
        0,
        yOwner.metrics.maxScrollTop,
      )
    }
  })
}

type ScrollOwner = Readonly<{
  element: HTMLElement
  metrics: RenderScrollMetrics
}>

const findScrollOwner = (
  frame: RenderFrame,
  target: Element,
  axis: "x" | "y",
  delta: number,
): ScrollOwner | null => {
  if (delta === 0) return null
  for (
    let element: Element | null = target;
    element !== null;
    element = element.parentElement
  ) {
    if (!(element instanceof HTMLElement)) continue
    const metrics = frame.scrolls.get(element)
    if (!metrics || !hasRemainingScroll(element, metrics, axis, delta)) continue
    return Object.freeze({element, metrics})
  }
  return null
}

const hasRemainingScroll = (
  element: HTMLElement,
  metrics: RenderScrollMetrics,
  axis: "x" | "y",
  delta: number,
): boolean => {
  const maximum = axis === "x"
    ? metrics.maxScrollLeft
    : metrics.maxScrollTop
  const requested = axis === "x" ? element.scrollLeft : element.scrollTop
  const offset = Math.min(maximum, requested)
  return delta < 0 ? offset > 0 : offset < maximum
}

const wheelDelta = (
  delta: number,
  mode: number,
  clientSize: number,
): number => {
  if (mode === WheelEvent.DOM_DELTA_LINE) return delta * 16
  if (mode === WheelEvent.DOM_DELTA_PAGE) return delta * clientSize
  return delta
}

const activateElement = (element: Element, input: PointerInput): void => {
  if (element instanceof HTMLOptionElement) {
    const select = selectOwner(element)
    if (select !== null) {
      select.choosePickerOption(element)
      return
    }
  }
  if (element instanceof HTMLSelectElement) {
    const accepted = element.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: input.clientX,
      clientY: input.clientY,
      button: input.button ?? 0,
      buttons: input.buttons ?? 0,
    }))
    if (!accepted) return
    if (element.pickerVisibilityState === "open") element.hidePicker()
    else element.showPicker()
    return
  }
  const activation = (element as Element & {click?: () => void}).click
  if (typeof activation === "function") {
    activation.call(element)
    return
  }
  element.dispatchEvent(new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: input.clientX,
    clientY: input.clientY,
    button: input.button ?? 0,
    buttons: input.buttons ?? 0,
  }))
}

const selectOwner = (option: HTMLOptionElement): HTMLSelectElement | null => {
  for (let current = option.parentElement; current !== null; current = current.parentElement) {
    if (current instanceof HTMLSelectElement) return current
  }
  return null
}

const focusElement = (element: Element): void => {
  const focus = (element as Element & {focus?: () => void}).focus
  if (typeof focus === "function") focus.call(element)
}

const resolveElementPath = (element: Element | null): Element[] => {
  const path: Element[] = []
  for (let current = element; current !== null; current = current.parentElement) {
    path.push(current)
  }
  return path
}

const exitedElements = (
  previous: Element,
  next: Element | null,
): readonly Element[] => {
  const nextPath = new Set(resolveElementPath(next))
  return resolveElementPath(previous).filter((element) => !nextPath.has(element))
}

const enteredElements = (
  previous: Element | null,
  next: Element,
): readonly Element[] => {
  const previousPath = new Set(resolveElementPath(previous))
  return resolveElementPath(next)
    .filter((element) => !previousPath.has(element))
    .reverse()
}

const createTooltip = (
  candidate: TitleCandidate | null,
  hovered: Element | null,
  pointerX: number,
  pointerY: number,
  frame: RenderFrame,
  now: number,
  hoverStartedAt: number,
  delay: number,
  fontSize: number,
  maxWidth: number,
): TitleTooltip | null => {
  if (
    candidate === null ||
    hovered === null ||
    now - hoverStartedAt < delay ||
    frame.viewport.width <= 0 ||
    frame.viewport.height <= 0
  ) {
    return null
  }

  const margin = 4
  const paddingX = 8
  const paddingY = 6
  const lineHeight = fontSize * 1.25
  const availableWidth = Math.max(1, frame.viewport.width - margin * 2)
  const widthLimit = Math.min(maxWidth, availableWidth)
  const charactersPerLine = Math.max(
    1,
    Math.floor((widthLimit - paddingX * 2) / (fontSize * 0.6)),
  )
  const wrapped = wrapTitle(candidate.text, charactersPerLine)
  const maximumLines = Math.max(
    1,
    Math.floor((frame.viewport.height - margin * 2 - paddingY * 2) / lineHeight),
  )
  const lines = fitLines(wrapped, maximumLines)
  const textWidth = lines.reduce(
    (maximum, line) => Math.max(maximum, line.length * fontSize * 0.6),
    0,
  )
  const width = Math.min(widthLimit, Math.max(1, textWidth + paddingX * 2))
  const height = Math.min(
    frame.viewport.height - margin * 2,
    lines.length * lineHeight + paddingY * 2,
  )
  const preferredX = pointerX + 12
  const below = pointerY + 18
  const above = pointerY - height - 12
  const preferredY = below + height + margin <= frame.viewport.height ? below : above
  const x = clamp(preferredX, margin, frame.viewport.width - width - margin)
  const y = clamp(preferredY, margin, frame.viewport.height - height - margin)

  return Object.freeze({
    source: candidate.source,
    target: candidate.target,
    text: candidate.text,
    lines: Object.freeze(lines),
    x,
    y,
    width,
    height,
  })
}

const tooltipDisplayItems = (
  tooltip: TitleTooltip,
  fontSize: number,
  background: string,
  color: string,
): readonly DisplayItem[] => {
  const lineHeight = fontSize * 1.25
  const items: DisplayItem[] = [
    Object.freeze({
      kind: "rect",
      key: UA_TITLE_BACKGROUND_KEY,
      node: tooltip.source,
      x: tooltip.x,
      y: tooltip.y,
      width: tooltip.width,
      height: tooltip.height,
      color: background,
      opacity: 1,
      border: UA_TITLE_BORDER,
      shadow: null,
      clips: NO_CLIPS,
      transform: IDENTITY_TRANSFORM,
    }),
  ]
  for (let index = 0; index < tooltip.lines.length; index++) {
    items.push(Object.freeze({
      kind: "text",
      key: `${UA_TITLE_TEXT_KEY}${index}`,
      node: tooltip.source,
      text: tooltip.lines[index] ?? "",
      x: tooltip.x + 8,
      y: tooltip.y + 6 + index * lineHeight,
      color,
      fontSize,
      lineHeight,
      letterSpacing: 0,
      opacity: 1,
      clips: NO_CLIPS,
      transform: IDENTITY_TRANSFORM,
    }))
  }
  return Object.freeze(items)
}

const wrapTitle = (text: string, maximum: number): string[] => {
  const output: string[] = []
  for (const sourceLine of text.split("\n")) {
    if (sourceLine.length === 0) {
      output.push("")
      continue
    }
    let remaining = sourceLine
    while (remaining.length > maximum) {
      const candidate = remaining.slice(0, maximum + 1)
      const space = candidate.lastIndexOf(" ")
      const cut = space > 0 ? space : maximum
      output.push(remaining.slice(0, cut))
      remaining = remaining.slice(cut)
      if (remaining.startsWith(" ")) remaining = remaining.slice(1)
    }
    output.push(remaining)
  }
  return output.length > 0 ? output : [""]
}

const fitLines = (lines: readonly string[], maximum: number): string[] => {
  if (lines.length <= maximum) return [...lines]
  const fitted = lines.slice(0, maximum)
  const last = fitted.at(-1) ?? ""
  fitted[fitted.length - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`
  return fitted
}

const validatePointer = (input: PointerInput): void => {
  if (!Number.isFinite(input.clientX) || !Number.isFinite(input.clientY)) {
    throw new RangeError("Pointer coordinates must be finite")
  }
}

const validateWheel = (input: WheelInput): void => {
  if (!Number.isFinite(input.clientX) || !Number.isFinite(input.clientY))
    throw new RangeError("Wheel coordinates must be finite")
  for (const value of [input.deltaX ?? 0, input.deltaY ?? 0, input.deltaZ ?? 0]) {
    if (!Number.isFinite(value))
      throw new RangeError("Wheel deltas must be finite")
  }
  const mode = input.deltaMode ?? WheelEvent.DOM_DELTA_PIXEL
  if (
    !Number.isSafeInteger(mode) ||
    mode < WheelEvent.DOM_DELTA_PIXEL ||
    mode > WheelEvent.DOM_DELTA_PAGE
  )
    throw new RangeError("Wheel deltaMode must be pixel, line or page")
}

const nonNegative = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`)
  }
  return value
}

const positive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number`)
  }
  return value
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
