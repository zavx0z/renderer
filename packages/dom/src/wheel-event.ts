import {toLong} from "./internal/web-idl.ts"
import {MouseEvent} from "./mouse-event.ts"
import type {MouseEventInit} from "./mouse-event.ts"

export type WheelEventInit = MouseEventInit & Readonly<{
  deltaX?: number
  deltaY?: number
  deltaZ?: number
  deltaMode?: number
}>

export class WheelEvent extends MouseEvent {
  static readonly DOM_DELTA_PIXEL = 0
  static readonly DOM_DELTA_LINE = 1
  static readonly DOM_DELTA_PAGE = 2

  readonly DOM_DELTA_PIXEL = WheelEvent.DOM_DELTA_PIXEL
  readonly DOM_DELTA_LINE = WheelEvent.DOM_DELTA_LINE
  readonly DOM_DELTA_PAGE = WheelEvent.DOM_DELTA_PAGE

  readonly deltaX: number
  readonly deltaY: number
  readonly deltaZ: number
  readonly deltaMode: number

  constructor(type: string, init: WheelEventInit = {}) {
    super(type, init)
    this.deltaX = Number(init.deltaX ?? 0)
    this.deltaY = Number(init.deltaY ?? 0)
    this.deltaZ = Number(init.deltaZ ?? 0)
    this.deltaMode = toLong(init.deltaMode ?? WheelEvent.DOM_DELTA_PIXEL, 32, true)
  }
}
