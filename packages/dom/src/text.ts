import {CharacterData} from "./character-data.ts"
import type {Document} from "./document.ts"
import {Node} from "./node.ts"

export class Text extends CharacterData {
  constructor(ownerDocument: Document, data = "") {
    super(ownerDocument, data, Node.TEXT_NODE, "#text")
  }
}
