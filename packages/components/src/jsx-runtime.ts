import type {Event, Node} from "@zavx0z/dom"
import {
  Fragment,
  createJsxElement,
  type FunctionComponent,
  type JsxElement,
  type Renderable,
} from "./runtime.ts"

export {Fragment}

export const jsx = createJsxElement
export const jsxs = createJsxElement

export namespace JSX {
  export type Element = JsxElement
  export type ElementType = string | FunctionComponent<any>

  export interface ElementChildrenAttribute {
    children: unknown
  }

  export interface IntrinsicAttributes {
    key?: string | number
  }

  export interface IntrinsicElements {
    [name: string]: IntrinsicProps
  }
}

export type IntrinsicProps = Readonly<{
  children?: Renderable
  className?: string
  id?: string
  onBlur?: EventHandler
  onClick?: EventHandler
  onFocus?: EventHandler
  onInput?: EventHandler
  onPointerDown?: EventHandler
  onPointerMove?: EventHandler
  onPointerUp?: EventHandler
  ref?: ((node: Node | null) => void) | null
  style?: string | Readonly<Record<string, string | number | null | undefined>>
  title?: string
  [name: string]: unknown
}>

type EventHandler = (event: Event) => unknown
