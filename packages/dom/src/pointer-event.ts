import {toLong} from "./internal/web-idl.ts"
import {MouseEvent} from "./mouse-event.ts"
import type {MouseEventInit} from "./mouse-event.ts"

export type PointerEventInit = MouseEventInit & Readonly<{
  pointerId?: number
  width?: number
  height?: number
  pressure?: number
  tangentialPressure?: number
  tiltX?: number
  tiltY?: number
  twist?: number
  altitudeAngle?: number
  azimuthAngle?: number
  pointerType?: string
  isPrimary?: boolean
  persistentDeviceId?: number
  coalescedEvents?: readonly PointerEvent[]
  predictedEvents?: readonly PointerEvent[]
}>

type PointerSamples = Readonly<{
  coalescedEvents: readonly PointerEvent[]
  predictedEvents: readonly PointerEvent[]
}>

export class PointerEvent extends MouseEvent {
  readonly pointerId: number
  readonly width: number
  readonly height: number
  readonly pressure: number
  readonly tangentialPressure: number
  readonly tiltX: number
  readonly tiltY: number
  readonly twist: number
  readonly altitudeAngle: number
  readonly azimuthAngle: number
  readonly pointerType: string
  readonly isPrimary: boolean
  readonly persistentDeviceId: number
  private readonly pointerSamples: PointerSamples | null

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = toLong(init.pointerId ?? 0)
    this.width = Number(init.width ?? 1)
    this.height = Number(init.height ?? 1)
    this.pressure = Number(init.pressure ?? 0)
    this.tangentialPressure = Number(init.tangentialPressure ?? 0)
    this.tiltX = toLong(init.tiltX ?? 0)
    this.tiltY = toLong(init.tiltY ?? 0)
    this.twist = toLong(init.twist ?? 0)
    this.altitudeAngle = Number(init.altitudeAngle ?? Math.PI / 2)
    this.azimuthAngle = Number(init.azimuthAngle ?? 0)
    this.pointerType = String(init.pointerType ?? "")
    this.isPrimary = init.isPrimary ?? false
    this.persistentDeviceId = toLong(init.persistentDeviceId ?? 0)

    const coalescedEvents = init.coalescedEvents ?? []
    const predictedEvents = init.predictedEvents ?? []
    this.pointerSamples = coalescedEvents.length > 0 || predictedEvents.length > 0
      ? {
          coalescedEvents: Object.freeze([...coalescedEvents]),
          predictedEvents: Object.freeze([...predictedEvents])
        }
      : null
  }

  getCoalescedEvents(): PointerEvent[] {
    return this.pointerSamples ? [...this.pointerSamples.coalescedEvents] : []
  }

  getPredictedEvents(): PointerEvent[] {
    return this.pointerSamples ? [...this.pointerSamples.predictedEvents] : []
  }
}
