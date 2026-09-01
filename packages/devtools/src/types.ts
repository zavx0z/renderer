import type {Document, Node} from "@zavx0z/dom"
import type {
  DocumentRenderer,
  RenderBorder,
  RenderClip,
  RenderEdges,
  RenderTransform,
} from "@zavx0z/renderer"

export type DomInspectorAttribute = Readonly<{
  name: string
  value: string
}>

export type DomInspectorBox = Readonly<{
  depth: number
  display: "block" | "inline" | "flex"
  x: number
  y: number
  width: number
  height: number
  contentX: number
  contentY: number
  contentWidth: number
  contentHeight: number
  margin: RenderEdges
  padding: RenderEdges
  border: RenderBorder
  transform: RenderTransform
}>

export type DomInspectorHit = Readonly<{
  x: number
  y: number
  width: number
  height: number
  interactive: boolean
  disabled: boolean
  role: string | null
  clips: readonly RenderClip[]
  transform: RenderTransform
}>

export type DomInspectorDisplay = Readonly<{
  key: string
  kind: "rect" | "text" | "image" | "path"
}>

export type DomInspectorHTMLElementState = Readonly<{
  focused: boolean
  scrollLeft: number
  scrollTop: number
}>

export type DomInspectorInputState = DomInspectorHTMLElementState & Readonly<{
  type: string
  value: string
  checked: boolean
  selectionStart: number | null
  selectionEnd: number | null
  selectionDirection: "forward" | "backward" | "none" | null
}>

export type DomInspectorTextAreaState = DomInspectorHTMLElementState & Readonly<{
  value: string
  rows: number
  cols: number
  selectionStart: number
  selectionEnd: number
  selectionDirection: "forward" | "backward" | "none"
}>

export type DomInspectorLiveState =
  | DomInspectorHTMLElementState
  | DomInspectorInputState
  | DomInspectorTextAreaState

type DomInspectorNodeBase = Readonly<{
  id: number
  nodeType: number
  nodeName: string
  localName: string | null
  nodeValue: string | null
  attributes: readonly DomInspectorAttribute[]
  parent: number | null
  children: readonly number[]
}>

export type DomInspectorNode = DomInspectorNodeBase & Readonly<{
  box?: DomInspectorBox | null
  hit?: DomInspectorHit | null
  display?: readonly DomInspectorDisplay[]
  state?: DomInspectorLiveState
}>

export type DomInspectorSnapshot = Readonly<{
  mutationVersion: number
  stateVersion: number
  root: number
  nodes: readonly DomInspectorNode[]
}>

export type DomInspectorChange = Readonly<{
  kind: "mutation" | "state"
  mutationVersion: number
  stateVersion: number
  changedNodeIds: readonly number[]
}>

export type DomInspectorSubscriber = (change: DomInspectorChange) => void

export type CreateDomInspectorOptions = Readonly<{
  document: Document
  renderer?: DocumentRenderer
}>

export interface DomInspector {
  readonly document: Document
  idForNode(node: Node): number
  nodeForId(id: number): Node | null
  snapshot(root?: Node): DomInspectorSnapshot
  subscribe(subscriber: DomInspectorSubscriber): () => void
  dispose(): void
}
