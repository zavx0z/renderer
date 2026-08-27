import {eventState, initializeEventState} from "./internal/event-state.ts"

export type EventInit = Readonly<{
  bubbles?: boolean
  cancelable?: boolean
  composed?: boolean
}>

export class Event {
  static readonly NONE = 0
  static readonly CAPTURING_PHASE = 1
  static readonly AT_TARGET = 2
  static readonly BUBBLING_PHASE = 3

  readonly NONE = Event.NONE
  readonly CAPTURING_PHASE = Event.CAPTURING_PHASE
  readonly AT_TARGET = Event.AT_TARGET
  readonly BUBBLING_PHASE = Event.BUBBLING_PHASE

  readonly type: string
  readonly bubbles: boolean
  readonly cancelable: boolean
  readonly composed: boolean
  readonly isTrusted = false
  readonly timeStamp: number

  constructor(type: string, init: EventInit = {}) {
    this.type = String(type)
    this.bubbles = init.bubbles ?? false
    this.cancelable = init.cancelable ?? false
    this.composed = init.composed ?? false
    this.timeStamp = Date.now()
    initializeEventState(this)
  }

  get target(): import("./event-target.ts").EventTarget | null {
    return eventState(this).target
  }

  get currentTarget(): import("./event-target.ts").EventTarget | null {
    return eventState(this).currentTarget
  }

  get eventPhase(): number {
    return eventState(this).eventPhase
  }

  get defaultPrevented(): boolean {
    return eventState(this).canceled
  }

  stopPropagation(): void {
    eventState(this).propagationStopped = true
  }

  stopImmediatePropagation(): void {
    const state = eventState(this)
    state.propagationStopped = true
    state.immediatePropagationStopped = true
  }

  preventDefault(): void {
    const state = eventState(this)
    if (this.cancelable && !state.inPassiveListener) state.canceled = true
  }
}

export type CustomEventInit<Detail = unknown> = EventInit & Readonly<{
  detail?: Detail
}>

export class CustomEvent<Detail = unknown> extends Event {
  readonly detail: Detail

  constructor(type: string, init: CustomEventInit<Detail> = {}) {
    super(type, init)
    this.detail = init.detail as Detail
  }
}
