import type {EventTarget} from "./event-target.ts"
import {
  createExtendedModifiers,
  readModifierState
} from "./event-modifier.ts"
import type {
  EventModifierInit,
  ExtendedModifier
} from "./event-modifier.ts"
import {toLong} from "./internal/web-idl.ts"
import {UIEvent} from "./ui-event.ts"

export type {EventModifierInit} from "./event-modifier.ts"

export type MouseEventInit = EventModifierInit & Readonly<{
  screenX?: number
  screenY?: number
  clientX?: number
  clientY?: number
  movementX?: number
  movementY?: number
  button?: number
  buttons?: number
  relatedTarget?: EventTarget | null
}>

export class MouseEvent extends UIEvent {
  readonly screenX: number
  readonly screenY: number
  readonly clientX: number
  readonly clientY: number
  readonly movementX: number
  readonly movementY: number
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly metaKey: boolean
  readonly button: number
  readonly buttons: number
  readonly relatedTarget: EventTarget | null
  private readonly extendedModifiers: ReadonlySet<ExtendedModifier> | null

  constructor(type: string, init: MouseEventInit = {}) {
    super(type, init)
    this.screenX = toLong(init.screenX ?? 0)
    this.screenY = toLong(init.screenY ?? 0)
    this.clientX = toLong(init.clientX ?? 0)
    this.clientY = toLong(init.clientY ?? 0)
    this.movementX = Number(init.movementX ?? 0)
    this.movementY = Number(init.movementY ?? 0)
    this.ctrlKey = init.ctrlKey ?? false
    this.shiftKey = init.shiftKey ?? false
    this.altKey = init.altKey ?? false
    this.metaKey = init.metaKey ?? false
    this.button = toLong(init.button ?? 0, 16)
    this.buttons = toLong(init.buttons ?? 0, 16, true)
    this.relatedTarget = init.relatedTarget ?? null

    this.extendedModifiers = createExtendedModifiers(init)
  }

  get x(): number {
    return this.clientX
  }

  get y(): number {
    return this.clientY
  }

  getModifierState(keyArg: string): boolean {
    return readModifierState(this, this.extendedModifiers, keyArg)
  }
}
