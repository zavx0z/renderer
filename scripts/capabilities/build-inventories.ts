import { existsSync, readFileSync, statSync } from "node:fs"
import { basename, dirname, extname, join, relative, resolve } from "node:path"
import { buildManualInventories } from "./manual-inventory.ts"
import {
  CAPABILITY_SCHEMA_VERSION,
  GENERATOR_VERSION,
  normalizeIdSegment,
  readJson,
  rendererRoot,
  sha256,
  stableStringify,
  uniqueId,
  workspaceRoots,
  writeJsonIfChanged,
} from "./model.ts"
import type {
  CapabilityInventoryEntry,
  CapabilityOwner,
  InventoryFile,
} from "./model.ts"

interface WebIdlDefinition {
  type: string
  name?: string
  inheritance?: string | null
  target?: string
  includes?: string
  members?: WebIdlDefinition[]
  values?: Array<{ type?: string; value?: string }>
  arguments?: WebIdlDefinition[]
  idlType?: unknown
  extAttrs?: Array<{ name?: string; rhs?: unknown }>
  readonly?: boolean
  special?: string
  default?: unknown
}

interface WebIdlModule {
  parse(source: string, options?: { sourceName?: string }): WebIdlDefinition[]
  write(definition: WebIdlDefinition | WebIdlDefinition[]): string
}

interface WebRefCssItem {
  name: string
  href?: string
  prose?: string
  syntax?: string
  for?: string | string[]
  descriptors?: WebRefCssItem[]
  [key: string]: unknown
}

interface WebRefCss {
  properties: WebRefCssItem[]
  selectors: WebRefCssItem[]
  atrules: WebRefCssItem[]
  functions: WebRefCssItem[]
  types: WebRefCssItem[]
}

interface WebRefElement {
  name: string
  href: string
  interface: string
}

interface WebRefElements {
  spec: { title: string; url: string }
  elements: WebRefElement[]
}

interface WebRefEvent {
  type: string
  href?: string
  interface: string
  cancelable?: boolean
  targets: Array<{ target: string; bubbles?: boolean }>
  src?: { href?: string; format?: string }
  extendedIn?: string[]
}

interface SourceLock {
  sources: Array<{ id: string; version: string }>
}

interface HtmlCell {
  text: string
  codes: string[]
  links: Array<{ text: string; href: string }>
}

interface HtmlRow {
  cells: HtmlCell[]
}

interface HtmlElementIndexEntry {
  name: string
  href: string
  description: string
  categories: string
  parents: string
  children: string
  attributes: Array<{ name: string; href?: string }>
  interface: string
}

interface HtmlAttributeIndexEntry {
  name: string
  href?: string
  elements: string[]
  global: boolean
  description: string
  value: string
}

interface PublicSymbol {
  name: string
  path: string
  line: number
  typeOnly: boolean
}

interface RewriterTextChunk {
  text: string
}

interface RewriterElement {
  getAttribute(name: string): string | null
  onEndTag(callback: () => void): void
}

interface Rewriter {
  on(
    selector: string,
    handlers: {
      element?: (element: RewriterElement) => void
      text?: (chunk: RewriterTextChunk) => void
    },
  ): Rewriter
  transform(response: Response): Response
}

declare const HTMLRewriter: new () => Rewriter

const specificationsRoot = resolve(rendererRoot, "specifications")
const sourcesRoot = resolve(specificationsRoot, "sources")
const lock = await readJson<SourceLock>(resolve(specificationsRoot, "sources.lock.json"))
const sourceVersions = new Map(lock.sources.map((source) => [source.id, source.version]))
const webidl2 = await import(resolve(sourcesRoot, "tooling/webidl2.mjs")) as unknown as WebIdlModule
const outputFiles = new Map<string, CapabilityInventoryEntry[]>()
const interactiveElements = new Set([
  "a", "area", "audio", "button", "details", "dialog", "embed", "iframe", "img", "input", "label", "object",
  "select", "summary", "textarea", "video",
])

await buildDomInventories()
await buildHtmlInventories()
await buildCssInventories()
await buildReactInventory()
await buildPackageExportInventories()
addManualInventories()

const allEntries = [...outputFiles.values()].flat()
const ids = new Set<string>()
for (const entry of allEntries) {
  if (ids.has(entry.id)) throw new Error(`Duplicate generated capability ID: ${entry.id}`)
  ids.add(entry.id)
}

const manifestFiles: Array<{ path: string; entries: number; digest: string }> = []
for (const [relativePath, entries] of [...outputFiles].sort(([left], [right]) => left.localeCompare(right))) {
  entries.sort((left, right) => left.id.localeCompare(right.id))
  const inventory: InventoryFile = {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    source: relativePath,
    entries,
  }
  await writeJsonIfChanged(resolve(specificationsRoot, relativePath), inventory)
  manifestFiles.push({
    path: relativePath,
    entries: entries.length,
    digest: sha256(stableStringify(inventory)),
  })
}

await writeJsonIfChanged(resolve(specificationsRoot, "inventory.manifest.json"), {
  schemaVersion: CAPABILITY_SCHEMA_VERSION,
  generatorVersion: GENERATOR_VERSION,
  files: manifestFiles,
  totalEntries: allEntries.length,
})

