import {
  readDocumentCompiledStyleSheets,
  type Document
} from "@zavx0z/dom"
import {parseStyleSheets, type StyleRuleIndex} from "./css.ts"

type CacheEntry = Readonly<{
  revision: number
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
  const snapshot = readDocumentCompiledStyleSheets(document)
  const cache = cacheByDocument.get(document) ?? createDocumentCache(document)
  const cached = cache.entries.get(host.key)
  if (cached?.revision === snapshot.revision) return cached

  const rules = parseStyleSheets([
    ...snapshot.styleSheets.map(styleSheet => styleSheet.cssText),
    ...host.styleSheets
  ])
  const entry = Object.freeze({revision: snapshot.revision, rules})
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
