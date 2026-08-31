import type { Document, Element, Node } from "@zavx0z/dom"
import type {DocumentInteractionState} from "./pseudo-state.ts"

export type RenderDisplay = "block" | "inline" | "flex" | "none"
export type RenderFlexDirection = "row" | "column"
export type RenderFlexWrap = "nowrap" | "wrap" | "wrap-reverse"
export type RenderWhiteSpace = "normal" | "pre" | "nowrap"
export type RenderTextAlign = "start" | "end" | "left" | "right" | "center"
export type RenderObjectFit = "cover" | "contain"
export type RenderPosition = "static" | "relative" | "absolute"
export type RenderZIndex = "auto" | number

export type RenderTextMeasurer = Readonly<{
  /** Returns one finite non-negative inline advance for the exact resolved font. */
  measureTextAdvance(value: string, fontSize: number, letterSpacing: number): number
}>

export type RenderTransform = Readonly<{
  scaleX: number
  scaleY: number
  translateX: number
  translateY: number
}>
export type RenderOverflow = "visible" | "hidden" | "clip" | "auto" | "scroll"
export type RenderBoxSizing = "content-box" | "border-box"
export type RenderAlignContent =
  | "normal"
  | "stretch"
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly"
export type RenderAlignItems = "stretch" | "flex-start" | "center" | "flex-end"
export type RenderJustifyContent =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly"

export type RenderViewport = Readonly<{
  width: number
  height: number
}>

export type RenderEdges = Readonly<{
  top: number
  right: number
  bottom: number
  left: number
}>

export type RenderPadding = RenderEdges
export type RenderMargin = RenderEdges
export type RenderBorderWidths = RenderEdges

export type RenderBorderColors = Readonly<{
  top: string
  right: string
  bottom: string
  left: string
}>

export type RenderCornerRadii = Readonly<{
  topLeft: number
  topRight: number
  bottomRight: number
  bottomLeft: number
}>

export type RenderBorder = Readonly<{
  widths: RenderBorderWidths
  colors: RenderBorderColors
  radii: RenderCornerRadii
}>

export type RenderBoxShadow = Readonly<{
  blurRadius: number
  spreadRadius: number
}>

export type RenderClipRadius = Readonly<{
  x: number
  y: number
}>

export type RenderClipCornerRadii = Readonly<{
  topLeft: RenderClipRadius
  topRight: RenderClipRadius
  bottomRight: RenderClipRadius
  bottomLeft: RenderClipRadius
}>

export type RenderClip = Readonly<{
  x: number
  y: number
  width: number
  height: number
  radii: RenderClipCornerRadii
  clipX: boolean
  clipY: boolean
  transform: RenderTransform
}>

export type RenderBox = Readonly<{
  node: Node
  parent: Node | null
  depth: number
  display: Exclude<RenderDisplay, "none">
  x: number
  y: number
  width: number
  height: number
  contentX: number
  contentY: number
  contentWidth: number
  contentHeight: number
  margin: RenderMargin
  padding: RenderPadding
  border: RenderBorder
  transform: RenderTransform
}>

export type RectDisplayItem = Readonly<{
  kind: "rect"
  key: string
  node: Node
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  border: RenderBorder
  shadow: RenderBoxShadow | null
  clips: readonly RenderClip[]
  transform: RenderTransform
}>

export type TextDisplayItem = Readonly<{
  kind: "text"
  key: string
  node: Node
  text: string
  x: number
  y: number
  color: string
  fontSize: number
  /** Resolved line-box height; `y` is the line-box top, not the alphabetic baseline. */
  lineHeight: number
  letterSpacing: number
  opacity: number
  clips: readonly RenderClip[]
  transform: RenderTransform
}>

export type ImageDisplayItem = Readonly<{
  kind: "image"
  key: string
  node: Node
  src: string
  x: number
  y: number
  width: number
  height: number
  fit: RenderObjectFit
  opacity: number
  clips: readonly RenderClip[]
  transform: RenderTransform
}>

export type DisplayItem = RectDisplayItem | TextDisplayItem | ImageDisplayItem

export type HitMetadata = Readonly<{
  node: Element
  x: number
  y: number
  width: number
  height: number
  interactive: boolean
  disabled: boolean
  role: string | null
  clips: readonly RenderClip[]
  transform: RenderTransform
  textControl?: Readonly<{
    lineHeight: number
    characterAdvance: number
    exactOffsetMapping: boolean
  }>
}>

export type RenderScrollMetrics = Readonly<{
  node: Element
  clientWidth: number
  clientHeight: number
  scrollWidth: number
  scrollHeight: number
  requestedScrollLeft: number
  requestedScrollTop: number
  scrollLeft: number
  scrollTop: number
  maxScrollLeft: number
  maxScrollTop: number
}>

export interface RenderFrame {
  readonly revision: number
  readonly document: Document
  readonly root: Node
  readonly viewport: RenderViewport
  readonly boxes: readonly RenderBox[]
  readonly boxByNode: ReadonlyMap<Node, RenderBox>
  readonly displayList: readonly DisplayItem[]
  readonly hits: ReadonlyMap<Node, HitMetadata>
  readonly scrolls: ReadonlyMap<Element, RenderScrollMetrics>
}

export type CreateDocumentRendererOptions = Readonly<{
  document: Document
  root: Node
  viewport: RenderViewport
  styleSheets?: readonly string[]
  interactionState?: DocumentInteractionState
  textMeasurer?: RenderTextMeasurer
}>

export interface DocumentRenderer {
  readonly document: Document
  readonly root: Node
  readonly viewport: RenderViewport
  invalidate(node: Node): void
  render(node?: Node): RenderFrame
  flush(): RenderFrame
  dispose(): void
}