async function buildDomInventories(): Promise<void> {
  const idlFiles = [
    "dom.idl",
    "uievents.idl",
    "pointerevents.idl",
    "input-events.idl",
    "selection-api.idl",
    "cssom-view.idl",
  ]
  for (const file of idlFiles) {
    const source = file === "dom.idl"
      ? { id: "whatwg-dom", version: version("whatwg-dom"), href: "https://dom.spec.whatwg.org/" }
      : idlSource(file)
    const prefix = file === "dom.idl" ? "dom" : `dom.extensions.${normalizeIdSegment(basename(file, ".idl"))}`
    const entries = await parseIdlInventory("dom", prefix, file, source, owner("dom"))
    add(`dom/interfaces/${basename(file, ".idl")}.json`, entries)
  }

  const events = await readJson<WebRefEvent[]>(resolve(sourcesRoot, "webref/events/events.json"))
  const selected = events.filter((event) => isDomEventHref(event.href))
  add("dom/events.json", eventEntries("dom", "dom.events", selected, owner("dom")))
}

async function buildHtmlInventories(): Promise<void> {
  const htmlIdl = await parseIdlInventory(
    "html",
    "html",
    "html.idl",
    { id: "whatwg-html", version: version("whatwg-html"), href: "https://html.spec.whatwg.org/multipage/" },
    owner("dom"),
  )
  add("html/interfaces/html.json", htmlIdl)

  const clipboardIdl = await parseIdlInventory(
    "html",
    "html.clipboard",
    "clipboard-apis.idl",
    idlSource("clipboard-apis.idl"),
    owner("dom"),
  )
  add("html/interfaces/clipboard.json", clipboardIdl)

  const indexHtml = await Bun.file(resolve(sourcesRoot, "normative/html-indices.html")).text()
  const [indexedElements, indexedAttributes] = await Promise.all([
    parseHtmlElementIndex(indexHtml),
    parseHtmlAttributeIndex(indexHtml),
  ])
  const webref = await readJson<WebRefElements>(resolve(sourcesRoot, "webref/elements/html.json"))
  const webrefByName = new Map(webref.elements.map((element) => [element.name, element]))

  for (const element of indexedElements) {
    const sourceElement = webrefByName.get(element.name)
    const href = sourceElement?.href ?? element.href
    const elementId = `html.elements.${normalizeIdSegment(element.name)}`
    const entries: CapabilityInventoryEntry[] = [
      {
        id: elementId,
        domain: "html",
        kind: "element",
        name: element.name,
        description: element.description,
        spec: standardSpec("whatwg-html", version("whatwg-html"), href),
        ownerHint: owner("dom"),
        metadata: {
          interface: sourceElement?.interface ?? element.interface,
          categories: element.categories,
          parents: element.parents,
          children: element.children,
        },
      },
      elementChild(elementId, element, "interface-mapping", "interface mapping", href),
      elementChild(elementId, element, "content-categories", "content categories", href),
      elementChild(elementId, element, "content-model", "content model", href),
      elementChild(
        elementId,
        element,
        "accessibility-semantics",
        "implicit role, allowed ARIA, accessible name/state, and platform mapping",
        "https://w3c.github.io/html-aam/#html-element-role-mappings",
        "html-aam",
      ),
    ]

    if (interactiveElements.has(element.name)) {
      entries.push(elementChild(elementId, element, "activation-behavior", "activation and default action", href))
    }

    for (const attribute of element.attributes) {
      if (attribute.name === "globals") continue
      entries.push({
        id: `${elementId}.attributes.${normalizeIdSegment(attribute.name)}`,
        domain: "html",
        kind: "element-attribute",
        name: attribute.name,
        parent: elementId,
        description: `${attribute.name} content attribute on <${element.name}>.`,
        spec: standardSpec(
          "whatwg-html",
          version("whatwg-html"),
          attribute.href ?? href,
        ),
        ownerHint: owner("dom"),
        metadata: { element: element.name, interface: sourceElement?.interface ?? element.interface },
      })
    }
    add(`html/elements/${normalizeIdSegment(element.name)}.json`, entries)
  }

  const attributeEntries: CapabilityInventoryEntry[] = indexedAttributes.map((attribute) => ({
    id: `html.attributes.${normalizeIdSegment(attribute.name)}`,
    domain: "html",
    kind: attribute.global ? "global-attribute" : "attribute",
    name: attribute.name,
    description: attribute.description,
    spec: standardSpec(
      "whatwg-html",
      version("whatwg-html"),
      attribute.href ?? "https://html.spec.whatwg.org/dev/indices.html#attributes-3",
    ),
    ownerHint: owner("dom"),
    metadata: { elements: attribute.elements, global: attribute.global, value: attribute.value },
  } satisfies CapabilityInventoryEntry))

  attributeEntries.push(
    {
      id: "html.attributes.aria-wildcard",
      domain: "html",
      kind: "global-attribute-family",
      name: "aria-*",
      description: "ARIA state and property content attributes allowed by ARIA in HTML.",
      spec: standardSpec("aria-in-html", version("aria-in-html"), "https://w3c.github.io/html-aria/#docconformance"),
      ownerHint: owner("dom"),
      metadata: { global: true },
    },
    {
      id: "html.attributes.data-wildcard",
      domain: "html",
      kind: "global-attribute-family",
      name: "data-*",
      description: "Custom data attributes and dataset reflection boundary.",
      spec: standardSpec("whatwg-html", version("whatwg-html"), "https://html.spec.whatwg.org/multipage/dom.html#embedding-custom-non-visible-data-with-the-data-*-attributes"),
      ownerHint: owner("dom"),
      metadata: { global: true },
    },
  )
  add("html/attributes.json", dedupeEntries(attributeEntries))

  const events = await readJson<WebRefEvent[]>(resolve(sourcesRoot, "webref/events/events.json"))
  add(
    "html/events.json",
    eventEntries(
      "html",
      "html.events",
      events.filter((event) => eventHref(event).includes("html.spec.whatwg.org") || eventHref(event).includes("clipboard")),
      owner("dom"),
    ),
  )
}

