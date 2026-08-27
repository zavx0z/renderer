import type {EventTarget} from "./event-target.ts"
import {UIEvent} from "./ui-event.ts"
import type {UIEventInit} from "./ui-event.ts"

export type FocusEventInit = UIEventInit & Readonly<{
  relatedTarget?: EventTarget | null
}>

export class FocusEvent extends UIEvent {
  readonly relatedTarget: EventTarget | null

  constructor(type: string, init: FocusEventInit = {}) {
    super(type, init)
    this.relatedTarget = init.relatedTarget ?? null
  }
}
