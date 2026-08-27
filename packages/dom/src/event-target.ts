import {Event} from "./event.ts"
import {domError} from "./internal/errors.ts"
import {eventState} from "./internal/event-state.ts"

export interface EventListenerObject {
  handleEvent(event: Event): void
}

export type EventListener = ((this: EventTarget, event: Event) => void) | EventListenerObject

export type AddEventListenerOptions = Readonly<{
  capture?: boolean
  once?: boolean
  passive?: boolean
}>

export type EventListenerOptions = Readonly<{
  capture?: boolean
}>

type ListenerEntry = {
  callback: EventListener
  capture: boolean
  once: boolean
  passive: boolean
  removed: boolean
}

function captureValue(options: boolean | EventListenerOptions | undefined): boolean {
  return typeof options === "boolean" ? options : options?.capture ?? false
}

export class EventTarget {
  private listeners: Map<string, ListenerEntry[]> | null = null

  addEventListener(
    type: string,
    callback: EventListener | null,
    options: boolean | AddEventListenerOptions = false
  ): void {
    if (!callback) return
    const capture = captureValue(options)
    const listeners = this.listeners ??= new Map()
    const entries: ListenerEntry[] = listeners.get(String(type)) ?? []
    if (entries.some(entry => !entry.removed && entry.callback === callback && entry.capture === capture)) return
    entries.push({
      callback,
      capture,
      once: typeof options === "boolean" ? false : options.once ?? false,
      passive: typeof options === "boolean" ? false : options.passive ?? false,
      removed: false
    })
    listeners.set(String(type), entries)
  }

  removeEventListener(
    type: string,
    callback: EventListener | null,
    options: boolean | EventListenerOptions = false
  ): void {
    if (!callback || !this.listeners) return
    const entries = this.listeners.get(String(type))
    if (!entries) return
    const capture = captureValue(options)
    const entry = entries.find(candidate =>
      !candidate.removed && candidate.callback === callback && candidate.capture === capture
    )
    if (!entry) return
    entry.removed = true
    const remaining = entries.filter(candidate => !candidate.removed)
    if (remaining.length > 0) this.listeners.set(String(type), remaining)
    else this.listeners.delete(String(type))
    if (this.listeners.size === 0) this.listeners = null
  }

  dispatchEvent(event: Event): boolean {
    if (!(event instanceof Event)) throw new TypeError("dispatchEvent expects an Event")
    const state = eventState(event)
    if (state.dispatching) throw domError("InvalidStateError", "The Event is already being dispatched")

    const path: EventTarget[] = []
    for (let parent = this.eventParent(); parent; parent = parent.eventParent()) path.push(parent)

    state.target = this
    state.currentTarget = null
    state.eventPhase = Event.NONE
    state.dispatching = true
    state.propagationStopped = false
    state.immediatePropagationStopped = false

    try {
      for (let index = path.length - 1; index >= 0; index -= 1) {
        const current = path[index]
        if (!current || state.propagationStopped) break
        current.invoke(event, Event.CAPTURING_PHASE, true)
      }

      if (!state.propagationStopped) {
        this.invoke(event, Event.AT_TARGET, true)
        if (!state.immediatePropagationStopped) this.invoke(event, Event.AT_TARGET, false)
      }

      if (event.bubbles && !state.propagationStopped) {
        for (const current of path) {
          if (state.propagationStopped) break
          current.invoke(event, Event.BUBBLING_PHASE, false)
        }
      }
    } finally {
      state.currentTarget = null
      state.eventPhase = Event.NONE
      state.dispatching = false
      state.propagationStopped = false
      state.immediatePropagationStopped = false
      state.inPassiveListener = false
    }

    return !state.canceled
  }

  protected eventParent(): EventTarget | null {
    return null
  }

  private invoke(event: Event, phase: number, capture: boolean): void {
    const entries = this.listeners?.get(event.type)
    if (!entries) return
    const state = eventState(event)
    state.currentTarget = this
    state.eventPhase = phase
    state.immediatePropagationStopped = false

    for (const entry of [...entries]) {
      if (entry.removed || entry.capture !== capture) continue
      if (entry.once) this.removeEventListener(event.type, entry.callback, {capture: entry.capture})
      state.inPassiveListener = entry.passive
      if (typeof entry.callback === "function") entry.callback.call(this, event)
      else entry.callback.handleEvent(event)
      state.inPassiveListener = false
      if (state.immediatePropagationStopped) break
    }
  }
}