async function buildCssInventories(): Promise<void> {
  const css = await readJson<WebRefCss>(resolve(sourcesRoot, "webref/css.json"))
  const used = new Set<string>()

  const properties = css.properties.map((item) => cssEntry("property", "css.properties", item, used))
  const groups = new Map<string, CapabilityInventoryEntry[]>()
  for (const entry of properties) {
    const initial = /^[a-z]$/.test(entry.name[0]?.toLowerCase() ?? "") ? entry.name[0]!.toLowerCase() : "other"
    const bucket = groups.get(initial) ?? []
    bucket.push(entry)
    groups.set(initial, bucket)
  }
  for (const [initial, entries] of groups) add(`css/properties/${initial}.json`, entries)

  add("css/selectors.json", css.selectors.map((item) => cssEntry("selector", "css.selectors", item, used)))
  add("css/functions.json", css.functions.map((item) => cssEntry("function", "css.functions", item, used)))
  add("css/types.json", css.types.map((item) => cssEntry("data-type", "css.types", item, used)))

  const atRules: CapabilityInventoryEntry[] = []
  for (const item of css.atrules) {
    const parent = cssEntry("at-rule", "css.at-rules", item, used)
    atRules.push(parent)
    for (const descriptor of item.descriptors ?? []) {
      const base = `${parent.id}.descriptors.${normalizeIdSegment(descriptor.name)}`
      const id = uniqueId(base, `${item.name}:${descriptor.name}:${descriptor.href ?? ""}`, used)
      atRules.push({
        ...cssEntry("descriptor", `${parent.id}.descriptors`, descriptor, used, id),
        id,
        parent: parent.id,
      })
    }
  }
  add("css/at-rules.json", atRules)

  const cssIdlFiles = (await Array.fromAsync(new Bun.Glob("*.idl").scan({
    cwd: resolve(sourcesRoot, "webref/idl"),
    absolute: false,
  }))).filter((file) => file === "cssom.idl" || file.startsWith("css-"))

  for (const file of cssIdlFiles.sort()) {
    const entries = await parseIdlInventory(
      "css",
      `css.cssom.${normalizeIdSegment(basename(file, ".idl"))}`,
      file,
      { id: "webref-idl", version: version("webref-idl"), href: `webref/idl/${file}` },
      owner("core"),
    )
    add(`css/cssom/${basename(file, ".idl")}.json`, entries)
  }
}

async function buildReactInventory(): Promise<void> {
  const react = await readJson<{ entrypoints: Record<string, string[]>; version: string }>(
    resolve(sourcesRoot, "reference/react-19.2-exports.json"),
  )
  const reactDom = await readJson<{ entrypoints: Record<string, string[]>; version: string }>(
    resolve(sourcesRoot, "reference/react-dom-19.2-exports.json"),
  )
  const categories = new Map<string, CapabilityInventoryEntry[]>()

  for (const [entrypoint, names] of Object.entries(react.entrypoints)) {
    for (const name of names) {
      const category = classifyReactExport(entrypoint, name)
      const prefix = category === "hooks" ? "react.hooks" : `react.${category}`
      pushCategory(categories, category, reactExportEntry(prefix, entrypoint, name, "react-19.2"))
    }
  }

  for (const [entrypoint, names] of Object.entries(reactDom.entrypoints)) {
    for (const name of names) {
      pushCategory(categories, "react-dom", reactExportEntry("react.react-dom", entrypoint, name, "react-dom-19.2"))
    }
  }

  const directives = ["use client", "use server", "use memo", "use no memo"].map((name) => ({
    id: `react.directives.${normalizeIdSegment(name)}`,
    domain: "react",
    kind: "directive",
    name,
    description: `React 19.2 ${name} directive reference surface.`,
    spec: referenceSpec("react-docs-19.2", "19.2", `https://react.dev/reference/rsc/${normalizeIdSegment(name)}`),
    ownerHint: owner("react"),
  } satisfies CapabilityInventoryEntry))
  pushCategory(categories, "directives", ...directives)

  for (const [category, entries] of categories) add(`react-19.2/${category}.json`, dedupeEntries(entries))
}

async function buildPackageExportInventories(): Promise<void> {
  const packages = [
    { repository: "renderer", root: resolve(rendererRoot, "packages/dom"), domain: "dom", owner: owner("dom"), file: "platform/dom-exports.json" },
    { repository: "renderer", root: resolve(rendererRoot, "packages/core"), domain: "renderer", owner: owner("core"), file: "platform/renderer-exports.json" },
    { repository: "renderer", root: resolve(rendererRoot, "packages/browser"), domain: "browser", owner: owner("browser"), file: "platform/browser-exports.json" },
    { repository: "renderer", root: resolve(rendererRoot, "packages/webgpu"), domain: "webgpu", owner: owner("webgpu"), file: "platform/webgpu-exports.json" },
    { repository: "renderer", root: resolve(rendererRoot, "packages/react"), domain: "react", owner: owner("react"), file: "platform/react-exports.json" },
    { repository: "renderer", root: resolve(rendererRoot, "packages/devtools"), domain: "devtools", owner: owner("devtools"), file: "platform/devtools-exports.json" },
    { repository: "template", root: workspaceRoots.template, domain: "tsx", owner: owner("template"), file: "platform/template-exports.json" },
    { repository: "engine", root: resolve(workspaceRoots.engine, "packages/core"), domain: "engine", owner: owner("engine"), file: "platform/engine-exports.json" },
  ] as const

  for (const item of packages) {
    add(item.file, await scanPackageExports(item.repository, item.root, item.domain, item.owner))
  }
}

