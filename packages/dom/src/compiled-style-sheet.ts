import type {Document} from "./document.ts"

export type DocumentCompiledStyleSheet = Readonly<{
  id: string
  cssText: string
}>

export type DocumentCompiledStyleSheetSnapshot = Readonly<{
  revision: number
  styleSheets: readonly DocumentCompiledStyleSheet[]
}>

export type DocumentCompiledStyleSheetChange = Readonly<{
  document: Document
  revision: number
  styleSheets: readonly DocumentCompiledStyleSheet[]
}>

export type DocumentCompiledStyleSheetSubscriber = (
  change: DocumentCompiledStyleSheetChange
) => void

export type DocumentCompiledStyleSheetLease = Readonly<{
  release(): void
}>

export const acquireDocumentCompiledStyleSheetsInternal = Symbol.for(
  "@zavx0z/dom/acquire-document-compiled-style-sheets"
)
export const readDocumentCompiledStyleSheetsInternal = Symbol.for(
  "@zavx0z/dom/read-document-compiled-style-sheets"
)
export const subscribeDocumentCompiledStyleSheetsInternal = Symbol.for(
  "@zavx0z/dom/subscribe-document-compiled-style-sheets"
)

type DocumentCompiledStyleSheetHost = Document & Readonly<{
  [acquireDocumentCompiledStyleSheetsInternal](
    styleSheets: readonly DocumentCompiledStyleSheet[]
  ): DocumentCompiledStyleSheetLease
  [readDocumentCompiledStyleSheetsInternal](): DocumentCompiledStyleSheetSnapshot
  [subscribeDocumentCompiledStyleSheetsInternal](
    subscriber: DocumentCompiledStyleSheetSubscriber
  ): () => void
}>

/** Acquires immutable compiled stylesheet ownership in one exact Document. */
export function acquireDocumentCompiledStyleSheets(
  document: Document,
  styleSheets: readonly DocumentCompiledStyleSheet[]
): DocumentCompiledStyleSheetLease {
  return (document as DocumentCompiledStyleSheetHost)[
    acquireDocumentCompiledStyleSheetsInternal
  ](styleSheets)
}

/** Reads the exact immutable compiled stylesheet set currently owned by a Document. */
export function readDocumentCompiledStyleSheets(
  document: Document
): DocumentCompiledStyleSheetSnapshot {
  return (document as DocumentCompiledStyleSheetHost)[
    readDocumentCompiledStyleSheetsInternal
  ]()
}

/** Subscribes to active compiled stylesheet set changes for one exact Document. */
export function subscribeDocumentCompiledStyleSheets(
  document: Document,
  subscriber: DocumentCompiledStyleSheetSubscriber
): () => void {
  return (document as DocumentCompiledStyleSheetHost)[
    subscribeDocumentCompiledStyleSheetsInternal
  ](subscriber)
}
