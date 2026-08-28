import type {Document} from "./document.ts"
import type {HTMLElement} from "./html-element.ts"
import type {HTMLInputElement} from "./html-input-element.ts"
import type {HTMLOptionElement} from "./html-option-element.ts"
import type {HTMLTextAreaElement} from "./html-text-area-element.ts"
import type {TextSelection} from "./internal/text-selection.ts"

export type FocusStateChange = Readonly<{
  type: "focus"
  target: HTMLElement
  property: "focus" | "focus-within"
  oldValue: boolean
  newValue: boolean
}>

export type ScrollStateChange = Readonly<{
  type: "scroll"
  target: HTMLElement
  oldScrollLeft: number
  oldScrollTop: number
  scrollLeft: number
  scrollTop: number
}>

export type InputValueStateChange = Readonly<{
  type: "input"
  target: HTMLInputElement
  property: "value"
  oldValue: string
  newValue: string
}>

export type InputCheckedStateChange = Readonly<{
  type: "input"
  target: HTMLInputElement
  property: "checked"
  oldValue: boolean
  newValue: boolean
}>

export type InputIndeterminateStateChange = Readonly<{
  type: "input"
  target: HTMLInputElement
  property: "indeterminate"
  oldValue: boolean
  newValue: boolean
}>

export type InputSelectionStateChange = Readonly<{
  type: "input"
  target: HTMLInputElement
  property: "selection"
  oldValue: TextSelection
  newValue: TextSelection
}>

export type InputStateChange =
  | InputValueStateChange
  | InputCheckedStateChange
  | InputIndeterminateStateChange
  | InputSelectionStateChange

export type OptionSelectedStateChange = Readonly<{
  type: "option"
  target: HTMLOptionElement
  property: "selected"
  oldValue: boolean
  newValue: boolean
}>

export type TextAreaValueStateChange = Readonly<{
  type: "textarea"
  target: HTMLTextAreaElement
  property: "value"
  oldValue: string
  newValue: string
}>

export type TextAreaSelectionStateChange = Readonly<{
  type: "textarea"
  target: HTMLTextAreaElement
  property: "selection"
  oldValue: TextSelection
  newValue: TextSelection
}>

export type TextAreaStateChange =
  | TextAreaValueStateChange
  | TextAreaSelectionStateChange

export type PopoverStateChange = Readonly<{
  type: "popover"
  target: HTMLElement
  property: "open"
  oldValue: boolean
  newValue: boolean
}>

export type DocumentStateChange =
  | FocusStateChange
  | ScrollStateChange
  | InputStateChange
  | OptionSelectedStateChange
  | PopoverStateChange
  | TextAreaStateChange

export type StateChangeBatch = Readonly<{
  document: Document
  version: number
  records: readonly DocumentStateChange[]
}>

export type StateChangeSubscriber = (batch: StateChangeBatch) => void
