import {
  readDocumentAuthorStyleSheets,
  readDocumentCompiledStyleSheets,
  type Document
} from "@zavx0z/dom"
import {parseStyleSheets, type StyleRuleIndex} from "./css.ts"

type CacheEntry = Readonly<{
  authorRevision: number
  compiledRevision: number
  rules: StyleRuleIndex
}>

export type HostStyleSheetSet = Readonly<{
  key: string
  styleSheets: readonly string[]
}>

type DocumentCache = {
  entries: Map<string, CacheEntry>
  parses: number
}

const cacheByDocument = new WeakMap<Document, DocumentCache>()

export function cachedDocumentStyleRules(
  document: Document,
  host: HostStyleSheetSet
): CacheEntry {
  const author = readDocumentAuthorStyleSheets(document)
  const compiled = readDocumentCompiledStyleSheets(document)
  const cache = cacheByDocument.get(document) ?? createDocumentCache(document)
  const cached = cache.entries.get(host.key)
  if (
    cached?.authorRevision === author.revision &&
    cached.compiledRevision === compiled.revision
  ) return cached

  const rules = parseStyleSheets([
    ...author.styleSheets.map(styleSheet => styleSheet.cssText),
    ...compiled.styleSheets.map(styleSheet => styleSheet.cssText),
    ...host.styleSheets
  ])
  const entry = Object.freeze({
    authorRevision: author.revision,
    compiledRevision: compiled.revision,
    rules
  })
  cache.entries.set(host.key, entry)
  cache.parses += 1
  return entry
}

export function prepareHostStyleSheets(styleSheets: readonly string[]): HostStyleSheetSet {
  if (!Array.isArray(styleSheets) || styleSheets.some(styleSheet => typeof styleSheet !== "string")) {
    throw new TypeError("styleSheets must be an array of CSS strings")
  }
  const immutable = Object.freeze([...styleSheets])
  return Object.freeze({
    key: immutable.map(styleSheet => `${styleSheet.length}:${styleSheet}`).join("|"),
    styleSheets: immutable
  })
}

/** Internal focused-test evidence; not re-exported by the package. */
export function documentStyleRuleCacheStats(
  document: Document
): Readonly<{entries: number; parses: number}> {
  const cache = cacheByDocument.get(document)
  return Object.freeze({entries: cache?.entries.size ?? 0, parses: cache?.parses ?? 0})
}

function createDocumentCache(document: Document): DocumentCache {
  const cache = {entries: new Map(), parses: 0}
  cacheByDocument.set(document, cache)
  return cache
}
