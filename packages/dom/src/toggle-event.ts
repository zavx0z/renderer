import type {Element} from "./element.ts"
import {Event} from "./event.ts"
import type {EventInit} from "./event.ts"

export type ToggleEventInit = EventInit & Readonly<{
  newState?: string
  oldState?: string
  source?: Element | null
}>

export class ToggleEvent extends Event {
  readonly oldState: string
  readonly newState: string
  readonly source: Element | null

  constructor(type: string, init: ToggleEventInit = {}) {
    super(type, init)
    this.oldState = String(init.oldState ?? "")
    this.newState = String(init.newState ?? "")
    this.source = init.source ?? null
  }
}
