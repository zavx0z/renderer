import {domError} from "./internal/errors.ts"
import {UIEvent} from "./ui-event.ts"
import type {UIEventInit} from "./ui-event.ts"

export type InputEventInit = UIEventInit & Readonly<{
  data?: string | null
  inputType?: string
  isComposing?: boolean
  dataTransfer?: null
}>

export class InputEvent extends UIEvent {
  readonly data: string | null
  readonly inputType: string
  readonly isComposing: boolean
  readonly dataTransfer: null = null

  constructor(type: string, init: InputEventInit = {}) {
    super(type, init)
    const dataTransfer = (init as InputEventInit & {dataTransfer?: unknown}).dataTransfer
    if (dataTransfer !== null && dataTransfer !== undefined) {
      throw domError("NotSupportedError", "InputEvent.dataTransfer is not implemented")
    }
    this.data = init.data === null || init.data === undefined ? null : String(init.data)
    this.inputType = String(init.inputType ?? "")
    this.isComposing = init.isComposing ?? false
  }
}