function addManualInventories(): void {
  const manual = buildManualInventories()
  const grouped = new Map<string, CapabilityInventoryEntry[]>()
  for (const entry of manual) {
    const file = manualFile(entry)
    const bucket = grouped.get(file) ?? []
    bucket.push(entry)
    grouped.set(file, bucket)
  }
  for (const [file, entries] of grouped) add(file, entries)
}

function manualFile(entry: CapabilityInventoryEntry): string {
  if (entry.id.startsWith("dom.")) return "dom/algorithms.json"
  if (entry.id.startsWith("html.")) return "html/behaviors.json"
  if (entry.id.startsWith("css.")) return "css/features.json"
  if (entry.id.startsWith("react.")) return "react-19.2/semantics.json"
  if (entry.id.startsWith("tsx.typescript.")) return "tsx/typescript.json"
  if (entry.id.startsWith("tsx.tagged-html.")) return "tsx/tagged-html.json"
  if (entry.id.startsWith("tsx.compiler.")) return "tsx/compiler.json"
  if (entry.id.startsWith("renderer.")) return "platform/renderer-features.json"
  if (entry.id.startsWith("browser.")) return "platform/browser-features.json"
  if (entry.id.startsWith("webgpu.")) return "platform/webgpu-features.json"
  if (entry.id.startsWith("devtools.")) return "platform/devtools-features.json"
  if (entry.id.startsWith("engine.")) return "platform/engine-features.json"
  throw new Error(`No manual inventory file for ${entry.id}`)
}

async function parseIdlInventory(
  domain: string,
  prefix: string,
  file: string,
  source: { id: string; version: string; href: string },
  ownerHint: CapabilityOwner,
): Promise<CapabilityInventoryEntry[]> {
  const text = await Bun.file(resolve(sourcesRoot, "webref/idl", file)).text()
  const definitions = webidl2.parse(text, { sourceName: file })
  const entries: CapabilityInventoryEntry[] = []
  const used = new Set<string>()

  for (const definition of definitions) {
    const definitionName = definition.name ?? `${definition.target ?? "unknown"}-includes-${definition.includes ?? "unknown"}`
    const category = idlCategory(definition.type)
    const base = `${prefix}.${category}.${normalizeIdSegment(definitionName)}`
    const identity = safeIdlWrite(definition)
    const id = uniqueId(base, identity, used)
    const anchor = `${source.href}#WebIDL:${definitionName}`
    const extAttrs = simplifyExtAttrs(definition.extAttrs)
    entries.push({
      id,
      domain,
      kind: definition.type,
      name: definitionName,
      description: `${definition.type} ${definitionName} from ${file}.`,
      spec: standardSpec(source.id, source.version, anchor),
      ownerHint,
      metadata: {
        idlSource: file,
        ...(definition.inheritance ? { inheritance: definition.inheritance } : {}),
        ...(extAttrs.length ? { extendedAttributes: extAttrs } : {}),
      },
    })

    if (definition.inheritance) {
      entries.push({
        id: uniqueId(`${id}.inheritance`, `${identity}:inheritance`, used),
        domain,
        kind: "inheritance",
        name: `${definitionName} inherits ${definition.inheritance}`,
        parent: id,
        description: `${definitionName} has ${definition.inheritance} as its declared base interface.`,
        spec: standardSpec(source.id, source.version, anchor),
        ownerHint,
        metadata: { base: definition.inheritance },
      })
    }

    for (const member of definition.members ?? []) {
      const memberName = idlMemberName(member)
      const memberKind = idlMemberCategory(member)
      const memberIdentity = safeIdlWrite(member)
      const memberBase = `${id}.${memberKind}.${normalizeIdSegment(memberName)}`
      const memberId = uniqueId(memberBase, `${identity}:${memberIdentity}`, used)
      const memberExtAttrs = simplifyExtAttrs(member.extAttrs)
      entries.push({
        id: memberId,
        domain,
        kind: member.type,
        name: memberName,
        parent: id,
        description: `${definitionName}.${memberName} Web IDL ${member.type}.`,
        spec: standardSpec(source.id, source.version, `${source.href}#WebIDL:${definitionName}.${memberName}`),
        ownerHint,
        metadata: {
          idlSource: file,
          signature: memberIdentity,
          ...(member.readonly !== undefined ? { readonly: member.readonly } : {}),
          ...(member.special ? { special: member.special } : {}),
          ...(memberExtAttrs.length ? { extendedAttributes: memberExtAttrs } : {}),
        },
      })

      if (domain === "html" && memberExtAttrs.some((attribute) => attribute.startsWith("Reflect"))) {
        entries.push({
          id: uniqueId(`html.reflections.${normalizeIdSegment(definitionName)}.${normalizeIdSegment(memberName)}`, memberIdentity, used),
          domain,
          kind: "attribute-property-reflection",
          name: `${definitionName}.${memberName} reflection`,
          parent: memberId,
          description: `${definitionName}.${memberName} reflects a content attribute according to its Web IDL extended attribute.`,
          spec: standardSpec(source.id, source.version, `${source.href}#WebIDL:${definitionName}.${memberName}`),
          ownerHint,
          metadata: { extendedAttributes: memberExtAttrs },
        })
      }
    }

    for (const value of definition.values ?? []) {
      const rawValue = value.value ?? value.type ?? "unknown"
      const valueName = rawValue === "" ? "(empty string)" : rawValue
      entries.push({
        id: uniqueId(`${id}.values.${normalizeIdSegment(rawValue)}`, `${identity}:${rawValue}`, used),
        domain,
        kind: "enum-value",
        name: valueName,
        parent: id,
        description: `${definitionName} enum value ${valueName}.`,
        spec: standardSpec(source.id, source.version, anchor),
        ownerHint,
        metadata: { rawValue },
      })
    }
  }
  return entries
}

