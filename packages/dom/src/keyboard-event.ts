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

export type KeyboardEventInit = EventModifierInit & Readonly<{
  key?: string
  code?: string
  location?: number
  repeat?: boolean
  isComposing?: boolean
}>

export class KeyboardEvent extends UIEvent {
  static readonly DOM_KEY_LOCATION_STANDARD = 0
  static readonly DOM_KEY_LOCATION_LEFT = 1
  static readonly DOM_KEY_LOCATION_RIGHT = 2
  static readonly DOM_KEY_LOCATION_NUMPAD = 3

  readonly DOM_KEY_LOCATION_STANDARD = KeyboardEvent.DOM_KEY_LOCATION_STANDARD
  readonly DOM_KEY_LOCATION_LEFT = KeyboardEvent.DOM_KEY_LOCATION_LEFT
  readonly DOM_KEY_LOCATION_RIGHT = KeyboardEvent.DOM_KEY_LOCATION_RIGHT
  readonly DOM_KEY_LOCATION_NUMPAD = KeyboardEvent.DOM_KEY_LOCATION_NUMPAD

  readonly key: string
  readonly code: string
  readonly location: number
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly metaKey: boolean
  readonly repeat: boolean
  readonly isComposing: boolean
  private readonly extendedModifiers: ReadonlySet<ExtendedModifier> | null

  constructor(type: string, init: KeyboardEventInit = {}) {
    super(type, init)
    this.key = String(init.key ?? "")
    this.code = String(init.code ?? "")
    this.location = toLong(init.location ?? KeyboardEvent.DOM_KEY_LOCATION_STANDARD, 32, true)
    this.ctrlKey = init.ctrlKey ?? false
    this.shiftKey = init.shiftKey ?? false
    this.altKey = init.altKey ?? false
    this.metaKey = init.metaKey ?? false
    this.repeat = init.repeat ?? false
    this.isComposing = init.isComposing ?? false
    this.extendedModifiers = createExtendedModifiers(init)
  }

  getModifierState(keyArg: string): boolean {
    return readModifierState(this, this.extendedModifiers, keyArg)
  }
}
