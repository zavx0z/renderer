import type * as SemanticDOM from "@zavx0z/dom"
import type {
  WebRealmBindings,
  WebRealmCSSStyleDeclaration,
  WebRealmConsole,
  WebRealmCrypto,
  WebRealmFetchResponse,
  WebRealmHistory,
  WebRealmLocation,
  WebRealmNavigator,
  WebRealmPerformance,
  WebRealmURL,
  WebRealmURLSearchParams,
  WebRealmWindow,
} from "./index.ts"

declare global {
  type Window = WebRealmWindow
  var Window: WebRealmBindings["Window"]
  var window: WebRealmWindow
  var self: WebRealmWindow

  type EventTarget = SemanticDOM.EventTarget
  var EventTarget: WebRealmBindings["EventTarget"]
  type Event = SemanticDOM.Event
  var Event: WebRealmBindings["Event"]
  type CustomEvent<Detail = unknown> = SemanticDOM.CustomEvent<Detail>
  var CustomEvent: WebRealmBindings["CustomEvent"]
  type ToggleEvent = SemanticDOM.ToggleEvent
  var ToggleEvent: WebRealmBindings["ToggleEvent"]
  type UIEvent = SemanticDOM.UIEvent
  var UIEvent: WebRealmBindings["UIEvent"]
  type FocusEvent = SemanticDOM.FocusEvent
  var FocusEvent: WebRealmBindings["FocusEvent"]
  type InputEvent = SemanticDOM.InputEvent
  var InputEvent: WebRealmBindings["InputEvent"]
  type KeyboardEvent = SemanticDOM.KeyboardEvent
  var KeyboardEvent: WebRealmBindings["KeyboardEvent"]
  type CompositionEvent = SemanticDOM.CompositionEvent
  var CompositionEvent: WebRealmBindings["CompositionEvent"]
  type MouseEvent = SemanticDOM.MouseEvent
  var MouseEvent: WebRealmBindings["MouseEvent"]
  type WheelEvent = SemanticDOM.WheelEvent
  var WheelEvent: WebRealmBindings["WheelEvent"]
  type PointerEvent = SemanticDOM.PointerEvent
  var PointerEvent: WebRealmBindings["PointerEvent"]

  type Node = SemanticDOM.Node
  var Node: WebRealmBindings["Node"]
  type NodeList<NodeType extends SemanticDOM.Node = SemanticDOM.Node> = SemanticDOM.NodeList<NodeType>
  var NodeList: WebRealmBindings["NodeList"]
  type DOMTokenList = SemanticDOM.DOMTokenList
  var DOMTokenList: WebRealmBindings["DOMTokenList"]
  type DOMRectReadOnly = SemanticDOM.DOMRectReadOnly
  var DOMRectReadOnly: WebRealmBindings["DOMRectReadOnly"]
  type Document = SemanticDOM.Document
  var Document: WebRealmBindings["Document"]
  type DocumentFragment = SemanticDOM.DocumentFragment
  var DocumentFragment: WebRealmBindings["DocumentFragment"]
  type CharacterData = SemanticDOM.CharacterData
  var CharacterData: WebRealmBindings["CharacterData"]
  type Text = SemanticDOM.Text
  var Text: WebRealmBindings["Text"]
  type Comment = SemanticDOM.Comment
  var Comment: WebRealmBindings["Comment"]
  type Element = SemanticDOM.Element
  var Element: WebRealmBindings["Element"]
  type HTMLElement = SemanticDOM.HTMLElement
  var HTMLElement: WebRealmBindings["HTMLElement"]
  type HTMLDivElement = SemanticDOM.HTMLDivElement
  var HTMLDivElement: WebRealmBindings["HTMLDivElement"]
  type HTMLFieldSetElement = SemanticDOM.HTMLFieldSetElement
  var HTMLFieldSetElement: WebRealmBindings["HTMLFieldSetElement"]
  type HTMLHeadingElement = SemanticDOM.HTMLHeadingElement
  var HTMLHeadingElement: WebRealmBindings["HTMLHeadingElement"]
  type HTMLSpanElement = SemanticDOM.HTMLSpanElement
  var HTMLSpanElement: WebRealmBindings["HTMLSpanElement"]
  type HTMLButtonElement = SemanticDOM.HTMLButtonElement
  var HTMLButtonElement: WebRealmBindings["HTMLButtonElement"]
  type HTMLInputElement = SemanticDOM.HTMLInputElement
  var HTMLInputElement: WebRealmBindings["HTMLInputElement"]
  type HTMLImageElement = SemanticDOM.HTMLImageElement
  var HTMLImageElement: WebRealmBindings["HTMLImageElement"]
  type HTMLLabelElement = SemanticDOM.HTMLLabelElement
  var HTMLLabelElement: WebRealmBindings["HTMLLabelElement"]
  type HTMLLIElement = SemanticDOM.HTMLLIElement
  var HTMLLIElement: WebRealmBindings["HTMLLIElement"]
  type HTMLLegendElement = SemanticDOM.HTMLLegendElement
  var HTMLLegendElement: WebRealmBindings["HTMLLegendElement"]
  type HTMLMeterElement = SemanticDOM.HTMLMeterElement
  var HTMLMeterElement: WebRealmBindings["HTMLMeterElement"]
  type HTMLOptionElement = SemanticDOM.HTMLOptionElement
  var HTMLOptionElement: WebRealmBindings["HTMLOptionElement"]
  type HTMLParagraphElement = SemanticDOM.HTMLParagraphElement
  var HTMLParagraphElement: WebRealmBindings["HTMLParagraphElement"]
  type HTMLProgressElement = SemanticDOM.HTMLProgressElement
  var HTMLProgressElement: WebRealmBindings["HTMLProgressElement"]
  type HTMLSelectElement = SemanticDOM.HTMLSelectElement
  var HTMLSelectElement: WebRealmBindings["HTMLSelectElement"]
  type HTMLTableCellElement = SemanticDOM.HTMLTableCellElement
  var HTMLTableCellElement: WebRealmBindings["HTMLTableCellElement"]
  type HTMLTableElement = SemanticDOM.HTMLTableElement
  var HTMLTableElement: WebRealmBindings["HTMLTableElement"]
  type HTMLTableRowElement = SemanticDOM.HTMLTableRowElement
  var HTMLTableRowElement: WebRealmBindings["HTMLTableRowElement"]
  type HTMLTableSectionElement = SemanticDOM.HTMLTableSectionElement
  var HTMLTableSectionElement: WebRealmBindings["HTMLTableSectionElement"]
  type HTMLTextAreaElement = SemanticDOM.HTMLTextAreaElement
  var HTMLTextAreaElement: WebRealmBindings["HTMLTextAreaElement"]
  type HTMLUListElement = SemanticDOM.HTMLUListElement
  var HTMLUListElement: WebRealmBindings["HTMLUListElement"]

  type CSSStyleDeclaration = WebRealmCSSStyleDeclaration
  var CSSStyleDeclaration: WebRealmBindings["CSSStyleDeclaration"]
  var document: SemanticDOM.Document
  var getComputedStyle: WebRealmBindings["getComputedStyle"]

  type URL = WebRealmURL
  var URL: WebRealmBindings["URL"]
  type URLSearchParams = WebRealmURLSearchParams
  var URLSearchParams: WebRealmBindings["URLSearchParams"]
  type Location = WebRealmLocation
  var location: WebRealmLocation
  type History = WebRealmHistory
  var history: WebRealmHistory
  type Navigator = WebRealmNavigator
  var navigator: WebRealmNavigator
  type Performance = WebRealmPerformance
  var performance: WebRealmPerformance
  type Crypto = WebRealmCrypto
  var crypto: WebRealmCrypto
  type Console = WebRealmConsole
  var console: WebRealmConsole
  type Response = WebRealmFetchResponse
  var fetch: WebRealmBindings["fetch"]
  var setTimeout: WebRealmBindings["setTimeout"]
  var clearTimeout: WebRealmBindings["clearTimeout"]
  var setInterval: WebRealmBindings["setInterval"]
  var clearInterval: WebRealmBindings["clearInterval"]
  var queueMicrotask: WebRealmBindings["queueMicrotask"]
  var requestAnimationFrame: WebRealmBindings["requestAnimationFrame"]
  var cancelAnimationFrame: WebRealmBindings["cancelAnimationFrame"]
  var devicePixelRatio: number
}

export {}