function idlCategory(type: string): string {
  const mapping: Record<string, string> = {
    interface: "interfaces",
    "interface mixin": "mixins",
    dictionary: "dictionaries",
    enum: "enums",
    typedef: "typedefs",
    namespace: "namespaces",
    callback: "callbacks",
    "callback interface": "callback-interfaces",
    includes: "includes",
  }
  return mapping[type] ?? `${normalizeIdSegment(type)}s`
}

function idlMemberCategory(member: WebIdlDefinition): string {
  if (member.type === "attribute") return "attributes"
  if (member.type === "operation") return "methods"
  if (member.type === "const") return "constants"
  if (member.type === "constructor") return "constructors"
  if (member.type === "field") return "fields"
  return normalizeIdSegment(member.type)
}

function idlMemberName(member: WebIdlDefinition): string {
  if (member.name) return member.name
  if (member.type === "constructor") return "constructor"
  if (member.special) return member.special
  return `${member.type}-${sha256(safeIdlWrite(member)).slice(0, 8)}`
}

function safeIdlWrite(definition: WebIdlDefinition): string {
  try {
    return webidl2.write(definition).trim()
  } catch {
    return JSON.stringify(definition)
  }
}

function simplifyExtAttrs(attributes: WebIdlDefinition["extAttrs"]): string[] {
  return (attributes ?? []).map((attribute) => {
    if (!attribute.name) return "unknown"
    if (attribute.rhs === undefined || attribute.rhs === null) return attribute.name
    const rhs = typeof attribute.rhs === "object" ? JSON.stringify(attribute.rhs) : String(attribute.rhs)
    return `${attribute.name}=${rhs}`
  })
}

function eventEntries(
  domain: string,
  prefix: string,
  events: WebRefEvent[],
  ownerHint: CapabilityOwner,
): CapabilityInventoryEntry[] {
  const used = new Set<string>()
  return events.map((event) => {
    const href = eventHref(event)
    const identity = `${event.type}:${event.interface}:${href}:${JSON.stringify(event.targets)}`
    const id = uniqueId(`${prefix}.${normalizeIdSegment(event.type)}`, identity, used)
    return {
      id,
      domain,
      kind: "event",
      name: event.type,
      description: `${event.type} event using ${event.interface}.`,
      spec: standardSpec(sourceIdForHref(href), sourceVersionForHref(href), href),
      ownerHint,
      metadata: {
        interface: event.interface,
        targets: event.targets,
        ...(event.cancelable !== undefined ? { cancelable: event.cancelable } : {}),
        ...(event.extendedIn ? { extendedIn: event.extendedIn } : {}),
      },
    }
  })
}

function cssEntry(
  kind: string,
  prefix: string,
  item: WebRefCssItem,
  used: Set<string>,
  forcedId?: string,
): CapabilityInventoryEntry {
  const identity = `${kind}:${item.name}:${item.href ?? ""}:${item.for ?? ""}`
  const id = forcedId ?? uniqueId(`${prefix}.${normalizeIdSegment(item.name)}`, identity, used)
  const metadata = Object.fromEntries(
    Object.entries(item).filter(([key]) => !["name", "href", "prose", "descriptors"].includes(key)),
  )
  return {
    id,
    domain: "css",
    kind,
    name: item.name,
    ...(item.prose ? { description: item.prose } : {}),
    spec: standardSpec(cssSourceId(item.href), version("webref-css"), item.href ?? "https://www.w3.org/TR/css-2025/"),
    ownerHint: owner("core"),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  }
}

function reactExportEntry(prefix: string, entrypoint: string, name: string, source: string): CapabilityInventoryEntry {
  return {
    id: `${prefix}.${normalizeIdSegment(entrypoint)}.${normalizeIdSegment(name)}`,
    domain: "react",
    kind: entrypoint.includes("jsx") ? "jsx-runtime-export" : name.startsWith("use") ? "hook" : "api",
    name,
    description: `${entrypoint} public export ${name} in React 19.2 reference profile.`,
    spec: referenceSpec(source, "19.2.0", `npm:${entrypoint}@19.2.0#exports.${name}`),
    ownerHint: owner("react"),
    metadata: { entrypoint },
  }
}

function classifyReactExport(entrypoint: string, name: string): string {
  if (entrypoint.includes("jsx")) return "jsx-runtime"
  if (entrypoint.includes("compiler-runtime")) return "compiler-runtime"
  if (name.startsWith("use") || name === "unstable_useCacheRefresh") return "hooks"
  if (["Activity", "Fragment", "Profiler", "StrictMode", "Suspense"].includes(name)) return "components"
  if (["Children", "cloneElement", "Component", "createElement", "createRef", "forwardRef", "isValidElement", "PureComponent"].includes(name)) return "legacy"
  return "apis"
}

