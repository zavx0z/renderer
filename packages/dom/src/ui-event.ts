import {Event} from "./event.ts"
import type {EventInit} from "./event.ts"
import {toLong} from "./internal/web-idl.ts"

export type UIEventInit = EventInit & Readonly<{
  view?: object | null
  detail?: number
}>

export class UIEvent extends Event {
  readonly view: object | null
  readonly detail: number

  constructor(type: string, init: UIEventInit = {}) {
    super(type, init)
    this.view = init.view ?? null
    this.detail = toLong(init.detail ?? 0)
  }
}
