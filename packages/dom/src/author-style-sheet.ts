import type {Document} from "./document.ts"

export type DocumentAuthorStyleSheet = Readonly<{
  id: string
  cssText: string
}>

export type DocumentAuthorStyleSheetSnapshot = Readonly<{
  revision: number
  styleSheets: readonly DocumentAuthorStyleSheet[]
}>

export type DocumentAuthorStyleSheetChange = Readonly<{
  document: Document
  revision: number
  styleSheets: readonly DocumentAuthorStyleSheet[]
}>

export type DocumentAuthorStyleSheetSubscriber = (
  change: DocumentAuthorStyleSheetChange
) => void

export type DocumentAuthorStyleSheetOwner = Readonly<{
  replace(styleSheets: readonly DocumentAuthorStyleSheet[]): void
  release(): void
}>

export const acquireDocumentAuthorStyleSheetOwnerInternal = Symbol.for(
  "@zavx0z/dom/acquire-document-author-style-sheet-owner"
)
export const readDocumentAuthorStyleSheetsInternal = Symbol.for(
  "@zavx0z/dom/read-document-author-style-sheets"
)
export const subscribeDocumentAuthorStyleSheetsInternal = Symbol.for(
  "@zavx0z/dom/subscribe-document-author-style-sheets"
)

type DocumentAuthorStyleSheetHost = Document & Readonly<{
  [acquireDocumentAuthorStyleSheetOwnerInternal](): DocumentAuthorStyleSheetOwner
  [readDocumentAuthorStyleSheetsInternal](): DocumentAuthorStyleSheetSnapshot
  [subscribeDocumentAuthorStyleSheetsInternal](
    subscriber: DocumentAuthorStyleSheetSubscriber
  ): () => void
}>

/** Acquires the one ordered author/theme stylesheet owner for an exact Document. */
export function acquireDocumentAuthorStyleSheetOwner(
  document: Document
): DocumentAuthorStyleSheetOwner {
  return (document as DocumentAuthorStyleSheetHost)[
    acquireDocumentAuthorStyleSheetOwnerInternal
  ]()
}

/** Reads the exact ordered author/theme stylesheet set currently owned by a Document. */
export function readDocumentAuthorStyleSheets(
  document: Document
): DocumentAuthorStyleSheetSnapshot {
  return (document as DocumentAuthorStyleSheetHost)[
    readDocumentAuthorStyleSheetsInternal
  ]()
}

/** Subscribes to author/theme stylesheet set changes for one exact Document. */
export function subscribeDocumentAuthorStyleSheets(
  document: Document,
  subscriber: DocumentAuthorStyleSheetSubscriber
): () => void {
  return (document as DocumentAuthorStyleSheetHost)[
    subscribeDocumentAuthorStyleSheetsInternal
  ](subscriber)
}