function pushCategory(
  categories: Map<string, CapabilityInventoryEntry[]>,
  category: string,
  ...entries: CapabilityInventoryEntry[]
): void {
  const bucket = categories.get(category) ?? []
  bucket.push(...entries)
  categories.set(category, bucket)
}

async function scanPackageExports(
  repository: string,
  packageRoot: string,
  domain: string,
  ownerHint: CapabilityOwner,
): Promise<CapabilityInventoryEntry[]> {
  const manifest = await readJson<{ name: string; exports?: unknown; version?: string }>(resolve(packageRoot, "package.json"))
  const entrypoints = flattenPackageExports(manifest.exports)
  const entries: CapabilityInventoryEntry[] = []
  const packagePrefix = `platform.${normalizeIdSegment(manifest.name)}`
  const revision = ownerRevision(ownerHint)

  for (const [subpath, target] of entrypoints) {
    const exportPathId = `${packagePrefix}.export-paths.${normalizeIdSegment(subpath)}`
    const sourceTarget = resolveSourceTarget(packageRoot, target)
    entries.push({
      id: exportPathId,
      domain,
      kind: "package-export-path",
      name: subpath,
      description: `${manifest.name} package export ${subpath}.`,
      spec: projectSpec(`${manifest.name}-exports`, `${manifest.version ?? "workspace"} at ${revision}`, target),
      ownerHint,
      metadata: { package: manifest.name, target, ...(sourceTarget ? { sourceTarget: relative(packageRoot, sourceTarget) } : {}) },
    })

    if (!sourceTarget || !/\.[cm]?[jt]sx?$/.test(sourceTarget)) continue
    const symbols = collectExports(sourceTarget, new Set<string>())
    for (const symbol of symbols) {
      const symbolId = `${exportPathId}.symbols.${normalizeIdSegment(symbol.name)}`
      entries.push({
        id: symbolId,
        domain,
        kind: symbol.typeOnly ? "type-export" : "runtime-export",
        name: symbol.name,
        parent: exportPathId,
        description: `${manifest.name}${subpath === "." ? "" : subpath.slice(1)} public ${symbol.typeOnly ? "type" : "runtime"} export ${symbol.name}.`,
        spec: projectSpec(`${manifest.name}-exports`, `${manifest.version ?? "workspace"} at ${revision}`, `${symbol.path}#L${symbol.line}`),
        ownerHint,
        metadata: { repository, path: symbol.path, line: symbol.line, entrypoint: subpath, typeOnly: symbol.typeOnly },
      })
    }
  }
  return dedupeEntries(entries)
}

function flattenPackageExports(exportsValue: unknown): Array<[string, string]> {
  if (typeof exportsValue === "string") return [[".", exportsValue]]
  if (!exportsValue || typeof exportsValue !== "object") return []
  const entries: Array<[string, string]> = []
  for (const [subpath, value] of Object.entries(exportsValue as Record<string, unknown>)) {
    const target = pickExportTarget(value)
    if (target) entries.push([subpath, target])
  }
  return entries
}

function pickExportTarget(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (!value || typeof value !== "object") return undefined
  const record = value as Record<string, unknown>
  for (const condition of ["bun", "default", "import", "types"]) {
    const selected = pickExportTarget(record[condition])
    if (selected) return selected
  }
  for (const selected of Object.values(record)) {
    const target = pickExportTarget(selected)
    if (target) return target
  }
  return undefined
}

function resolveSourceTarget(packageRoot: string, target: string): string | undefined {
  const direct = resolve(packageRoot, target)
  const sourceCandidate = resolve(packageRoot, target.replace(/^\.\/dist\//, "./").replace(/\.[cm]?js$/, ".ts"))
  if (existsSync(sourceCandidate)) return sourceCandidate
  if (existsSync(direct)) return direct
  return undefined
}

function collectExports(file: string, visited: Set<string>): PublicSymbol[] {
  if (visited.has(file)) return []
  visited.add(file)
  const sourceText = readFileSync(file, "utf8")
  const symbols: PublicSymbol[] = []
  const path = repositoryRelativePath(file)

  for (const match of sourceText.matchAll(/\bexport\s+\*\s+from\s+["']([^"']+)["']/g)) {
    const moduleName = match[1]
    const target = moduleName?.startsWith(".") ? resolveTsModule(file, moduleName) : undefined
    if (target) symbols.push(...collectExports(target, visited))
  }

  for (const match of sourceText.matchAll(/\bexport\s+(type\s+)?\{([\s\S]*?)\}(?:\s+from\s+["']([^"']+)["'])?/g)) {
    const declarationTypeOnly = Boolean(match[1])
    const body = match[2] ?? ""
    for (const rawPart of body.split(",")) {
      const part = rawPart.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/g, "").trim()
      if (!part) continue
      const itemTypeOnly = declarationTypeOnly || part.startsWith("type ")
      const withoutType = part.replace(/^type\s+/, "").trim()
      const alias = withoutType.split(/\s+as\s+/)
      const exportedName = (alias[1] ?? alias[0])?.trim()
      if (!exportedName || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(exportedName)) continue
      symbols.push({
        name: exportedName,
        path,
        line: lineAt(sourceText, match.index ?? 0),
        typeOnly: itemTypeOnly,
      })
    }
  }

  for (const match of sourceText.matchAll(/\bexport\s+(?:declare\s+)?(?:abstract\s+)?(class|function|interface|type|const|let|var|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)) {
    const declarationKind = match[1] ?? ""
    const name = match[2]
    if (!name) continue
    symbols.push({
      name,
      path,
      line: lineAt(sourceText, match.index ?? 0),
      typeOnly: declarationKind === "interface" || declarationKind === "type",
    })
  }

  for (const match of sourceText.matchAll(/\bexport\s+default\b/g)) {
    symbols.push({ name: "default", path, line: lineAt(sourceText, match.index ?? 0), typeOnly: false })
  }
  return dedupeSymbols(symbols)
}

function lineAt(source: string, index: number): number {
  let line = 1
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) line += 1
  }
  return line
}

