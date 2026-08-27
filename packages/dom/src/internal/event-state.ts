import type {Event} from "../event.ts"
import type {EventTarget} from "../event-target.ts"

export type EventState = {
  target: EventTarget | null
  currentTarget: EventTarget | null
  eventPhase: number
  dispatching: boolean
  propagationStopped: boolean
  immediatePropagationStopped: boolean
  canceled: boolean
  inPassiveListener: boolean
}

const states = new WeakMap<Event, EventState>()

export function initializeEventState(event: Event): void {
  states.set(event, {
    target: null,
    currentTarget: null,
    eventPhase: 0,
    dispatching: false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    canceled: false,
    inPassiveListener: false
  })
}

export function eventState(event: Event): EventState {
  const state = states.get(event)
  if (!state) throw new TypeError("Event state is unavailable")
  return state
}
