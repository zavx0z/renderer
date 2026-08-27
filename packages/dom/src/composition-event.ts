import {UIEvent} from "./ui-event.ts"
import type {UIEventInit} from "./ui-event.ts"

export type CompositionEventInit = UIEventInit & Readonly<{
  data?: string
}>

export class CompositionEvent extends UIEvent {
  readonly data: string

  constructor(type: string, init: CompositionEventInit = {}) {
    super(type, init)
    this.data = String(init.data ?? "")
  }
}
