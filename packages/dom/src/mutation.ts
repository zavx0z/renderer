import type {CharacterData} from "./character-data.ts"
import type {Document} from "./document.ts"
import type {Element} from "./element.ts"
import type {Node} from "./node.ts"

export type ChildListMutation = Readonly<{
  type: "childList"
  target: Node
  addedNodes: readonly Node[]
  removedNodes: readonly Node[]
  previousSibling: Node | null
  nextSibling: Node | null
}>

export type AttributeMutation = Readonly<{
  type: "attributes"
  target: Element
  attributeName: string
  oldValue: string | null
  newValue: string | null
}>

export type CharacterDataMutation = Readonly<{
  type: "characterData"
  target: CharacterData
  oldValue: string
  newValue: string
}>

export type DocumentMutation = ChildListMutation | AttributeMutation | CharacterDataMutation

export type MutationBatch = Readonly<{
  document: Document
  version: number
  records: readonly DocumentMutation[]
}>

export type MutationSubscriber = (batch: MutationBatch) => void