function resolveTsModule(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx"), base]
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
}

function repositoryRelativePath(file: string): string {
  for (const [repository, root] of Object.entries(workspaceRoots)) {
    if (file === root || file.startsWith(`${root}/`)) return `${repository}:${relative(root, file)}`
  }
  return file
}

function dedupeSymbols(symbols: PublicSymbol[]): PublicSymbol[] {
  const seen = new Set<string>()
  return symbols.filter((symbol) => {
    const key = symbol.name
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((left, right) => left.name.localeCompare(right.name))
}

async function parseHtmlElementIndex(html: string): Promise<HtmlElementIndexEntry[]> {
  const rows = await parseTable(html, "<table><caption>List of elements</caption>")
  return rows.flatMap((row) => {
    if (row.cells.length < 7) return []
    const name = row.cells[0]?.codes[0]?.trim()
    if (!name || name.toLowerCase() === "element") return []
    const firstLink = row.cells[0]?.links[0]
    return [{
      name,
      href: firstLink ? new URL(firstLink.href, "https://html.spec.whatwg.org/dev/indices.html").href : "https://html.spec.whatwg.org/dev/indices.html#elements-3",
      description: compact(row.cells[1]?.text),
      categories: compact(row.cells[2]?.text),
      parents: compact(row.cells[3]?.text),
      children: compact(row.cells[4]?.text),
      attributes: (row.cells[5]?.codes ?? []).map((attributeName) => ({
        name: attributeName.trim(),
        href: (() => {
          const value = row.cells[5]?.links.find((link) => link.text.trim() === attributeName.trim())?.href
          return value ? new URL(value, "https://html.spec.whatwg.org/dev/indices.html").href : undefined
        })(),
      })),
      interface: row.cells[6]?.codes[0]?.trim() ?? compact(row.cells[6]?.text),
    }]
  })
}

async function parseHtmlAttributeIndex(html: string): Promise<HtmlAttributeIndexEntry[]> {
  const rows = await parseTable(html, "<table id=attributes-1>")
  return rows.flatMap((row) => {
    if (row.cells.length < 4) return []
    const name = row.cells[0]?.codes[0]?.trim()
    if (!name || name.toLowerCase() === "attribute") return []
    const elementText = compact(row.cells[1]?.text)
    return [{
      name,
      href: row.cells[1]?.links[0]?.href
        ? new URL(row.cells[1]!.links[0]!.href, "https://html.spec.whatwg.org/dev/indices.html").href
        : undefined,
      elements: row.cells[1]?.codes.map((value) => value.trim()) ?? [],
      global: /HTML elements/i.test(elementText),
      description: compact(row.cells[2]?.text),
      value: compact(row.cells[3]?.text),
    }]
  })
}

async function parseTable(html: string, marker: string): Promise<HtmlRow[]> {
  const start = html.indexOf(marker)
  if (start < 0) throw new Error(`HTML index table marker not found: ${marker}`)
  const end = html.indexOf("</table>", start)
  if (end < 0) throw new Error(`HTML index table end not found: ${marker}`)
  const fragment = html.slice(start, end + "</table>".length)
  const rows: HtmlRow[] = []
  let currentRow: HtmlRow | undefined
  let currentCell: HtmlCell | undefined
  let currentCode: { cell: HtmlCell; text: string } | undefined
  let currentLink: { cell: HtmlCell; text: string; href: string } | undefined

  const rewriter = new HTMLRewriter()
    .on("tr", {
      element(element) {
        const row: HtmlRow = { cells: [] }
        currentRow = row
        element.onEndTag(() => {
          rows.push(row)
          if (currentRow === row) currentRow = undefined
        })
      },
    })
    .on("th, td", {
      element(element) {
        if (!currentRow) return
        const cell: HtmlCell = { text: "", codes: [], links: [] }
        currentRow.cells.push(cell)
        currentCell = cell
        element.onEndTag(() => {
          if (currentCell === cell) currentCell = undefined
        })
      },
      text(chunk) {
        if (currentCell) currentCell.text += chunk.text
      },
    })
    .on("code", {
      element(element) {
        if (!currentCell) return
        const code = { cell: currentCell, text: "" }
        currentCode = code
        element.onEndTag(() => {
          code.cell.codes.push(compact(code.text))
          if (currentCode === code) currentCode = undefined
        })
      },
      text(chunk) {
        if (currentCode) currentCode.text += chunk.text
      },
    })
    .on("a", {
      element(element) {
        if (!currentCell) return
        const link = { cell: currentCell, text: "", href: element.getAttribute("href") ?? "" }
        currentLink = link
        element.onEndTag(() => {
          link.cell.links.push({ text: compact(link.text), href: link.href })
          if (currentLink === link) currentLink = undefined
        })
      },
      text(chunk) {
        if (currentLink) currentLink.text += chunk.text
      },
    })

  await rewriter.transform(new Response(fragment, { headers: { "content-type": "text/html" } })).text()
  return rows
}

function elementChild(
  elementId: string,
  element: HtmlElementIndexEntry,
  suffix: string,
  label: string,
  anchor: string,
  source = "whatwg-html",
): CapabilityInventoryEntry {
  return {
    id: `${elementId}.${suffix}`,
    domain: "html",
    kind: suffix,
    name: `${element.name} ${label}`,
    parent: elementId,
    description: `The <${element.name}> element ${label}.`,
    spec: standardSpec(source, version(source), anchor),
    ownerHint: owner("dom"),
    metadata: { element: element.name, interface: element.interface },
  }
}

function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function add(path: string, entries: CapabilityInventoryEntry[]): void {
  const existing = outputFiles.get(path) ?? []
  existing.push(...entries)
  outputFiles.set(path, existing)
}

function dedupeEntries(entries: CapabilityInventoryEntry[]): CapabilityInventoryEntry[] {
  const byId = new Map<string, CapabilityInventoryEntry>()
  for (const entry of entries) {
    const current = byId.get(entry.id)
    if (!current) {
      byId.set(entry.id, entry)
      continue
    }
    const elements = new Set([
      ...asStrings(current.metadata?.elements),
      ...asStrings(entry.metadata?.elements),
    ])
    byId.set(entry.id, {
      ...current,
      metadata: { ...current.metadata, elements: [...elements].sort() },
    })
  }
  return [...byId.values()]
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function version(id: string): string {
  const value = sourceVersions.get(id)
  if (!value) throw new Error(`Source ${id} is not present in sources.lock.json`)
  return value
}

function owner(id: "dom" | "core" | "browser" | "webgpu" | "react" | "devtools" | "template" | "engine"): CapabilityOwner {
  const mapping: Record<typeof id, CapabilityOwner> = {
    dom: { repository: "renderer", package: "@zavx0z/dom", stage: "semantic" },
    core: { repository: "renderer", package: "@zavx0z/renderer", stage: "cpu" },
    browser: { repository: "renderer", package: "@zavx0z/renderer-browser", stage: "browser-host" },
    webgpu: { repository: "renderer", package: "@zavx0z/renderer-webgpu", stage: "webgpu" },
    react: { repository: "renderer", package: "@zavx0z/react", stage: "authoring-runtime" },
    devtools: { repository: "renderer", package: "@zavx0z/dom-devtools", stage: "inspection" },
    template: { repository: "template", package: "@zavx0z/template", stage: "compiler" },
    engine: { repository: "engine", package: "@engine/core", stage: "gpu-scene-resource" },
  }
  return mapping[id]
}

function standardSpec(source: string, sourceVersion: string, anchor: string) {
  return { source, version: sourceVersion, anchor, profile: "standard" as const }
}

function referenceSpec(source: string, sourceVersion: string, anchor: string) {
  return { source, version: sourceVersion, anchor, profile: "reference" as const }
}

function projectSpec(source: string, sourceVersion: string, anchor: string) {
  return { source, version: sourceVersion, anchor, profile: "project-contract" as const }
}

function idlSource(file: string): { id: string; version: string; href: string } {
  const sources: Record<string, { id: string; href: string }> = {
    "uievents.idl": { id: "ui-events", href: "https://w3c.github.io/uievents/" },
    "pointerevents.idl": { id: "pointer-events", href: "https://w3c.github.io/pointerevents/" },
    "input-events.idl": { id: "input-events", href: "https://w3c.github.io/input-events/" },
    "selection-api.idl": { id: "selection-api", href: "https://w3c.github.io/selection-api/" },
    "clipboard-apis.idl": { id: "clipboard-apis", href: "https://w3c.github.io/clipboard-apis/" },
    "cssom-view.idl": { id: "cssom-view", href: "https://drafts.csswg.org/cssom-view/" },
  }
  const selected = sources[file] ?? { id: "webref-idl", href: `webref/idl/${file}` }
  return { ...selected, version: version(selected.id) }
}

function sourceIdForHref(href: string): string {
  if (href.includes("dom.spec.whatwg.org")) return "whatwg-dom"
  if (href.includes("uievents")) return "ui-events"
  if (href.includes("pointerevents")) return "pointer-events"
  if (href.includes("input-events")) return "input-events"
  if (href.includes("selection-api")) return "selection-api"
  if (href.includes("clipboard")) return "clipboard-apis"
  if (href.includes("html.spec.whatwg.org")) return "whatwg-html"
  return "webref-events"
}

function sourceVersionForHref(href: string): string {
  return version(sourceIdForHref(href))
}

function isDomEventHref(href: string | undefined): boolean {
  if (!href) return false
  return ["dom.spec.whatwg.org", "uievents", "pointerevents", "input-events", "selection-api"].some((value) => href.includes(value))
}

function eventHref(event: WebRefEvent): string {
  return event.href ?? event.src?.href ?? "https://www.w3.org/TR/uievents/"
}

function cssSourceId(href: string | undefined): string {
  if (!href) return "webref-css"
  try {
    const url = new URL(href)
    const segment = url.pathname.split("/").filter(Boolean)[0]
    return segment ? `css:${segment}` : "webref-css"
  } catch {
    return "webref-css"
  }
}

function ownerRevision(ownerHint: CapabilityOwner): string {
  if (ownerHint.repository === "renderer") return "258176181fe98b604935c38d71aaca5b93aaf4b3"
  if (ownerHint.repository === "template") return "87d0ec3d2a9f19c3750d567ee20dc4bace995e90"
  if (ownerHint.repository === "engine") return "31164f46bb3d5dd9a7df018203f0e13a8a383dc5"
  return "unknown"
}
