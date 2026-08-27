import {CharacterData} from "./character-data.ts"
import type {Document} from "./document.ts"
import {Node} from "./node.ts"

export class Comment extends CharacterData {
  constructor(ownerDocument: Document, data = "") {
    super(ownerDocument, data, Node.COMMENT_NODE, "#comment")
  }
}
