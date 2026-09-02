import { resolve } from "node:path"
import {
  CAPABILITY_SCHEMA_VERSION,
  GENERATOR_VERSION,
  readJson,
  rendererRoot,
  workspaceRevision,
  workspaceRoots,
  writeJsonIfChanged,
} from "./model.ts"
import type {
  CapabilityConformance,
  CapabilityInventoryEntry,
  CapabilityOwner,
  CapabilityStatus,
  EvidenceRecord,
  InventoryFile,
  SupportOverlay,
  SupportRecord,
} from "./model.ts"
import {
  reviewedEventLeafPresence,
  reviewedHtmlInputLeafPresence,
} from "./leaf-support.ts"

interface InventoryManifest {
  files: Array<{ path: string }>
}

interface Classification {
  status: CapabilityStatus
  conformance: CapabilityConformance
  limitations: string[]
  evidence: EvidenceRecord[]
  stages?: Record<string, CapabilityStatus>
  reason?: string
  blockedBy?: string[]
  blocks?: string[]
  lastVerified?: {
    revision: string
    date: string
  }
}

const verificationDate = "2026-08-29"
const recoveryVerification = {
  revision: "258176181fe98b604935c38d71aaca5b93aaf4b3",
  date: "2026-08-31",
} as const
const computedColorVerification = {
  revision: "cb601358332ac1b74ad64ccaf18405153b48d269",
  date: "2026-08-31",
} as const
const engineFontVerification = {
  revision: "31164f46bb3d5dd9a7df018203f0e13a8a383dc5",
  date: "2026-08-31",
} as const
const textBaselineVerification = {
  revision: "9af61ff761a249a22d1ce22d61a7f2c3855f0c89",
  date: "2026-09-01",
} as const
const textAdvanceVerification = textBaselineVerification
const engineTextVerification = {
  revision: "0d63eeaf4e2057316212a1a8f5ff31684f22e2b2",
  date: "2026-09-01",
} as const
const rendererPathVerification = {
  revision: "3a0801d4d0fa39f385fca7aceca67fbd0736e591",
  date: "2026-09-01",
} as const
const projectionNeutralVerification = {
  revision: "80ee4f56c45ce1e260e8f61e564c73bf26edaaa9",
  date: "2026-09-02",
} as const
const enginePathVerification = {
  revision: "300d00fd5494308382e3efcdf2434cd1ee7cd2d1",
  date: "2026-09-01",
} as const
const domVectorPathLimitations = [
  "vector-path is a project extension with reflected d and a shared coordinate bound; it is not SVGPathElement, an SVG namespace implementation or Path2D, and DOM owns no parsing, geometry or paint.",
]
const rendererVectorPathLimitations = [
  "Bounded to one absolute open M/L/Q/C subpath, stroke-only paint and six samples per curve; relative/shorthand commands, fill, close, arcs, dashes, adaptive tessellation and complete SVG join/cap policy are unsupported.",
]
const webgpuVectorPathLimitations = [
  "Instanced batching admits exact-opaque Paths only; translucent Paths use the retained scalar correctness fallback. Complete SVG fill/stroking, dashes, arbitrary join/cap policy and adaptive curve quality are unsupported.",
]
const engineVectorPathLimitations = [
  "The instanced Engine contract admits exact-opaque independent sampled capsules only; translucent connected-stroke union/scalar fallback belongs to Renderer, and complete SVG fill/stroking, dashes, adaptive tessellation and analytical join self-union are unsupported. Outer AA fringe overlap at sampled joins remains a bounded limitation.",
]
const templateCssVerification = {
  revision: "c97d7113ad270a26a8ed8ec9ddf30eaf3bacf1a5",
  date: "2026-09-01",
} as const
const templateCapabilityVerification = {
  revision: "4b66cdee58840f3e59701f9a8c52b044512a1acb+dirty",
  date: "2026-09-01",
} as const
const domLeafVerification = {
  revision: workspaceRevision("renderer"),
  date: "2026-09-01",
} as const
const flexWrapVerification = {
  revision: "74ea59fc8fa7c7156ebaeefceed459097f52b4dd",
  date: "2026-08-30",
} as const
const alignContentVerification = {
  revision: "13241543ca2a06a8e145b20c3e8373411099b33f",
  date: "2026-08-30",
} as const
const flexGapVerification = {
  revision: "72fa158b043408817725856ce2b8e26d6a0e4d18",
  date: "2026-08-30",
} as const
const storybookAggregateRevision = "5c1ed1ec54ba451f95ddfa19a61c8ecd81f3ac66"
const storybookAlignContentRevision = "d249503ce60513fd4073b5b35fda10c1d2e751d8"
const revisions: Record<string, string> = {
  renderer: "3c91038c3f14ccc44616209fd82b1e59b7369408",
  template: templateCapabilityVerification.revision,
  engine: engineFontVerification.revision,
  ui: "77a075a0069ff43e1551b3cdbfe174fe525177d3",
  node: "9f390945f51f88c6374d5fb8f3215cf5d776e571",
  metafor: "603d5604ac550b044ad809d5be27190cba9118aa",
  interpreter: "879b4e01a4abd12756f86228784421e26270f485",
  demo: "7a88ae3d6fa82b53d03f08e0cc9f86b1c41f0325",
}

const overlayPaths: Record<string, string> = {
  "@zavx0z/dom": resolve(rendererRoot, "packages/dom/support.json"),
  "@zavx0z/renderer": resolve(rendererRoot, "packages/core/support.json"),
  "@zavx0z/renderer-browser": resolve(rendererRoot, "packages/browser/support.json"),
  "@zavx0z/renderer-webgpu": resolve(rendererRoot, "packages/webgpu/support.json"),
  "@zavx0z/react": resolve(rendererRoot, "packages/react/support.json"),
  "@zavx0z/dom-devtools": resolve(rendererRoot, "packages/devtools/support.json"),
  "@zavx0z/template": resolve(workspaceRoots.template, "support.json"),
  "@engine/core": resolve(workspaceRoots.engine, "packages/core/support.json"),
}

async function main(): Promise<void> {
  const selection = supportBuildSelection(process.argv.slice(2))
  const manifest = await readJson<InventoryManifest>(resolve(rendererRoot, "specifications/inventory.manifest.json"))
  const entries = (
    await Promise.all(manifest.files.map(async (file) => (
      await readJson<InventoryFile>(resolve(rendererRoot, "specifications", file.path))
    ).entries))
  ).flat()

  const grouped = new Map<string, CapabilityInventoryEntry[]>()
  for (const entry of entries) {
    const bucket = grouped.get(entry.ownerHint.package) ?? []
    bucket.push(entry)
    grouped.set(entry.ownerHint.package, bucket)
  }

  for (const [packageName, packageEntries] of grouped) {
    if (selection.package !== null && packageName !== selection.package) continue
    const output = overlayPaths[packageName]
    if (!output) throw new Error(`No support overlay path for ${packageName}`)
    const repository = packageEntries[0]?.ownerHint.repository
    if (!repository) throw new Error(`No repository for ${packageName}`)
    const revision = packageName === "@engine/core"
      ? engineTextVerification.revision
      : packageName === "@zavx0z/dom"
        ? domLeafVerification.revision
      : packageName === "@zavx0z/renderer" || packageName === "@zavx0z/renderer-webgpu"
      ? textBaselineVerification.revision
      : revisions[repository]
    if (!revision) throw new Error(`No revision for ${repository}`)
    const ownerVerificationDate = packageName === "@engine/core"
      ? engineTextVerification.date
      : packageName === "@zavx0z/renderer" || packageName === "@zavx0z/renderer-webgpu"
      ? textBaselineVerification.date
      : packageName === "@zavx0z/template"
        ? templateCapabilityVerification.date
        : packageName === "@zavx0z/dom"
          ? domLeafVerification.date
        : verificationDate
    const selectedEntries = selection.roots.length === 0
      ? packageEntries
      : packageEntries.filter(entry => selection.roots.some(root =>
        entry.id === root || entry.id.startsWith(`${root}.`)))
    const generatedRecords = selectedEntries
      .map((entry) => supportRecord(entry, classify(entry)))
      .sort((left, right) => left.id.localeCompare(right.id))
    const overlay: SupportOverlay = selection.roots.length === 0
      ? {
          schemaVersion: CAPABILITY_SCHEMA_VERSION,
          generatorVersion: GENERATOR_VERSION,
          repository,
          package: packageName,
          revision,
          verificationDate: ownerVerificationDate,
          records: generatedRecords,
        }
      : mergeSelectedSupportRecords(
          await readJson<SupportOverlay>(output),
          generatedRecords,
          selection.roots,
          revision,
          ownerVerificationDate,
        )
    await writeJsonIfChanged(output, overlay)
  }
  if (selection.package !== null && !grouped.has(selection.package)) {
    throw new Error(`Unknown support package: ${selection.package}`)
  }
}

function supportBuildSelection(argv: readonly string[]): Readonly<{
  package: string | null
  roots: readonly string[]
}> {
  let packageName: string | null = null
  const roots: string[] = []
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index]
    const value = argv[index + 1]
    if (!option || !value) throw new TypeError(supportBuildUsage())
    if (option === "--package") {
      if (packageName !== null) throw new TypeError("Duplicate --package")
      packageName = value
      continue
    }
    if (option === "--root") {
      roots.push(value)
      continue
    }
    throw new TypeError(`Unknown support build option: ${option}\n${supportBuildUsage()}`)
  }
  if (roots.length > 0 && packageName === null) throw new TypeError(`--root requires --package\n${supportBuildUsage()}`)
  return {package: packageName, roots: [...new Set(roots)].sort()}
}

function supportBuildUsage(): string {
  return "Usage: bun scripts/capabilities/build-support-overlays.ts [--package <package-name> [--root <capability-root>]...]"
}

function mergeSelectedSupportRecords(
  current: SupportOverlay,
  generated: readonly SupportRecord[],
  roots: readonly string[],
  revision: string,
  verificationDate: string,
): SupportOverlay {
  const replacements = new Map(generated.map(record => [record.id, record]))
  const records = current.records.map(record => replacements.get(record.id) ?? record)
  const existing = new Set(records.map(record => record.id))
  records.push(...generated.filter(record => !existing.has(record.id)))
  const stale = records.filter(record =>
    roots.some(root => record.id === root || record.id.startsWith(`${root}.`)) &&
    !replacements.has(record.id))
  if (stale.length > 0) {
    throw new Error(`Selected support merge found stale rows: ${stale.slice(0, 20).map(record => record.id).join(", ")}`)
  }
  return {
    ...current,
    revision,
    verificationDate,
    records,
  }
}

function supportRecord(entry: CapabilityInventoryEntry, classification: Classification): SupportRecord {
  const revision = revisions[entry.ownerHint.repository]
  if (!revision) throw new Error(`No revision for ${entry.ownerHint.repository}`)
  return {
    id: entry.id,
    status: classification.status,
    conformance: classification.conformance,
    owner: entry.ownerHint,
    ...(classification.stages ? { stages: classification.stages } : {}),
    limitations: classification.limitations,
    ...(classification.reason ? { reason: classification.reason } : {}),
    evidence: classification.evidence,
    consumers: [],
    blockedBy: classification.blockedBy ?? [],
    blocks: classification.blocks ?? [],
    lastVerified: classification.lastVerified ?? { revision, date: verificationDate },
  }
}

function classify(entry: CapabilityInventoryEntry): Classification {
  switch (entry.ownerHint.package) {
    case "@zavx0z/dom": return classifyDomHtml(entry)
    case "@zavx0z/renderer": return classifyCssRenderer(entry)
    case "@zavx0z/renderer-browser": return classifyBrowser(entry)
    case "@zavx0z/renderer-webgpu": return classifyWebgpu(entry)
    case "@zavx0z/react": return classifyReact(entry)
    case "@zavx0z/dom-devtools": return classifyDevtools(entry)
    case "@zavx0z/template": return classifyTemplate(entry)
    case "@engine/core": return classifyEngine(entry)
    default: throw new Error(`Unknown owner package for ${entry.id}: ${entry.ownerHint.package}`)
  }
}

function classifyDomHtml(entry: CapabilityInventoryEntry): Classification {
  if (entry.id.includes("vector-path-element") || entry.name === "HTMLVectorPathElement") {
    return rendererPathWorkingTree({
      ...implemented("extension", [
      implementation(
        "renderer",
        entry.kind === "package-export-path"
          ? "packages/dom/package.json"
          : "packages/dom/src/html-vector-path-element.ts",
        entry.name,
        undefined,
        "The exact VectorPath semantic class, coordinate-bound constant or package subpath is publicly owned by @zavx0z/dom.",
        "Path parsing, paint, hit testing, SVG namespaces or complete SVG behavior.",
      ),
      test("renderer", "packages/dom/test/html-vector-path-element.test.ts", entry.name, "Exact class/subpath identity, reflected d mutation and shared coordinate bound.", "Renderer/WebGPU behavior or SVG conformance."),
      ]),
      limitations: domVectorPathLimitations,
    })
  }
  if (["DocumentTextControlSelection", "TextControlSelectionTarget"].includes(entry.name)) {
    return recovered(implemented("extension", [
      implementation("renderer", "packages/dom/src/document.ts", entry.name, undefined, "The exported type describes the exact active text-control selection adapter without a second range store.", "Standard DOM Selection/Range, contenteditable and ordinary Text-node selection."),
      test("renderer", "packages/dom/test/text-selection.test.ts", "active text-control selection snapshot", "Exact target, offsets, direction, collapsed state, text and immutable snapshots.", "Standard DOM Selection/Range and multi-range semantics."),
    ]))
  }
  if (entry.name === "getPopoverSource" && entry.id.includes("popover-state")) {
    return recovered(implemented("extension", [
      implementation("renderer", "packages/dom/src/popover-state.ts", "getPopoverSource", undefined, "The opaque renderer adapter exposes only the exact retained source identity while a popover is showing.", "Geometry, z-order, implicit invoker discovery or accessibility projection."),
      test("renderer", "packages/dom/test/popover.test.ts", "retained popover source", "Source identity persists through showing and clears on close.", "Geometry and implicit invoker discovery."),
    ]))
  }
  if (entry.id === "platform.at-zavx0z-dom.export-paths.state-change.symbols.selectpickerstatechange") {
    return recovered(implemented("extension", [
      implementation("renderer", "packages/dom/src/state-change.ts", "SelectPickerStateChange", undefined, "The public discriminated state record carries exact Select identity and open old/new values.", "Complete select/form/accessibility behavior."),
      test("renderer", "packages/dom/test/select-picker.test.ts", "select picker state records", "Open, owner transfer, close, blur and removal publish observable state through the Document channel.", "Multiple/listbox and native accessibility projection."),
    ]))
  }
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, domExportStatus(entry))
  if (entry.domain === "dom") return classifyDom(entry)
  return classifyHtml(entry)
}

function classifyDom(entry: CapabilityInventoryEntry): Classification {
  if (entry.id === "dom.project.vector-path-element") {
    return rendererPathWorkingTree({
      ...implemented("extension", [
      implementation("renderer", "packages/dom/src/html-vector-path-element.ts", "HTMLVectorPathElement", undefined, "One exact semantic project-extension Element reflects d through the ordinary attribute mutation owner.", "SVGPathElement, SVG namespaces, parsing, paint or GPU behavior."),
      test("renderer", "packages/dom/test/html-vector-path-element.test.ts", "HTMLVectorPathElement", "Exact constructor/tag/subpath identity and reflected mutation behavior.", "SVG or downstream rendering behavior."),
      ]),
      limitations: domVectorPathLimitations,
    })
  }
  if (entry.id === "dom.algorithms.selection") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/document.ts", "readTextControlSelection", undefined, "Document derives one immutable snapshot from the canonical active Input/TextArea offsets and direction.", "Standard Selection/Range, ordinary Text nodes, contenteditable, multi-range and general mutation adjustment."),
        implementation("renderer", "packages/core/src/interaction.ts", "textarea pointer selection default", undefined, "Renderer metrics map pointer drag into the same semantic textarea offsets without component coordinates.", "Soft wrap, bidi, grapheme and ordinary DOM selection."),
        test("renderer", "packages/dom/test/text-selection.test.ts", "active text-control selection snapshot", "Snapshot identity, offsets, direction, collapsed state and selected text.", "Standard Selection/Range and ordinary DOM Text selection."),
        test("renderer", "packages/core/test/interaction.test.ts", "textarea pointer selection", "Pointer drag updates one forward semantic range and select events through exact render metrics.", "Soft wrap, bidi, grapheme and multi-range selection."),
      ],
      "Active Input/TextArea selection, immutable snapshots and bounded pre/wrap-off pointer mapping are implemented; standard DOM Selection/Range, contenteditable, ordinary Text-node, multi-range and general mutation-adjusted selection remain unsupported.",
    ))
  }
  if (entry.id === "dom.algorithms.pointer-capture") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/pointer-capture.ts", "pending pointer capture override", undefined, "Per-Document active/pending/effective capture ownership and got/lost ordering.", "Implicit touch capture, trusted native generation and the complete Pointer Events device model."),
        test("renderer", "packages/dom/test/pointer-capture.test.ts", "Element pointer capture", "Pending override processing, transfer, explicit/implicit release, inactive-id errors and disconnect cleanup.", "Implicit touch capture and live native devices."),
        test("renderer", "packages/core/test/interaction.test.ts", "semantic pointer-capture retargeting", "Move/up remain targeted at the exact captured Element outside its hit box.", "Native browser trusted-event execution."),
      ],
      "Explicit semantic capture, pending overrides and got/lost ordering are implemented; implicit touch capture and the complete native Pointer Events device model remain outside this bounded host.",
    ))
  }
  if (
    entry.id.startsWith("dom.extensions.pointerevents.interfaces.element.methods.") &&
    ["hasPointerCapture", "releasePointerCapture", "setPointerCapture"].includes(entry.name)
  ) {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/element.ts", entry.name, undefined, "The standard Element method delegates to the exact Document pointer-capture owner.", "Implicit touch capture and trusted native event provenance."),
        test("renderer", "packages/dom/test/pointer-capture.test.ts", entry.name, "Method errors, pending ownership, transfer and release are observed through exact Element identity.", "Every native device and implicit-capture branch."),
      ],
      "The explicit Element method contract is behaviorally proven; implicit touch capture and live native browser provenance remain outside this evidence.",
    ))
  }
  const coreImplementedAlgorithms = new Set([
    "dom.algorithms.one-semantic-tree",
    "dom.algorithms.event-listener-registration",
    "dom.algorithms.event-dispatch-path",
    "dom.algorithms.event-capture-phase",
    "dom.algorithms.event-target-phase",
    "dom.algorithms.event-bubble-phase",
    "dom.algorithms.event-cancellation",
    "dom.algorithms.event-propagation-stop",
    "dom.algorithms.tree-pre-insertion-validity",
    "dom.algorithms.tree-insert",
    "dom.algorithms.document-fragment-splicing",
    "dom.algorithms.tree-remove",
    "dom.algorithms.tree-replace",
    "dom.algorithms.node-adoption",
    "dom.algorithms.node-connected-state",
    "dom.algorithms.text-content",
  ])
  if (coreImplementedAlgorithms.has(entry.id)) {
    return implemented(
      "exact",
      [domImplementation(entry), test("renderer", "packages/dom/test/tree.test.ts", "DOM tree and identity tests", "Tree mutation, adoption, connected state, and exact node identity.", "Unlisted DOM algorithms."), test("renderer", "packages/dom/test/event.test.ts", "event dispatch suite", "Capture/target/bubble, cancellation, propagation, and default-action ordering.", "Browser trusted-event integration.")],
    )
  }

  const partialAlgorithms = new Set([
    "dom.algorithms.interface-object-construction",
    "dom.algorithms.parent-node-mixins",
    "dom.algorithms.child-node-mixins",
    "dom.algorithms.attribute-storage",
    "dom.algorithms.selectors",
    "dom.algorithms.focus",
  ])
  if (partialAlgorithms.has(entry.id)) {
    return partial("adapted", [domImplementation(entry), test("renderer", "packages/dom/test/tree.test.ts", "bounded DOM behavior", "The implemented subset has observable behavior tests.", "The full referenced algorithm.")], "The runtime implements a bounded subset and intentionally omits remaining standard branches.")
  }

  if (entry.id.startsWith("dom.algorithms.")) return unsupported(entry, "The accepted semantic DOM architecture has no implementation for this observable algorithm in the current checkout.")

  const id = entry.id
  if (id.startsWith("dom.interfaces.eventtarget")) {
    return implemented("exact", [implementation("renderer", "packages/dom/src/event-target.ts", "EventTarget", "33-143", "Listener identity/options and synchronous dispatch.", "Trusted native event generation."), test("renderer", "packages/dom/test/event.test.ts", "EventTarget behavioral tests", "Capture, target, bubble, once, passive, cancellation, and propagation.", "Browser default actions outside the DOM owner.")])
  }
  if (
    id === "dom.mixins.parentnode.methods.queryselector" ||
    id === "dom.mixins.parentnode.methods.queryselectorall"
  ) {
    return reviewedCurrent(partial(
      "adapted",
      [
        externalEvidence(entry),
        implementation("renderer", "packages/dom/src/selectors.ts", "queryFirst/queryAll", undefined, "Document, DocumentFragment and Element expose the standard ParentNode query methods through one bounded selector matcher and exact semantic descendants.", "The complete Selectors grammar, namespaces, Shadow DOM, live collections or native browser equivalence."),
        test("renderer", "packages/dom/test/selectors.test.ts", entry.name, "Document, Element and DocumentFragment queries prove scope, descendant/child compounds, static ordered NodeList results, mutation refresh and exact error rejection for unsupported grammar.", "The complete Selectors grammar, namespaces, Shadow DOM or native browser behavior."),
      ],
      "The ParentNode query methods are implemented over the bounded tag/id/class/attribute/descendant/child selector subset; namespaces, Shadow DOM and the complete Selectors grammar remain unsupported.",
    ))
  }
  const eventLeafPresence = reviewedEventLeafPresence(entry)
  if (eventLeafPresence === "absent") {
    return reviewedLeafAbsent(entry, "The current Event implementation does not expose this standard member; an interface-level implementation cannot prove a missing leaf.")
  }
  if (eventLeafPresence === "present" || id.startsWith("dom.interfaces.event")) {
    return {
      ...partial("adapted", [implementation("renderer", "packages/dom/src/event.ts", "Event", "9-80", "Event state, cancellation, phases, and propagation controls.", "High-resolution timestamp and every legacy field."), test("renderer", "packages/dom/test/event.test.ts", "Event behavioral tests", "Core observable dispatch state and cancellation.", "All legacy and browser-trusted semantics.")], "Event.timeStamp uses Date.now and the complete legacy/composed surface is not behaviorally proven."),
      lastVerified: domLeafVerification,
    }
  }
  if (id.startsWith("dom.interfaces.node")) return classifyNodeMember(entry)
  if (id.startsWith("dom.interfaces.documentfragment")) return partialDomClass(entry, "packages/dom/src/document-fragment.ts", "DocumentFragment", "packages/dom/test/tree.test.ts")
  if (id.startsWith("dom.interfaces.document")) return classifyDocumentMember(entry)
  if (id.startsWith("dom.interfaces.element")) return classifyElementMember(entry)
  if (id.startsWith("dom.interfaces.characterdata") || id.startsWith("dom.interfaces.text") || id.startsWith("dom.interfaces.comment")) {
    return partialDomClass(entry, "packages/dom/src/character-data.ts", "CharacterData/Text/Comment", "packages/dom/test/tree.test.ts")
  }
  if (/dom\.extensions\.(uievents|pointerevents|input-events).*\.(interfaces|mixins)\.(uievent|mouseevent|pointerevent|wheelevent|focusevent|inputevent|keyboardevent|compositionevent)/.test(id)) {
    return partial("adapted", [implementation("renderer", eventSourcePath(entry), entry.name, undefined, "Bounded event interface implementation.", "All browser initialization and trusted-event semantics."), test("renderer", "packages/dom/test/input.test.ts", "input event hierarchy tests", "Current event constructor and property behavior.", "Native browser dispatch.")], "The event object hierarchy is implemented, while browser-owned trusted dispatch and the complete standard member set remain outside this evidence.")
  }
  if (id === "dom.events.gotpointercapture" || id === "dom.events.lostpointercapture") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/pointer-capture.ts", entry.name, undefined, "Pending override processing dispatches the exact capture transition event in standard lost-before-got order.", "Trusted native provenance and implicit touch capture."),
        test("renderer", "packages/dom/test/pointer-capture.test.ts", entry.name, "Transfer, explicit release and implicit pointer-end ordering are observed.", "Live native devices and implicit capture."),
      ],
      "Semantic transition dispatch and ordering are proven; trusted native provenance and implicit touch capture remain outside this bounded host.",
    ))
  }
  if (id.startsWith("dom.events.")) {
    const supported = new Set(["click", "input", "beforeinput", "change", "focus", "blur", "focusin", "focusout", "keydown", "keyup", "compositionstart", "compositionupdate", "compositionend", "pointerdown", "pointermove", "pointerup", "pointercancel", "wheel"])
    if (supported.has(entry.name)) return partial("adapted", [implementation("renderer", "packages/dom/src/event-target.ts", "dispatchEvent", undefined, "Semantic dispatch for the event type.", "Browser trust and every default action."), test("renderer", "packages/dom/test/input.test.ts", entry.name, "Bounded semantic event behavior.", "Complete browser-host event generation.")], "Only the platform's bounded semantic dispatch and owner default actions are implemented.")
  }
  return unsupported(entry, "No current runtime implementation and behavioral test were found for this pinned DOM member.")
}

function classifyNodeMember(entry: CapabilityInventoryEntry): Classification {
  const supportedNames = new Set([
    "Node", "Node inherits EventTarget", "nodeType", "nodeName", "nodeValue", "textContent", "isConnected", "ownerDocument",
    "parentNode", "parentElement", "firstChild", "lastChild", "previousSibling", "nextSibling", "appendChild", "insertBefore",
    "removeChild", "replaceChild", "contains", "getRootNode", "hasChildNodes", "isSameNode",
  ])
  if (supportedNames.has(entry.name) || entry.kind === "const") {
    return implemented("exact", [implementation("renderer", "packages/dom/src/node.ts", entry.name, "19-284", "Observable node identity, tree links, and bounded mutation API.", "Unlisted Node methods."), test("renderer", "packages/dom/test/tree.test.ts", entry.name, "Tree identity and mutation behavior.", "Namespaces, cloning, normalization, and position comparison.")])
  }
  if (entry.name === "childNodes") return partial("adapted", [implementation("renderer", "packages/dom/src/node.ts", "childNodes", undefined, "Readonly child snapshot values.", "Live NodeList identity."), test("renderer", "packages/dom/test/tree.test.ts", "childNodes", "Current snapshot content.", "Live collection semantics.")], "Returns a fresh readonly Array rather than a live NodeList.")
  return unsupported(entry, "The current Node implementation has no behaviorally proven implementation of this standard member.")
}

function classifyDocumentMember(entry: CapabilityInventoryEntry): Classification {
  const supported = new Set(["Document", "Document inherits Node", "documentElement", "createElement", "createTextNode", "createComment", "createDocumentFragment", "adoptNode"])
  if (supported.has(entry.name)) {
    return implemented("exact", [implementation("renderer", "packages/dom/src/document.ts", entry.name, "66-259", "Document factories, exact ownership, and mutation/state channels.", "Full HTML parsing and browsing context."), test("renderer", "packages/dom/test/tree.test.ts", entry.name, "Factory identity and cross-document adoption.", "Unsupported factories and parsing.")])
  }
  return unsupported(entry, "Document does not expose this standard factory, namespace, traversal, Range, or metadata member in the current bounded runtime.")
}

function classifyElementMember(entry: CapabilityInventoryEntry): Classification {
  if (["hasPointerCapture", "releasePointerCapture", "setPointerCapture"].includes(entry.name)) {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/element.ts", entry.name, undefined, "The standard Element method delegates to the exact Document pointer-capture owner.", "Implicit touch capture and trusted native event provenance."),
        test("renderer", "packages/dom/test/pointer-capture.test.ts", entry.name, "Method errors, pending ownership, transfer and release are observed through exact Element identity.", "Every native device and implicit-capture branch."),
      ],
      "The explicit Element method contract is behaviorally proven; implicit touch capture and live native browser provenance remain outside this evidence.",
    ))
  }
  const exact = new Set(["Element", "Element inherits Node", "localName", "tagName", "id", "className", "classList", "getAttribute", "getAttributeNames", "hasAttribute", "hasAttributes", "setAttribute", "removeAttribute", "toggleAttribute", "matches", "closest"])
  if (exact.has(entry.name)) {
    return partial("adapted", [implementation("renderer", "packages/dom/src/element.ts", entry.name, "19-184", "String attributes, tag identity, class token list, and bounded selectors.", "Attr-node identity, namespaces, and the complete selector grammar."), test("renderer", "packages/dom/test/selectors.test.ts", entry.name, "Current attribute and selector behavior.", "Unimplemented namespace and Attr object semantics.")], "String-backed attributes and the bounded selector grammar differ from the complete Attr/namespace/Selectors contracts.")
  }
  return unsupported(entry, "This Element member requires Attr objects, namespaces, Shadow DOM, custom elements, or selector forms absent from the current runtime.")
}

function partialDomClass(
  entry: CapabilityInventoryEntry,
  sourcePath: string,
  symbol: string,
  testPath: string,
): Classification {
  return partial(
    "adapted",
    [
      implementation("renderer", sourcePath, symbol, undefined, "The bounded semantic node class and identity behavior.", "The complete standard interface member set."),
      test("renderer", testPath, entry.name, "Current construction, identity, mutation, and text behavior.", "Every standard member and algorithm."),
    ],
    "The class is part of the one semantic tree, while unsupported standard members remain absent.",
  )
}

function classifyHtml(entry: CapabilityInventoryEntry): Classification {
  if (isHtmlNotApplicable(entry)) return notApplicable(entry, htmlNotApplicableReason(entry))

  if (
    entry.id === "html.mixins.htmlorsvgormathmlelement.attributes.tabindex" ||
    entry.id === "html.reflections.htmlorsvgormathmlelement.tabindex"
  ) {
    return reviewedCurrent(partial(
      "adapted",
      [
        externalEvidence(entry),
        implementation("renderer", "packages/dom/src/html-element.ts", "HTMLElement.tabIndex", undefined, "The semantic HTMLElement reflects tabindex through HTML integer parsing and Web IDL long coercion while preserving per-control default tab indices.", "Complete sequential focus navigation, SVG/MathML hosts, autofocus, and every browser reflection edge."),
        test("renderer", "packages/dom/test/input.test.ts", "tabIndex reflection and focusability", "Content/property reflection, default indices, explicit -1 focusability, removal fallback, hidden suppression and connected focus behavior are observable.", "Complete sequential keyboard navigation, SVG/MathML or native browser equivalence."),
      ],
      "Bounded HTML tabIndex reflection and practical programmatic focusability are implemented; complete sequential navigation, autofocus, SVG/MathML hosts, and every browser coercion/default remain unsupported.",
    ))
  }
  if (entry.id === "html.mixins.htmlorsvgormathmlelement.methods.focus") {
    return reviewedCurrent(partial(
      "adapted",
      [
        externalEvidence(entry),
        implementation("renderer", "packages/dom/src/html-element.ts", "HTMLElement.focus/blur", undefined, "Programmatic focus/blur updates the exact same-Document active owner and preserves node/listener identity.", "preventScroll/focusVisible option behavior, complete sequential navigation, SVG/MathML hosts or trusted native focus provenance."),
        test("renderer", "packages/dom/test/input.test.ts", "programmatic focusability", "Connected focusable controls, explicit tabindex, hidden suppression and blur behavior are observable through exact activeElement identity and focus events.", "Native browser focus rings, sequential navigation, SVG/MathML or every FocusOptions branch."),
        test("renderer", "packages/dom/test/focus-state-change.test.ts", "focus state changes", "Focus and focus-within state transitions publish in exact Document transactions.", "Browser paint, accessibility or native focus provenance."),
      ],
      "Bounded same-Document programmatic focus/blur is implemented; FocusOptions behavior, sequential navigation, SVG/MathML, accessibility and native browser provenance remain unsupported.",
    ))
  }
  if (entry.id === "html.events.focus") {
    return reviewedCurrent(partial(
      "adapted",
      [
        externalEvidence(entry),
        implementation("renderer", "packages/dom/src/document.ts", "changeFocus focus dispatch", undefined, "Changing the exact active semantic owner dispatches non-bubbling focus with the reviewed same-Document ordering.", "Trusted native provenance, complete sequential navigation, accessibility or every browser focus default."),
        test("renderer", "packages/dom/test/input.test.ts", "focus event ordering", "Programmatic focus produces the exact blur/focusout/focus/focusin ordering, capture behavior and activeElement identity for connected focusable controls.", "Native trusted focus, accessibility, sequential navigation or browser pixels."),
      ],
      "Bounded same-Document focus dispatch and ordering are implemented; trusted native provenance, complete navigation/accessibility and browser integration remain unsupported.",
    ))
  }
  if (entry.id === "html.interfaces.toggleevent.attributes.newstate") {
    return reviewedCurrent(partial(
      "adapted",
      [
        externalEvidence(entry),
        implementation("renderer", "packages/dom/src/toggle-event.ts", "ToggleEvent.newState", undefined, "The standard readonly newState value is normalized at construction and retained on semantic beforetoggle/toggle events.", "Every future ToggleEvent extension or native trusted event provenance."),
        test("renderer", "packages/dom/test/popover.test.ts", "ToggleEvent newState", "Constructor defaults/explicit values plus popover open/close/coalesced toggle sequences expose the exact newState values.", "Native browser provenance or unrelated ToggleEvent extensions."),
      ],
      "The standard newState value is implemented for semantic ToggleEvent and popover sequencing; native trusted provenance and complete browser integration remain unsupported.",
    ))
  }

  if (entry.id.startsWith("html.elements.")) return classifyHtmlElement(entry)
  if (entry.id.startsWith("html.attributes.")) return classifyHtmlAttribute(entry)
  if (entry.id.startsWith("html.behaviors.")) return classifyHtmlBehavior(entry)
  if (entry.id.startsWith("html.events.")) {
    const supported = new Set(["beforetoggle", "toggle", "change", "input", "beforeinput", "click"])
    if (supported.has(entry.name)) return partial("adapted", [domImplementation(entry), test("renderer", "packages/dom/test/event.test.ts", entry.name, "Current semantic event and owner default action subset.", "All HTML trusted/default actions.")], "Only the bounded DOM/owner behavior is implemented.")
    return unsupported(entry, "The event exists in HTML but has no semantic producer/default action in this platform.")
  }
  if (entry.id.startsWith("html.interfaces.") || entry.id.startsWith("html.reflections.")) return classifyHtmlIdl(entry)
  return unsupported(entry, "No current HTML semantic implementation and behavioral test were found for this capability.")
}

function classifyHtmlElement(entry: CapabilityInventoryEntry): Classification {
  const parts = entry.id.split(".")
  const tag = parts[2] ?? ""
  const specialized = new Set(["div", "span", "button", "input", "img", "label", "li", "meter", "option", "p", "progress", "select", "table", "td", "th", "tr", "tbody", "thead", "tfoot", "textarea", "ul", "fieldset", "legend", "h1", "h2", "h3", "h4", "h5", "h6"])
  if (entry.kind === "element-attribute") {
    return partial("adapted", [implementation("renderer", "packages/dom/src/element.ts", "setAttribute/getAttribute", undefined, "Generic string content-attribute storage.", "Attribute-specific reflection and behavior."), test("renderer", "packages/dom/test/tree.test.ts", entry.name, "Generic content-attribute mutation.", "The attribute's complete HTML algorithm.")], "The content attribute is stored, but attribute-specific reflection/default behavior is implemented only for selected controls.")
  }
  if (entry.kind === "accessibility-semantics") return unsupported(entry, "The semantic DOM does not expose an accessibility tree or HTML-AAM mapping owner.")
  if (entry.kind === "content-model" || entry.kind === "content-categories") return unsupported(entry, "DOM mutation does not enforce HTML parser content models or category constraints.")
  if (entry.kind === "interface-mapping") {
    if (entry.metadata?.interface === "HTMLElement") {
      return reviewedCurrent(partial(
        "adapted",
        [
          externalEvidence(entry),
          implementation("renderer", "packages/dom/src/document.ts", "createElement generic HTMLElement fallback", undefined, "Tags whose standard interface is exactly HTMLElement retain their lower-case tag identity on the exact generic HTMLElement prototype.", "Tags requiring a specialized interface, parser insertion modes, default actions or accessibility semantics."),
          test("renderer", "packages/dom/test/structural-elements.test.ts", `${tag} HTMLElement mapping`, "The exact UI-used HTMLElement-only tag set is constructed on HTMLElement.prototype with preserved localName identity.", "Specialized interfaces, parser behavior, default actions or accessibility projection."),
        ],
        "The standard HTMLElement prototype mapping is implemented; tag-specific parser behavior, default actions, content models and accessibility semantics remain outside this row.",
      ))
    }
    return specialized.has(tag)
      ? partial("adapted", [implementation("renderer", "packages/dom/src/document.ts", "HTML_ELEMENT_FACTORIES", "66-96", "Exact specialized constructor mapping for the supported tag subset.", "The complete per-element interface surface."), test("renderer", "packages/dom/test/structural-elements.test.ts", tag, "Current prototype mapping.", "Complete element algorithms.")], "The constructor mapping exists while the full interface behavior does not.")
      : unsupported(entry, "The tag is created as a generic HTMLElement or is outside the bounded platform, not as its specified specialized interface.")
  }
  if (entry.kind === "activation-behavior") return partial("adapted", [implementation("renderer", "packages/dom/src/html-element.ts", "activation hooks", undefined, "Bounded focus/click/control activation hooks.", "Form submission, navigation, media, and other tag-specific default actions."), test("renderer", "packages/dom/test/event.test.ts", "activation behavior", "Current checkbox/radio and subclass hook behavior.", "Complete tag-specific default action.")], "Only checkbox/radio and bounded button/control hooks have owner behavior.")
  return partial("adapted", [implementation("renderer", "packages/dom/src/document.ts", "createElement", "98-159", "Stable semantic element identity for the standard tag name.", "The tag's complete HTML contract."), test("renderer", "packages/dom/test/structural-elements.test.ts", tag, "Current element construction/prototype subset.", "Complete default behavior and accessibility semantics.")], specialized.has(tag) ? "A specialized class exists but implements only the bounded UI subset." : "A generic HTMLElement preserves tag identity but not the specialized HTML interface or behavior.")
}

function classifyHtmlAttribute(entry: CapabilityInventoryEntry): Classification {
  if (entry.id === "html.attributes.hidden") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/html-element.ts", "HTMLElement.hidden", undefined, "Boolean presence reflection and hidden-ancestor focus suppression use the exact semantic attribute owner.", "Until-found, beforematch, find-in-page and accessibility behavior."),
        test("renderer", "packages/dom/test/tree.test.ts", "HTMLElement.hidden", "Presence reflection and descendant focus suppression.", "Until-found, beforematch, find-in-page and accessibility behavior."),
        test("renderer", "packages/core/test/renderer.test.ts", "hidden author-display precedence", "A hidden subtree stays absent from boxes, paint and hits despite author and inline display.", "Until-found reveal and accessibility projection."),
      ],
      "Boolean hidden presence and fully-hidden rendering/focus are implemented; until-found, beforematch, find-in-page reveal and accessibility projection remain unsupported.",
    ))
  }
  const implemented = new Set(["id", "class", "title", "tabindex", "hidden", "popover", "disabled", "checked", "value", "type", "selected", "src", "alt", "width", "height"])
  if (implemented.has(entry.name.toLowerCase())) {
    return partial("adapted", [implementation("renderer", "packages/dom/src/element.ts", entry.name, undefined, "Content-attribute storage and selected reflected state.", "The full attribute-specific HTML algorithm."), test("renderer", "packages/dom/test/html-input-element.test.ts", entry.name, "Bounded reflected/control behavior.", "All elements and attribute modes.")], "The platform implements selected reflection/live-state branches, not the complete attribute contract on every applicable element.")
  }
  return partial("adapted", [implementation("renderer", "packages/dom/src/element.ts", "setAttribute/getAttribute", undefined, "Generic string content-attribute storage.", "Attribute-specific reflection or default behavior."), test("renderer", "packages/dom/test/tree.test.ts", "attribute storage", "Generic attribute mutation.", `Specific semantics for ${entry.name}.`)], "Stored as a generic content attribute; no attribute-specific algorithm was found.")
}

function classifyHtmlBehavior(entry: CapabilityInventoryEntry): Classification {
  if (entry.id === "html.behaviors.clipboard") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/browser/src/native-input-host.ts", "mirrored native copy default", undefined, "Exact active text-control value/selection remains on the native proxy; semantic copy cancellation gates its plain-text platform default.", "ClipboardEvent/DataTransfer, cut, paste, async Clipboard API, HTML payload and permissions."),
        test("renderer", "packages/browser/test/native-input-host.test.ts", "readonly text-control copy", "Selected substring copy and semantic cancellation through the exact mirrored textarea.", "Live OS clipboard contents, cut/paste, DataTransfer and permissions."),
      ],
      "Plain-text copy for the exact mirrored active Input/TextArea selection is implemented with semantic cancellation; ClipboardEvent/DataTransfer, cut, paste, async Clipboard API, HTML payloads and permissions remain unsupported.",
    ))
  }
  if (entry.id === "html.behaviors.popover") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/internal/popover.ts", "source, light dismiss, Escape and focus return", undefined, "Showing state retains exact source/focus owners; Auto stacks apply target-related light dismiss and topmost Escape closure.", "Hint stacks, implicit invokers, autofocus, accessibility and complete HTML popover behavior."),
        implementation("renderer", "packages/core/src/renderer.ts", "anchored popover top layer", undefined, "Renderer derives transformed source bounds, flips/clamps an explicit-source popover and applies one viewport clip without ancestor overflow.", "Arbitrary CSS Anchor Positioning grammar and popover-root transforms."),
        implementation("renderer", "packages/browser/src/native-input-host.ts", "generic Escape keyboard owner", undefined, "A read-only native keyboard proxy routes cancellable Escape from any focused semantic HTMLElement to the Document Auto-popover default.", "Live native browser pixels and complete keyboard navigation."),
        test("renderer", "packages/dom/test/popover.test.ts", "popover source/dismiss/focus", "Exact source lifetime, related-target light dismiss, topmost Escape, Manual preservation and focus return.", "Hint/implicit invoker/accessibility behavior."),
        test("renderer", "packages/core/test/popover-paint.test.ts", "anchored viewport top layer", "Transformed source placement, flip, clamp, viewport clip and ancestor-overflow escape.", "Arbitrary CSS Anchor Positioning and popover-root transforms."),
        test("renderer", "packages/browser/test/native-input-host.test.ts", "cancellable popover Escape", "Generic focused owner, cancellation, close and focus restoration through the browser host.", "Live native browser execution."),
      ],
      "Explicit-source Auto popovers have anchored/clamped top-layer paint, viewport clipping, light dismiss, cancellable Escape and focus restoration; Hint, implicit invokers, autofocus, arbitrary CSS Anchor Positioning and accessibility remain unsupported.",
    ))
  }
  if (entry.id === "html.behaviors.hidden") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/core/src/css.ts", "hidden used display", undefined, "Any present semantic hidden attribute forces used display:none after author cascade.", "Until-found, beforematch, find-in-page and accessibility behavior."),
        implementation("renderer", "packages/dom/src/html-element.ts", "HTMLElement.hidden", undefined, "The semantic boolean reflection and ancestor focus law share the content attribute.", "Until-found and accessibility projection."),
        test("renderer", "packages/core/test/renderer.test.ts", "HTML hidden projection", "Author/compiled/inline display cannot reveal boxes, paint or hits; removal restores rendering.", "Until-found reveal and accessibility projection."),
        test("renderer", "packages/dom/test/tree.test.ts", "hidden focusability", "Hidden owners and descendants do not become the active element.", "Sequential navigation and accessibility projection."),
      ],
      "The fully-hidden state is behaviorally enforced; hidden=until-found, beforematch, find-in-page reveal, containment and accessibility projection remain unsupported.",
    ))
  }
  if (entry.id === "html.behaviors.input-type-range") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/html-input-element.ts", "applyRangeKeyboardDefault", undefined, "Arrow/Home/End/Page defaults write through the DOM range value owner and emit input/change only on effective changes.", "Vertical orientation, ticks, datalist, validity and public stepUp/stepDown."),
        implementation("renderer", "packages/core/src/interaction.ts", "range pointer default action", undefined, "Pointer drag uses the rendered track geometry and DOM numeric semantics without consumer coordinates.", "Vertical orientation, touch-specific implicit capture and every browser range behavior."),
        test("renderer", "packages/dom/test/input-numeric-state.test.ts", "range keyboard defaults", "Keyboard stepping, clamping and event order.", "Live native browser keys and omitted range modes."),
        test("renderer", "packages/core/test/range-input.test.ts", "range pointer drag", "Pointer geometry, min/max/step ownership and input/change order.", "Vertical/tick/datalist behavior."),
      ],
      "Horizontal pointer drag and bounded keyboard defaults are implemented; vertical orientation, ticks, datalist, validity, public stepUp/stepDown and complete browser range behavior remain unsupported.",
    ))
  }
  if (entry.id === "html.behaviors.input-type-checkbox") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/html-input-element.ts", "checkbox activation", undefined, "Checked state, cancellation rollback and input/change ordering remain owned by the semantic Checkbox.", "Forms, validation, accessibility and every browser default action."),
        implementation("renderer", "packages/core/src/renderer.ts", "checkbox UA check glyph", undefined, "A checked Checkbox projects one stable current-color check glyph while Radio retains its circular Rect indicator.", "Indeterminate Checkbox chrome, native font pixels and accessibility projection."),
        test("renderer", "packages/dom/test/input-activation.test.ts", "HTMLInputElement checkbox activation", "Checked-state activation, cancellation and event order.", "Forms, validation and native trusted activation."),
        test("renderer", "packages/core/test/input-paint.test.ts", "checkbox and radio projection", "Unchecked absence, checked check-mark identity, Radio dot distinction and disabled opacity/hit behavior.", "Indeterminate chrome and live native font pixels."),
      ],
      "Checkbox live state, activation and a bounded checked check glyph are implemented; indeterminate chrome, forms, validation, accessibility and complete native browser behavior remain unsupported.",
    ))
  }
  if (entry.id === "html.behaviors.select-option-optgroup") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/dom/src/select-picker-state.ts", "collapsed select picker state", undefined, "One Document-owned picker, keyboard selection and exact Option choice/event ordering.", "Multiple/listbox, optgroup, type-ahead and complete forms/accessibility semantics."),
        implementation("renderer", "packages/core/src/renderer.ts", "collapsed select disclosure indicator", undefined, "Every collapsed Select reserves a bounded label-safe slot for one stable current-color disclosure glyph.", "Multiple/listbox, author-custom picker chrome and native accessibility projection."),
        test("renderer", "packages/dom/test/select-picker.test.ts", "collapsed select picker state", "Open/close, keyboard, exact option selection, input/change, blur and removal cleanup.", "Multiple/listbox, optgroup and native accessibility projection."),
        test("renderer", "packages/core/test/select-paint.test.ts", "collapsed select disclosure indicator", "Stable indicator identity across selection, empty-label presence, author sizing/color and disabled opacity.", "Native font pixels, multiple/listbox and accessibility projection."),
      ],
      "Collapsed single-select live state, disclosure chrome, picker ownership and bounded keyboard/pointer choice are implemented; multiple/listbox, optgroup, type-ahead, forms and accessibility projection remain unsupported.",
    ))
  }
  const partialIds = new Set([
    "html.behaviors.attribute-property-reflection",
    "html.behaviors.live-state-vs-content-attributes",
    "html.behaviors.default-actions",
    "html.behaviors.activation-behavior",
    "html.behaviors.disabledness",
    "html.behaviors.focusability",
    "html.behaviors.hidden",
    "html.behaviors.label-association",
    "html.behaviors.input-type-text",
    "html.behaviors.input-type-search",
    "html.behaviors.input-type-tel",
    "html.behaviors.input-type-url",
    "html.behaviors.input-type-password",
    "html.behaviors.input-type-number",
    "html.behaviors.input-type-range",
    "html.behaviors.input-type-checkbox",
    "html.behaviors.input-type-radio",
    "html.behaviors.input-type-button",
    "html.behaviors.input-type-reset",
    "html.behaviors.input-type-submit",
    "html.behaviors.input-selection",
    "html.behaviors.textarea",
    "html.behaviors.select-option-optgroup",
    "html.behaviors.button",
    "html.behaviors.progress-meter",
    "html.behaviors.images",
    "html.behaviors.popover",
  ])
  if (partialIds.has(entry.id)) {
    return partial("adapted", [domImplementation(entry), test("renderer", controlTestPath(entry.id), entry.name, "The bounded UI/control slice has behavioral tests.", "The complete HTML algorithm, forms, picker, or browser integration.")], "Only the bounded WebGPU UI subset is implemented; unsupported modes remain explicit or fail closed.")
  }
  return unsupported(entry, "The current semantic DOM has no implementation of this HTML algorithm.")
}

function classifyHtmlIdl(entry: CapabilityInventoryEntry): Classification {
  const inputLeafPresence = reviewedHtmlInputLeafPresence(entry)
  if (inputLeafPresence === "absent") {
    return reviewedLeafAbsent(entry, "The current HTMLInputElement implementation does not expose this standard member; an interface-level implementation cannot prove a missing leaf.")
  }
  if (inputLeafPresence === "present") {
    return {
      ...partial("adapted", [domImplementation(entry), htmlInputLeafTest(entry)], "The interface/member is present only where the bounded control implementation supplies behavior; complete forms, validation, picker, resource, and collection semantics are absent."),
      lastVerified: domLeafVerification,
    }
  }
  const supportedInterfaces = [
    "htmlelement", "htmlbuttonelement", "htmlimageelement", "htmllabelelement", "htmlfieldsetelement",
    "htmllegendelement", "htmlmeterelement", "htmloptionelement", "htmlprogresselement", "htmlselectelement", "htmltextareaelement",
    "htmltableelement", "htmltablerowelement", "htmltablecellelement", "htmltablesectionelement", "htmldivelement", "htmlspanelement",
    "htmlheadingelement", "htmlparagraphelement", "htmllielement", "htmlulistelement",
  ]
  const normalized = entry.id.toLowerCase()
  if (supportedInterfaces.some((name) => normalized.includes(`.${name}`))) {
    return partial("adapted", [domImplementation(entry), test("renderer", "packages/dom/test/html-input-element.test.ts", entry.name, "The current specialized element and live-state subset.", "Every member/value/default action in the HTML interface.")], "The interface/member is present only where the bounded control implementation supplies behavior; complete forms, validation, picker, resource, and collection semantics are absent.")
  }
  return unsupported(entry, "The standard HTML IDL member is not implemented by the current semantic DOM.")
}

function classifyCssRenderer(entry: CapabilityInventoryEntry): Classification {
  if ([
    "PathDisplayItem",
    "RenderPathBounds",
    "RenderPathCubic",
    "RenderPathGeometry",
    "RenderPathPoint",
    "RenderPathSegment",
  ].includes(entry.name)) {
    return rendererPathWorkingTree(classifyPublicExport(entry, "implemented"))
  }
  if (entry.id === "platform.at-zavx0z-renderer.export-paths.root.symbols.rendertextmeasurer") {
    const classification = classifyPublicExport(entry, "partial")
    return {
      ...classification,
      evidence: classification.evidence.map((record) => ({
        ...record,
        revision: textAdvanceVerification.revision,
      })),
      lastVerified: textAdvanceVerification,
    }
  }
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, rendererExportStatus(entry))
  if (entry.domain === "css") return classifyCss(entry)
  return classifyRenderer(entry)
}

function classifyCss(entry: CapabilityInventoryEntry): Classification {
  const defaultStages = cssDefaultStages()
  const external = externalEvidence(entry)
  if (entry.kind === "property") {
    if (entry.id === "css.properties.stroke" || entry.id === "css.properties.stroke-width") {
      return rendererPathWorkingTree(partial(
        "adapted",
        [
          external,
          implementation("renderer", "packages/core/src/css.ts", "ComputedStyle stroke transport", undefined, "The bounded VectorPath owner resolves inherited currentColor/color stroke and finite non-negative px stroke width before display projection.", "The complete SVG paint/length grammar, percentages, URLs, context paint, animation or every SVG shape."),
          test("renderer", "packages/core/test/vector-path.test.ts", entry.name, "Resolved stroke color/width reach one PathDisplayItem and the exact hit geometry.", "Full SVG/CSS Fill and Stroke conformance."),
          test("renderer", "packages/webgpu/test/vector-path.test.ts", entry.name, "Resolved stroke values pack into retained Engine style records with one-record updates.", "Every paint server, join/cap, fill, dash or native SVG pixel."),
        ],
        "Implemented only for solid resolved color and finite non-negative px values on the project VectorPath extension; complete SVG paint/length grammar, percentages, URLs, context paint, animation, fill, dash and arbitrary joins/caps remain unsupported.",
        {
          parse: "partial",
          cascade: "partial",
          computed: "partial",
          layout: "not-applicable",
          paint: "partial",
          "hit-test": "partial",
          webgpu: "partial",
          browser: "partial",
          evidence: "implemented",
        },
      ))
    }
    if (computedColorPropertyIds.has(entry.id)) {
      return {
        status: "partial",
        conformance: "adapted",
        limitations: [
          "The computed/display transport is bounded to currentColor, transparent, hex, legacy comma and modern space/slash rgb()/rgba(), plus the sixteen basic named colors normalized to hex. Direct malformed colors are discarded before cascade priority and malformed variable substitutions use invalid-at-computed-value-time inherited/initial behavior. Extended named colors, system colors, other color functions/spaces, relative colors, interpolation and color management remain unsupported.",
        ],
        evidence: [
          external,
          {
            ...implementation("renderer", "packages/core/src/css.ts", "normalizeSpecifiedColor/resolvedColor", undefined, "The computed style owner validates and canonicalizes every admitted text, background and border color before display projection.", "The unsupported CSS Color grammar, interpolation, color management or native browser equivalence."),
            revision: computedColorVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/computed-color.test.ts", "computed color transport", "Basic named-color normalization, direct invalid-declaration fallback and variable invalid-at-computed-value-time behavior are observable in computed styles and display items.", "The unsupported CSS Color grammar or native browser equivalence."),
            revision: computedColorVerification.revision,
          },
          {
            type: "integration-test",
            repository: "renderer",
            revision: computedColorVerification.revision,
            path: "packages/webgpu/test/webgpu-backend.test.ts",
            symbol: "receives only canonical colors from the computed CSS pipeline",
            proves: "An exact semantic Document and CPU Renderer normalize a named color, omit a malformed variable-derived color and apply the resulting frame through the retained WebGPU backend without a late color failure.",
            doesNotProve: "Live browser pixels, the unsupported CSS Color grammar or consumer-specific visual acceptance.",
          },
        ],
        stages: cssPropertyStages(entry.name),
        lastVerified: computedColorVerification,
      }
    }
    if (entry.id === "css.properties.align-content") {
      return {
        status: "partial",
        conformance: "adapted",
        limitations: [
          "Bounded to normal, stretch, flex-start, flex-end, center, space-between, space-around, and space-evenly on the existing row/column wrap and wrap-reverse Flex subset. normal behaves as stretch; nowrap ignores the property; an unconstrained auto cross size uses the natural line stack while a larger parent-assigned used cross size is honored; the direction-mapped cross gap remains mandatory before free-space distribution; explicit negative free space preserves unsafe flex-end/center offsets and uses cross-start fallbacks for the admitted distribution values. start/end, baseline alignment, author-specified safe/unsafe syntax, writing modes, CSS-wide keywords, animation, reverse main axes, gap decorations/rules, order, align-self, and complete intrinsic multi-line sizing remain unsupported.",
        ],
        evidence: [
          external,
          {
            ...implementation("renderer", "packages/core/src/css.ts", "ComputedStyle.alignContent/parseAlignContent", undefined, "The computed-style stage admits the bounded keyword set, keeps normal as the initial value, substitutes variables, and discards invalid declarations before cascade priority.", "start/end, baseline, safe/unsafe syntax, writing modes, CSS-wide keywords, animation, and the complete Box Alignment grammar."),
            revision: alignContentVerification.revision,
          },
          {
            ...implementation("renderer", "packages/core/src/renderer.ts", "alignFlexLines/placeFlexChildren", undefined, "The CPU layout stage distributes positive and negative cross free space for row and column wrapped lines, applies normal as stretch, honors one-line wrapped containers, ignores nowrap, and reverses cross-start/cross-end for wrap-reverse line and item alignment.", "The excluded alignment values, gap decorations/rules, reverse main axes, and complete intrinsic multi-line Flexbox sizing."),
            revision: alignContentVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/align-content.test.ts", "align-content", "Observable computed values and frame boxes prove keyword validation, variable substitution, invalid-declaration fallback, positive and negative cross-space distribution, row/column symmetry, one-line wrapping, nowrap exclusion, auto and parent-allocated cross sizes, stretch interaction, and wrap-reverse cross-start semantics.", "Native browser pixels, writing modes, excluded values, and full CSS Box Alignment or Flexbox conformance."),
            revision: alignContentVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/gap.test.ts", "align-content with split cross gaps", "Direction-mapped cross gaps remain mandatory before stretch or positional free-space distribution in row and column wrapped containers.", "Gap decorations/rules, percentage gaps, writing modes, or full Box Alignment conformance."),
            revision: flexGapVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/position.test.ts", "absolute flex static position under wrap-reverse", "An absolutely positioned flex child derives its static cross position from the same reversed cross-start semantics without entering flex line formation.", "Every absolute-positioned Flexbox static-position algorithm or native browser behavior."),
            revision: alignContentVerification.revision,
          },
          {
            type: "integration-test",
            repository: "storybook",
            revision: storybookAlignContentRevision,
            path: "src/external/browser/aggregate-presentation.test.tsx",
            symbol: "external Storybook aggregate cross-axis packing",
            proves: "The compiled aggregate owner explicitly requests flex-start cross-axis packing, preserves same-Document child roots, and keeps two 280px cards on the first row plus the next card exactly 8px below despite remaining cross space.",
            doesNotProve: "Live WebGPU pixels, every aggregate route, wrap-reverse, excluded alignment values, or full CSS conformance.",
          },
          {
            type: "visual-evidence",
            repository: "external",
            revision: "8395147bf85fa6e09532d94d",
            path: "storybook://captures/capture_bcLDBIKxFG9Wf6ezQb7fYkKW",
            symbol: "@ui/components/components/inputs",
            proves: "The exact ready/presented inputs overview renders sixteen real owner roots in compact cross-start rows with 280 by 180 tiles, 8px mandatory gaps, one visible canvas, and empty diagnostics and console output.",
            doesNotProve: "Positive free-space distribution at this viewport, other align-content values, wrap-reverse, excluded grammar, or native browser equivalence.",
          },
        ],
        stages: {
          parse: "partial",
          cascade: "partial",
          computed: "partial",
          layout: "partial",
          paint: "not-applicable",
          "hit-test": "not-applicable",
          webgpu: "not-applicable",
          browser: "not-applicable",
          evidence: "implemented",
        },
        lastVerified: flexGapVerification,
      }
    }
    if (entry.id === "css.properties.align-items") {
      return {
        status: "partial",
        conformance: "adapted",
        limitations: [
          "Bounded to stretch, flex-start, center, and flex-end in the existing row/column Flex subset, including logical cross-start/cross-end under wrap-reverse. baseline, start/end, self-start/self-end, author-specified safe/unsafe syntax, writing modes, align-self, reverse main axes, order, and complete Flexbox alignment remain unsupported.",
        ],
        evidence: [
          external,
          {
            ...implementation("renderer", "packages/core/src/css.ts", "ComputedStyle.alignItems/parseAlignItems", undefined, "The computed-style stage admits the bounded align-items keyword set with stretch as the initial value.", "The complete Box Alignment grammar, writing modes, baseline alignment, overflow-position syntax, and animation."),
            revision: alignContentVerification.revision,
          },
          {
            ...implementation("renderer", "packages/core/src/renderer.ts", "alignCrossPosition/placeFlexChildren", undefined, "The CPU layout stage aligns fixed and auto-cross flex items inside single or multiple lines and swaps logical cross-start/cross-end under wrap-reverse.", "align-self, baseline alignment, writing modes, reverse main axes, or complete Flexbox alignment."),
            revision: alignContentVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/renderer.test.ts", "production CSS box and flex slice", "Observable frames prove bounded stretch, flex-start, center, and flex-end behavior in ordinary row and column Flex layout.", "Multi-line wrap-reverse behavior and full Box Alignment conformance."),
            revision: alignContentVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/align-content.test.ts", "wrap-reverse align-items cross-start", "Fixed and auto-cross items use the reversed logical cross axis inside stretched and positioned wrapped lines.", "Writing modes, excluded values, align-self, or native browser equivalence."),
            revision: alignContentVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/position.test.ts", "absolute flex static position under wrap-reverse", "The absolute-flex static-position path uses the same reversed align-items cross-start and physical margins.", "Every positioned Flexbox algorithm or native browser behavior."),
            revision: alignContentVerification.revision,
          },
        ],
        stages: cssPropertyStages(entry.name),
        lastVerified: alignContentVerification,
      }
    }
    if (
      entry.id === "css.properties.gap" ||
      entry.id === "css.properties.row-gap" ||
      entry.id === "css.properties.column-gap"
    ) {
      return classifyFlexGapProperty(entry, external)
    }
    if (entry.id === "css.properties.line-height") {
      return {
        status: "partial",
        conformance: "adapted",
        limitations: [
          "The admitted normal, finite non-negative number, px, percentage and compatible calc() subset now transports exact resolved line-box height through CPU paint and positions one backend-resolved TTF on its alphabetic baseline. Font-family selection, fallback, shaping, kerning, bidi, vertical writing, CSS-wide keywords, animation and complete browser typography remain unsupported.",
        ],
        evidence: [
          external,
          {
            ...implementation("renderer", "packages/core/src/css.ts", "parseLineHeight/resolveLineHeight", undefined, "The bounded cascade preserves unitless inheritance and resolves admitted line-height values to finite non-negative line-box heights.", "The complete CSS grammar, font selection, shaping or browser-exact typography."),
            revision: textAdvanceVerification.revision,
          },
          {
            ...implementation("renderer", "packages/core/src/renderer.ts", "TextDisplayItem.lineHeight", undefined, "Every ordinary, control, textarea and renderer-owned text fragment transports resolved line height with y as the line-box top.", "Backend font selection, glyph geometry or GPU pixels."),
            revision: textBaselineVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/typography.test.ts", "inherited line-height and letter-spacing", "Observable frames prove unitless inheritance, absolute values, multiline placement and lineHeight transport on stable text fragments.", "Font shaping, fallback, bidi, vertical writing or complete CSS Inline conformance."),
            revision: textBaselineVerification.revision,
          },
          {
            ...test("renderer", "packages/webgpu/test/webgpu-backend.test.ts", "alphabetic baseline from the line box", "Exact TTF ascent/descent metrics position the alphabetic baseline, and a line-height-only update preserves CachedText and both geometries.", "Other fonts, shaping, fallback or every live device."),
            revision: textBaselineVerification.revision,
          },
          {
            type: "visual-evidence",
            repository: "external",
            revision: "cf68da24a7f5d70053f480d3",
            path: "storybook://captures/capture_KPaxDthim-pACzG87gJloyan",
            symbol: "@zavx0z/dom/elements/primitives/status-bar/content/statistics",
            proves: "The exact ready/presented DOM route renders the 11px Cyrillic navigation label with its descender inside the unchanged 22px control on one visible canvas and with zero console errors.",
            doesNotProve: "Every font, size, line-height, script, viewport or complete native-browser typography equivalence.",
          },
        ],
        stages: cssPropertyStages(entry.name),
        lastVerified: textBaselineVerification,
      }
    }
    if (entry.id === "css.properties.flex-wrap") {
      return {
        status: "partial",
        conformance: "adapted",
        limitations: [
          "Bounded to nowrap, wrap, and wrap-reverse on the existing row/column Flex subset: row wrapping uses its definite or auto-fill width, column wrapping requires a definite height, and direction-mapped main/cross gaps participate in line formation and stacking. balance and other invalid values are discarded before cascade priority, while gap decorations/rules, flex-flow, row-reverse/column-reverse, order, align-self, and complete intrinsic multi-line sizing remain unsupported.",
        ],
        evidence: [
          external,
          {
            ...implementation("renderer", "packages/core/src/css.ts", "ComputedStyle.flexWrap/parseFlexWrap", undefined, "The computed-style stage admits nowrap, wrap, and wrap-reverse with nowrap as the initial value.", "The balance value, CSS-wide keywords, animation, CSSOM serialization, and complete Flexbox grammar."),
            revision: flexWrapVerification.revision,
          },
          {
            ...implementation("renderer", "packages/core/src/renderer.ts", "createFlexLines/placeFlexChildren", undefined, "The CPU layout stage forms bounded row or column flex lines, distributes main-axis flex sizing per line, and reverses the cross-axis line order for wrap-reverse.", "Gap decorations/rules, reverse main axes, order/align-self, or complete intrinsic multi-line Flexbox sizing."),
            revision: flexWrapVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/flex-wrap.test.ts", "flex-wrap", "Observable computed values and frame boxes prove keyword validation, variable substitution, invalid-declaration cascade fallback, nowrap, definite-width row wrapping with auto cross growth, per-line grow/shrink/justification/alignment, definite-height column wrapping, auto-height non-wrapping, scalar gap, oversized-base line isolation, and wrap-reverse cross-end packing.", "Full CSS Flexbox conformance, native browser pixels, or the unsupported values and properties named in the limitation."),
            revision: flexWrapVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/gap.test.ts", "split gaps with flex-wrap", "Row and column wrapping use their direction-mapped main gap for line formation and cross gap for line stacking, auto/intrinsic sizes, and align-content interaction.", "Gap decorations/rules, percentage gaps, reverse main axes, or full Flexbox conformance."),
            revision: flexGapVerification.revision,
          },
          {
            type: "integration-test",
            repository: "storybook",
            revision: storybookAggregateRevision,
            path: "src/external/browser/aggregate-presentation.test.tsx",
            symbol: "external Storybook aggregate presentation",
            proves: "The compiled Storybook owner uses row plus flex-wrap without coordinate packing, preserves real same-Document child roots, places two 280px cards on the first 600px row and the next card on a later row with an 8px gap, and lets a single child fill the grid content box.",
            doesNotProve: "Live WebGPU pixels, every aggregate route, wrap-reverse, or full CSS Flexbox conformance.",
          },
          {
            type: "visual-evidence",
            repository: "external",
            revision: "ea7420f0ec07391c7de62088",
            path: "storybook://captures/capture_uzjbdZD1PD3ANOAZMYubPIZR",
            symbol: "@ui/components/components/inputs",
            proves: "The exact ready/presented UI inputs overview renders sixteen real owner roots as three 280px columns with 8px gaps on one visible canvas, with empty diagnostics and console output.",
            doesNotProve: "Every viewport size, wrap-reverse, unsupported Flexbox properties, or native browser equivalence.",
          },
        ],
        stages: {
          parse: "partial",
          cascade: "partial",
          computed: "partial",
          layout: "partial",
          paint: "not-applicable",
          "hit-test": "not-applicable",
          webgpu: "not-applicable",
          browser: "not-applicable",
          evidence: "implemented",
        },
        lastVerified: flexGapVerification,
      }
    }
    if (supportedCssProperties.has(entry.name)) {
      const stages = cssPropertyStages(entry.name)
      return partial("adapted", [external, implementation("renderer", "packages/core/src/css.ts", entry.name, "280-738", "The bounded parser/cascade/computed value stage for this property.", "The complete grammar/value space and all downstream stages."), test("renderer", cssTestPath(entry.name), entry.name, "Observable bounded layout/paint behavior.", "Every standard value and combination.")], cssPropertyLimitation(entry.name), stages)
    }
    return {
      status: "unsupported",
      conformance: "none",
      limitations: ["The declaration tokenizer can retain this unknown property/value, but computed style and every observable downstream stage ignore it."],
      evidence: [external, implementation("renderer", "packages/core/src/css.ts", "parseDeclarations/computeStyle", "573-738", "Unknown declarations can enter the cascade map.", "Computed, layout, paint, hit-test, or backend support for this property.")],
      stages: defaultStages,
    }
  }
  if (entry.kind === "selector") {
    if (entry.id === "css.selectors.pseudo-class-root") {
      return partial(
        "adapted",
        [
          external,
          implementation("renderer", "packages/core/src/css.ts", ":root", undefined, "Matches only the exact semantic Document.documentElement through the bounded selector pipeline.", "Shadow roots, scoped roots and the complete selector grammar."),
          test("renderer", "packages/core/test/author-style-sheet.test.ts", ":root", "Semantic documentElement matching and inherited theme variables.", "Native browser or Shadow DOM conformance."),
        ],
        "Implemented for the one semantic Document root; Shadow DOM and the remaining selector grammar are absent.",
        {...defaultStages, parse: "partial", cascade: "partial", computed: "not-applicable", layout: "not-applicable", paint: "not-applicable", "hit-test": "not-applicable", webgpu: "not-applicable", browser: "partial"},
      )
    }
    const supported = supportedSelectors.has(entry.name)
    return supported
      ? partial("adapted", [external, implementation("renderer", "packages/core/src/css.ts", "parseSelector/matchesSelector", "981-1180", "Bounded selector parsing/matching.", "The complete selector grammar and composed tree."), test("renderer", "packages/core/test/native-pseudo-style.test.ts", entry.name, "Current selector matching.", "Every grammar/namespace/pseudo branch.")], "Implemented only in the flat compound/child/descendant selector subset.", { ...defaultStages, parse: "partial", cascade: "partial", computed: "not-applicable", layout: "not-applicable", paint: "not-applicable", "hit-test": "not-applicable", webgpu: "not-applicable", browser: "partial" })
      : { status: "unsupported", conformance: "none", limitations: ["Selector grammar is not admitted by the bounded parser."], evidence: [external], stages: defaultStages }
  }
  if (entry.id === "css.functions.var-function") {
    return {
      ...partial(
        "adapted",
        [
          external,
          implementation("renderer", "packages/core/src/css.ts", "CustomPropertyResolver/substituteVariables", undefined, "Case-sensitive inherited custom-property environments and cycle-aware var() substitution for admitted longhands, one border/shadow path and nested color/calc functions.", "The complete CSS Variables grammar, typed properties, animation and every variable-bearing shorthand."),
          test("renderer", "packages/core/test/custom-properties.test.ts", "var()", "Nested fallback, cycles, casing, pseudo overrides, inline precedence, foundation/semantic/component aliases, focused border colors, rgb alpha, calc and one thousand instance values.", "Escaped names, every declaration grammar and full browser conformance."),
          test("renderer", "packages/react/test/compiler.test.ts", "compiled custom-property pseudo", "Exact authored TSX executes through Template metadata, React adoption and CPU hover substitution with one shared pseudo sheet.", "Live browser/WebGPU pixels and unrelated Template syntax."),
          {
            ...implementation("renderer", "packages/core/src/css.ts", "resolveCascadedVariables/expandGap", undefined, "A winning variable-bearing gap shorthand expands at its original specificity and source sequence, while missing or computed-invalid values invalidate both affected longhands without exposing lower-priority declarations.", "Other variable-bearing multi-value shorthands or full CSS Variables invalid-at-computed-value-time behavior."),
            revision: flexGapVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/gap.test.ts", "variable-bearing gap", "Valid one/two-value variables, longhand overrides, specificity preservation, missing variables and computed-invalid shorthand/longhand winners are observable through exact computed row/column gaps.", "Other shorthands, escaped names, @property, animation, or full browser conformance."),
            revision: flexGapVerification.revision,
          },
        ],
        "Implemented for admitted longhands, one solid border/border-color, one shadow, the one/two-value gap shorthand, and current background/color/sizing/transform/calc paths; other multi-value shorthands, escaped names, @property and animation remain unsupported.",
        cssVariableStages(defaultStages),
      ),
      lastVerified: flexGapVerification,
    }
  }
  if (entry.id === "css.functions.calc-function") {
    return partial(
      "adapted",
      [
        external,
        implementation("renderer", "packages/core/src/css.ts", "CalculationParser", undefined, "Finite arithmetic with one compatible px, percent or resolved em dimension for admitted properties.", "Mixed-unit linear combinations, math constants, min/max/clamp and complete CSS typed arithmetic."),
        test("renderer", "packages/core/test/custom-properties.test.ts", "bounded calc()", "Variable-backed multiplication/division, font-size, line-height, gap and explicit unsupported cases.", "Complete CSS Values conformance and every property context."),
      ],
      "Bounded to finite arithmetic producing one compatible number/px/percent/resolved-em result; mixed-unit sums and adjacent CSS math functions remain unsupported.",
      cssVariableStages(defaultStages),
    )
  }
  if (entry.kind === "function" && supportedCssFunctions.has(entry.name)) {
    return partial("adapted", [external, implementation("renderer", "packages/core/src/css.ts", entry.name, undefined, "Bounded value parsing.", "All function syntax and contexts."), test("renderer", "packages/core/test/transform.test.ts", entry.name, "Current bounded parsing.", "Full CSS Values conformance.")], "Only the values admitted by current color/transform parsing are implemented.", defaultStages)
  }
  if (entry.id === "css.types.attribute-selector") {
    return reviewedCurrent(partial(
      "adapted",
      [
        external,
        implementation("renderer", "packages/core/src/css.ts", "parseCompoundSelector/matchesCompound", undefined, "The bounded selector owner parses presence and exact-value attribute selectors and matches them against the exact semantic Element attribute owner.", "Attribute operators beyond =, flags, namespaces, escaped names/values, case modifiers, or the complete Selectors grammar."),
        test("renderer", "packages/core/test/native-pseudo-style.test.ts", "[data-role=\"action\"]", "An exact-value attribute selector participates in compound native-pseudo matching and changes the observable computed/paint style only for the matching semantic Element.", "Every attribute selector operator, flag, namespace, escape, or full browser conformance."),
      ],
      "Bounded to unescaped attribute presence and exact-value matching; ~=, |=, ^=, $=, *=, case-sensitivity flags, namespaces, escapes, and the complete Selectors grammar remain unsupported.",
      {
        ...defaultStages,
        parse: "partial",
        cascade: "partial",
        computed: "not-applicable",
        layout: "not-applicable",
        paint: "not-applicable",
        "hit-test": "not-applicable",
        webgpu: "not-applicable",
        browser: "partial",
        evidence: "implemented",
      },
    ))
  }
  if (entry.kind === "data-type" && supportedCssTypes.has(entry.name)) {
    return partial("adapted", [external, implementation("renderer", "packages/core/src/css.ts", entry.name, undefined, "Bounded value parsing.", "The full data type grammar."), test("renderer", "packages/core/test/renderer.test.ts", entry.name, "Current bounded values.", "Full value space and interpolation semantics.")], "Only px/unitless/percentage and bounded color/number branches used by current properties are accepted.", defaultStages)
  }
  if (entry.id.startsWith("css.features.")) return classifyCssFeature(entry, defaultStages)
  if (entry.id.startsWith("css.cssom.")) return unsupported(entry, "The CPU renderer owns internal style data only; it does not expose the CSSOM interface in this pinned IDL row.", defaultStages)
  return { status: "unsupported", conformance: "none", limitations: ["No implementation of this pinned CSS feature was found."], evidence: [external], stages: defaultStages }
}

function classifyFlexGapProperty(
  entry: CapabilityInventoryEntry,
  external: EvidenceRecord,
): Classification {
  const shorthand = entry.id === "css.properties.gap"
  const axis = entry.id === "css.properties.row-gap" ? "row" : "column"
  const contract = shorthand
    ? "The shorthand accepts one value for both axes or two values in row/column order and expands through ordinary declaration source order."
    : `The ${axis}-gap longhand participates in ordinary shorthand/longhand source order and maps to the Flex main or cross axis according to flex-direction.`
  const invalidComputed = shorthand
    ? "an invalid winning variable-bearing shorthand invalidates both longhands at computed-value time without revealing a lower-priority declaration"
    : `an invalid winning variable-bearing ${axis}-gap resets that longhand to its initial used value without revealing a lower-priority declaration`
  return {
    status: "partial",
    conformance: "adapted",
    limitations: [
      `${contract} Flex used values are bounded to normal as zero and finite non-negative px, unitless, resolved em, or compatible calc() results. Direct invalid declarations are discarded before cascade priority; ${invalidComputed}. Negative values, percentages, mixed dimensions, CSS-wide keywords, animation, Grid/multicol gap semantics, and gap decorations/rules remain unsupported.`,
    ],
    evidence: [
      external,
      {
        ...implementation("renderer", "packages/core/src/css.ts", shorthand ? "DeclarationEntry/expandGap/parseGapValue" : "ComputedStyle.rowGap/columnGap/parseGapValue", undefined, "The declaration and computed-style stages preserve repeated source order, expand one/two-value gap shorthand, retain longhand priority, resolve normal and bounded dimensions, defer variable-bearing shorthand expansion, and fail invalid computed winners closed.", "Percentages, CSS-wide keywords, animation, Grid/multicol gap computation, escaped declaration grammar, or full CSS Variables conformance."),
        revision: flexGapVerification.revision,
      },
      {
        ...implementation("renderer", "packages/core/src/renderer.ts", "flexMainGap/flexCrossGap", undefined, "The CPU Flex stage maps column-gap to a row main axis and row-gap to a column main axis, maps the other longhand to wrapped line stacking, and carries both through measurement, placement, intrinsic sizing, and align-content.", "Grid/multicol layout, gap decorations/rules, percentage gaps, writing modes, or reverse main axes."),
        revision: flexGapVerification.revision,
      },
      {
        ...test("renderer", "packages/core/test/gap.test.ts", shorthand ? "gap shorthand" : entry.name, "Observable computed values and frame boxes prove one/two-value transport, normal, dimensional validation, direct and variable invalid semantics, exact shorthand/longhand source order, row/column axis mapping, rendered-item counting, wrapping, intrinsic sizing, and align-content interaction.", "Grid/multicol gaps, percentage gaps, decorations/rules, writing modes, reverse main axes, or full CSS conformance."),
        revision: flexGapVerification.revision,
      },
    ],
    stages: cssPropertyStages(entry.name),
    lastVerified: flexGapVerification,
  }
}

function classifyCssFeature(entry: CapabilityInventoryEntry, stages: Record<string, CapabilityStatus>): Classification {
  const partial = new Set([
    "syntax", "tokenization", "declarations", "component-values", "data-types", "functions", "units", "selectors", "combinators",
    "pseudo-classes", "specificity", "cascade", "cascade-order", "inheritance", "longhands", "shorthands", "logical-properties",
    "box-model", "sizing", "block-layout", "inline-layout", "flex-layout", "positioning", "overflow", "scrolling", "scrollbars",
    "clipping", "stacking-contexts", "z-index", "transforms", "transform-origins", "colors", "backgrounds", "borders", "radii",
    "shadows", "opacity", "images", "replaced-content", "object-fit", "fonts", "text", "white-space", "wrapping", "line-breaking",
    "text-overflow", "computed-values", "used-values", "display-list-projection", "hit-test-projection", "webgpu-transport",
  ])
  const suffix = entry.id.slice("css.features.".length)
  if (suffix === "declarations") {
    return {
      status: "partial",
      conformance: "adapted",
      limitations: [
        "The bounded flat declaration parser preserves every repeated declaration in authored source order, normalizes admitted property names, and fails invalid admitted values closed before or at the documented computed-value boundary. !important, declaration comments/escapes, CSS-wide keywords, full token-stream preservation, and arbitrary delimiter-bearing value grammar remain unsupported.",
      ],
      evidence: [
        externalEvidence(entry),
        {
          ...implementation("renderer", "packages/core/src/css.ts", "DeclarationEntry/parseDeclarations/applyDeclarations", undefined, "Flat style rules and inline styles retain repeated declarations as ordered entries instead of collapsing them into an object map before shorthand expansion and cascade sequencing.", "The complete CSS declaration grammar, !important, escaped delimiters, comments, or CSSOM serialization."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/gap.test.ts", "repeated declarations", "Repeated shorthand and longhand declarations in inline and stylesheet blocks resolve in exact source order, while invalid direct declarations cannot replace valid lower-priority values.", "Every property grammar, !important, cascade layers, or native CSS parser equivalence."),
          revision: flexGapVerification.revision,
        },
      ],
      stages: {
        parse: "partial",
        cascade: "partial",
        computed: "partial",
        layout: "not-applicable",
        paint: "not-applicable",
        "hit-test": "not-applicable",
        webgpu: "not-applicable",
        browser: "not-applicable",
        evidence: "implemented",
      },
      lastVerified: flexGapVerification,
    }
  }
  if (suffix === "cascade-order") {
    return {
      status: "partial",
      conformance: "adapted",
      limitations: [
        "The bounded cascade preserves specificity, owner stylesheet order, repeated declaration source sequence, shorthand/longhand expansion order, deferred variable shorthand priority, and inline precedence. User origins, !important, cascade layers, scopes, revert/revert-layer/unset, animations/transitions, and the complete CSS cascade remain unsupported.",
      ],
      evidence: [
        externalEvidence(entry),
        {
          ...implementation("renderer", "packages/core/src/css.ts", "applyDeclarations/comparePriority/resolveCascadedVariables", undefined, "Specificity, stylesheet order and per-declaration sequence determine winners; deferred variable shorthand expansion retains the original priority and invalid computed winners invalidate only targets they still own.", "User and important origins, cascade layers/scopes, CSS-wide rollback keywords, animations, or the complete cascade algorithm."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/author-style-sheet.test.ts", "author/compiled/consumer/inline precedence", "Document author themes, compiled owner sheets, explicit consumer sheets and inline declarations preserve the bounded owner order.", "User origins, !important, layers/scopes, animation or native browser conformance."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/gap.test.ts", "shorthand/longhand source order", "Repeated direct and variable-bearing gap shorthand/longhand declarations preserve exact sequence and specificity, including computed-invalid winner semantics.", "Every shorthand, CSS-wide keyword, layer/scope, or complete cascade conformance."),
          revision: flexGapVerification.revision,
        },
      ],
      stages: {
        parse: "partial",
        cascade: "partial",
        computed: "partial",
        layout: "not-applicable",
        paint: "not-applicable",
        "hit-test": "not-applicable",
        webgpu: "not-applicable",
        browser: "not-applicable",
        evidence: "implemented",
      },
      lastVerified: flexGapVerification,
    }
  }
  if (suffix === "custom-properties") {
    return {
      ...partialClassification(
        "adapted",
        [
          externalEvidence(entry),
          implementation("renderer", "packages/core/src/css.ts", "ComputedCustomProperties", undefined, "Ordinary case-sensitive custom-property cascade, sparse inheritance and cycle-aware substitution through admitted border, shadow, color and dimensional function paths.", "Full CSS Variables, CSSOM, typed custom properties and animation."),
          test("renderer", "packages/core/test/custom-properties.test.ts", suffix, "Inheritance identity, aliases, fallback/cycles, casing, pseudo changes, border/shadow, rgb/calc, descendant invalidation, consumer precedence and one thousand instances.", "Every grammar and native browser behavior."),
          test("renderer", "packages/react/test/compiler.test.ts", "exact dynamic pseudo authoring", "One shared compiled pseudo sheet consumes two instance-specific inline custom values and updates while hovered.", "Live browser/WebGPU pixels."),
          {
            ...implementation("renderer", "packages/core/src/css.ts", "resolveCascadedVariables/expandGap", undefined, "Variable substitution admits the bounded one/two-value gap shorthand with original cascade priority and invalid-at-computed-value-time reset of both longhands.", "Other multi-value shorthands, escaped names, @property, animation, or full CSS Variables semantics."),
            revision: flexGapVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/gap.test.ts", "custom-property gap shorthand", "Valid, missing, negative, percentage and specificity-sensitive variable values prove the bounded gap shorthand path and its longhand interactions.", "Other multi-value shorthands or full browser conformance."),
            revision: flexGapVerification.revision,
          },
        ],
        "Bounded to unescaped custom names and var() in admitted longhands, one border/border-color, one shadow, the one/two-value gap shorthand, and background/color/sizing/transform/calc paths; CSS-wide semantics, !important, @property, animation and other multi-value shorthands remain unsupported.",
        cssVariableStages(stages),
      ),
      lastVerified: flexGapVerification,
    }
  }
  if (suffix === "flex-layout") {
    return {
      status: "partial",
      conformance: "adapted",
      limitations: [
        "The bounded CPU owner supports row/column single-line Flex, nowrap/wrap/wrap-reverse line formation, per-line grow/shrink/justification/align-items, admitted align-content cross-axis distribution, wrap-reverse cross-start semantics, and direction-mapped independent row/column gaps through measurement, intrinsic sizing and placement. balance, reverse main axes, flex-flow, order, align-self, gap decorations/rules, percentage gaps, writing modes, and complete intrinsic multi-line Flexbox sizing remain unsupported.",
      ],
      evidence: [
        externalEvidence(entry),
        {
          type: "requirement",
          repository: "renderer",
          revision: flexGapVerification.revision,
          path: "packages/core/requirements.md",
          symbol: "RENDERER-CPU-004",
          proves: "The owner contract defines the bounded single-line and multi-line Flex semantics, admitted alignment values, and explicit exclusions.",
          doesNotProve: "Runtime behavior or full CSS Flexbox and Box Alignment conformance.",
        },
        {
          ...implementation("renderer", "packages/core/src/css.ts", "ComputedStyle Flex properties", undefined, "The computed-style stage transports admitted Flex sizing, direction, wrapping, alignment, and independent row/column gap used values with ordered shorthand/longhand cascade semantics.", "The complete Flexbox, Box Alignment and CSS Gaps grammars, CSSOM, animation, percentage gaps, or writing modes."),
          revision: flexGapVerification.revision,
        },
        {
          ...implementation("renderer", "packages/core/src/renderer.ts", "createFlexLines/alignFlexLines/flexMainGap/flexCrossGap/placeFlexChildren", undefined, "The CPU owner forms row or column lines, resolves per-line main-axis Flex sizing, maps independent main/cross gaps through measurement and intrinsic sizing, distributes cross-axis free space after mandatory gaps, and places children with wrap-reverse semantics.", "Reverse main axes, order/align-self, gap decorations/rules, percentage gaps, or complete intrinsic Flexbox sizing."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/renderer.test.ts", "production CSS box and flex slice", "Observable frames prove the bounded single-line grow/shrink/justification/alignment and one-value gap compatibility contract.", "Multi-line behavior and full Flexbox conformance."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/flex-wrap.test.ts", "flex-wrap", "Observable frame boxes prove row/column line formation, per-line sizing, definite-boundary handling, scalar gaps, and wrap-reverse line stacking.", "Full Flexbox conformance or the explicitly excluded values."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/align-content.test.ts", "align-content", "Observable computed values and frame boxes prove the admitted cross-axis line alignment and distribution contract for rows, columns, auto/definite sizes, positive/negative free space, and wrap-reverse.", "Native browser pixels, writing modes, excluded values, or full conformance."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/gap.test.ts", "two-axis Flex gaps", "Observable computed values and frames prove shorthand/longhand cascade, bounded dimensions, row/column axis mapping, rendered-item counting, wrapping, intrinsic sizes, and align-content interaction.", "Grid/multicol gaps, percentage gaps, decorations/rules, reverse main axes, or full conformance."),
          revision: flexGapVerification.revision,
        },
        {
          type: "integration-test",
          repository: "storybook",
          revision: storybookAlignContentRevision,
          path: "src/external/browser/aggregate-presentation.test.tsx",
          symbol: "external Storybook aggregate presentation",
          proves: "A real compiled consumer uses row wrapping plus explicit cross-start line packing and validates resulting CPU geometry without coordinate authoring.",
          doesNotProve: "Live WebGPU pixels, every route, reverse main axes, or complete Flexbox conformance.",
        },
      ],
      stages: {
        parse: "partial",
        cascade: "partial",
        computed: "partial",
        layout: "partial",
        paint: "not-applicable",
        "hit-test": "not-applicable",
        webgpu: "not-applicable",
        browser: "not-applicable",
        evidence: "implemented",
      },
      lastVerified: flexGapVerification,
    }
  }
  if (partial.has(suffix)) return partialClassification("adapted", [externalEvidence(entry), implementation("renderer", "packages/core/src/css.ts", entry.name, undefined, "Bounded CSS stage implementation.", "Complete CSS module algorithms."), test("renderer", "packages/core/test/renderer.test.ts", entry.name, "Current bounded behavior.", "Full conformance.")], "Only the explicitly admitted values/algorithms are implemented.", stages)
  return { status: "unsupported", conformance: "none", limitations: ["The current stylesheet/cascade/layout pipeline does not implement this CSS module capability."], evidence: [externalEvidence(entry)], stages }
}

function classifyRenderer(entry: CapabilityInventoryEntry): Classification {
  if (!entry.id.startsWith("renderer.features.")) return unsupported(entry, "No current CPU renderer evidence was mapped.")
  const name = entry.id.slice("renderer.features.".length)
  if (name === "vector-path-display-item") {
    return rendererPathWorkingTree({
      ...implemented("extension", [
      implementation("renderer", "packages/core/src/path.ts", "parseRenderPath", undefined, "Bounded absolute M/L/Q/C parsing normalizes and samples one immutable open stroked path with explicit source/token/cubic limits.", "Complete SVG path grammar, fill, close, arcs or adaptive tessellation."),
      implementation("renderer", "packages/core/src/renderer.ts", "emitVectorPath/presentationTransforms", undefined, "One semantic VectorPath emits one retained Path item and exact path hit while shared transform owners avoid per-Path transform replacement.", "Complete SVG layout/paint or arbitrary affine transforms."),
      test("renderer", "packages/core/test/vector-path.test.ts", name, "Grammar limits, normalization, clips, zoom-aware exact path hit, hittable coarse-envelope center, weak predecessor collection, exact identity, 10k shared-transform and mixed-subtree behavior.", "Complete SVG conformance or actual GPU pixels."),
      ]),
      limitations: rendererVectorPathLimitations,
    })
  }
  if (name === "typography" || name === "line-breaking") {
    return {
      status: "partial",
      conformance: "adapted",
      limitations: [
        "Production Canvas/Plane/Overlay composition now uses one exact font-owned unshaped per-codepoint advance owner for intrinsic width, alignment, controls, selection geometry, incremental text and ellipsis. Headless CPU rendering retains the deterministic 0.6em fallback. Kerning, shaping, ligatures, bidi, fallback, grapheme truncation, proportional textarea soft-wrap and complete inline formatting remain unsupported.",
      ],
      evidence: [
        {
          ...implementation("renderer", "packages/core/src/types.ts", "RenderTextMeasurer", undefined, "The neutral CPU contract admits one exact resolved-font inline-advance owner without importing Engine into Core.", "Font selection, shaping or browser-wide inline formatting."),
          revision: textAdvanceVerification.revision,
        },
        {
          ...implementation("renderer", "packages/core/src/renderer.ts", "textAdvance/measureText/ellipsizeSingleLine", undefined, "Intrinsic measurement, alignment, control text, selection geometry, incremental character patches and ellipsis consume the same supplied font advance.", "Kerning, shaping, bidi, fallback or proportional textarea soft-wrap."),
          revision: textAdvanceVerification.revision,
        },
        {
          ...implementation("renderer", "packages/browser/src/runtime.ts", "Canvas/Plane/Overlay textMeasurer ownership", undefined, "Browser composition passes the exact backend font measurer to every CPU renderer and preserves it across resize replacement.", "Non-browser manual composition or multi-font CSS selection."),
          revision: textAdvanceVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/typography.test.ts", "supplied font advance owner", "A proportional supplied advance changes intrinsic width and the exact ellipsis prefix instead of using the 0.6em fallback.", "Shaping, kerning, fallback, bidi or native browser equivalence."),
          revision: textAdvanceVerification.revision,
        },
        {
          ...test("renderer", "packages/browser/test/runtime.test.ts", "exact backend text measurer across resize", "Canvas and Plane seams preserve the identical backend measurer on initial CPU construction and viewport replacement.", "Every external host or multi-font composition."),
          revision: textAdvanceVerification.revision,
        },
        {
          type: "visual-evidence",
          repository: "external",
          revision: "ead10e484f57705410ce58e9",
          path: "storybook://captures/capture_kIyZqHyIxkZgmDu4DCMIa7Er",
          symbol: "@ui/components/components/foundation/button/icon/svg",
          proves: "The exact UI SVG variant presents its final G with the font-owned 22.854px span width and no right-edge loss on one canvas with zero console errors.",
          doesNotProve: "Every font, script, size, shaping mode, textarea wrap or browser implementation.",
        },
      ],
      lastVerified: textAdvanceVerification,
    }
  }
  if (name === "caret-selection-paint") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/core/src/renderer.ts", "textarea caret/selection Rects", undefined, "Focused exact-profile textarea offsets project stable caret or per-line selection Rects before transparent value text.", "Soft wrap, tabs, proportional glyph metrics, local scroll offsets, bidi, graphemes, IME and ordinary DOM ranges."),
        implementation("renderer", "packages/core/src/interaction.ts", "textarea pointer offset mapping", undefined, "Hit metadata supplies line/character metrics for one pre/wrap-off semantic pointer selection owner.", "Soft wrap, bidi, graphemes and multi-range selection."),
        test("renderer", "packages/core/test/textarea-paint.test.ts", "transparent readonly selection/caret", "Multiline selection, collapsed caret, stable keys, geometry, clips, paint order and disabled suppression.", "Live native pixels and unsupported text-layout modes."),
        test("renderer", "packages/core/test/interaction.test.ts", "textarea pointer selection", "Pointer drag updates semantic offsets and produces corresponding selection items.", "Soft wrap, bidi, graphemes and multiple ranges."),
      ],
      "Focused textarea caret/selection paint and pointer mapping are implemented for white-space:pre plus wrap=off; soft wrap, tabs, proportional glyph metrics, local scroll offsets, bidi, graphemes, IME, inactive and ordinary DOM selection remain unsupported.",
    ))
  }
  if (name === "popover-projection") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/core/src/renderer.ts", "explicit-source popover projection", undefined, "One source-derived below/above placement is viewport-clamped and clipped after ordinary document paint.", "Arbitrary CSS Anchor Positioning grammar, popover-root transforms and native pixels."),
        test("renderer", "packages/core/test/popover-paint.test.ts", "anchored viewport top layer", "Centered fallback, transformed anchor, flip, clamp, viewport clip, atomic stacking and hit order.", "Arbitrary anchor grammar and live native pixels."),
        test("renderer", "packages/core/test/interaction.test.ts", "Auto popover light dismiss", "Inside hits retain the popover and outside pointer focus follows DOM light dismiss.", "Native trusted events and every nested top-layer mode."),
      ],
      "Explicit source anchoring, viewport clipping and pointer light dismiss are implemented; arbitrary CSS Anchor Positioning, root transforms, backdrop, Hint and live native pixels remain unsupported.",
    ))
  }
  if (name === "cascade") {
    return {
      status: "partial",
      conformance: "adapted",
      limitations: [
        "The CPU style owner implements bounded UA/author/compiled/consumer/inline ordering, selector specificity, repeated declaration sequence, shorthand/longhand expansion, custom-property substitution, and computed-invalid winner handling. User origins, !important, cascade layers/scopes, CSS-wide rollback keywords, animations/transitions, CSSOM, and the complete browser cascade remain unsupported.",
      ],
      evidence: [
        {
          ...implementation("renderer", "packages/core/src/css.ts", "parseDeclarations/applyDeclarations/comparePriority/resolveCascadedVariables", undefined, "The CPU style pipeline preserves ordered declaration entries, compares specificity/owner order/sequence, expands shorthands at their original priority, and resolves or invalidates variable-bearing winners before computed values are consumed.", "User and important origins, layers/scopes, CSS-wide rollback keywords, animation, CSSOM, or the complete browser cascade."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/renderer.test.ts", "UA/author/inline cascade", "Observable computed layout and paint prove the existing bounded specificity, inheritance, UA and inline precedence paths.", "The complete CSS cascade or every property grammar."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/author-style-sheet.test.ts", "author/compiled/consumer/inline precedence", "Document theme, compiled component owner, explicit consumer and inline sheets resolve in the documented owner order.", "User origins, !important, layers/scopes, animation, or native CSSOM."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/gap.test.ts", "ordered and variable-bearing declarations", "Repeated shorthand/longhand source order, specificity retention and invalid-at-computed-value-time target invalidation are observable through row/column gap used values.", "Every shorthand, CSS-wide keyword, cascade layer/scope, or full browser conformance."),
          revision: flexGapVerification.revision,
        },
      ],
      lastVerified: flexGapVerification,
    }
  }
  if (name === "flex-layout") {
    return {
      status: "partial",
      conformance: "adapted",
      limitations: [
        "The bounded owner supports row/column single-line Flex and nowrap/wrap/wrap-reverse multi-line packing with direction-mapped independent row/column gaps, per-line grow/shrink/justification/align-items, admitted align-content distribution after mandatory cross gaps, intrinsic/auto sizing, and wrap-reverse cross-start semantics; balance, reverse main axes, flex-flow, order, align-self, percentage gaps, gap decorations/rules, writing modes, and complete intrinsic multi-line Flexbox sizing remain unsupported.",
      ],
      evidence: [
        {
          type: "requirement",
          repository: "renderer",
          revision: flexGapVerification.revision,
          path: "packages/core/requirements.md",
          symbol: "RENDERER-CPU-004",
          proves: "The owner contract defines the bounded multi-line Flex semantics and explicit exclusions.",
          doesNotProve: "Runtime behavior or full CSS Flexbox conformance.",
        },
        {
          ...implementation("renderer", "packages/core/src/renderer.ts", "createFlexLines/alignFlexLines/flexMainGap/flexCrossGap/placeFlexChildren", undefined, "The CPU owner implements single-line and bounded multi-line row/column Flex placement, independent main/cross gap mapping through measurement and intrinsic sizing, cross-axis line distribution, and wrap-reverse semantics.", "The excluded Flexbox, Box Alignment and CSS Gaps values and complete standard algorithms."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/renderer.test.ts", "production CSS box and flex slice", "Observable frames prove the existing bounded single-line grow/shrink/justification/alignment contract.", "Multi-line packing and full CSS Flexbox conformance."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/flex-wrap.test.ts", "flex-wrap", "Observable computed values and frame boxes prove the bounded row/column nowrap, wrap, wrap-reverse, per-line sizing/alignment, gap, definite-boundary, and cross-axis reversal contract.", "Full CSS Flexbox conformance and the explicitly excluded values."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/align-content.test.ts", "align-content", "Observable computed values and frame boxes prove bounded cross-axis alignment/distribution, auto/definite sizing, positive/negative free space, and wrap-reverse semantics.", "Full CSS Flexbox/Box Alignment conformance and the explicitly excluded values."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/position.test.ts", "absolute flex static position under wrap-reverse", "The absolute-flex static-position path shares the corrected reversed cross-start semantics.", "Every positioned Flexbox algorithm or native browser behavior."),
          revision: flexGapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/gap.test.ts", "two-axis Flex gaps", "Observable computed values and frame boxes prove direction-mapped main/cross gaps, shorthand/longhand order, item counting, wrapping, intrinsic sizes, and align-content interaction.", "Grid/multicol gaps, percentage gaps, decorations/rules, reverse main axes, or full conformance."),
          revision: flexGapVerification.revision,
        },
      ],
      lastVerified: flexGapVerification,
    }
  }
  if (name === "projection-root-inheritance") {
    return implemented("extension", [
      implementation("renderer", "packages/core/src/renderer.ts", "projectionRootInheritedStyle", undefined, "A projection root computes inherited values through its real semantic ancestor chain and observes ancestor mutations/reparenting.", "Complete CSS inheritance and every property grammar."),
      test("renderer", "packages/core/test/renderer.test.ts", name, "Ancestor-derived color/font values and reparent invalidation on an exact projection root.", "Full CSS inheritance and cross-browser conformance."),
    ])
  }
  if (name === "author-stylesheet-lifecycle") {
    return implemented("extension", [
      implementation("renderer", "packages/dom/src/author-style-sheet.ts", "Document author stylesheet registry", undefined, "One separate exclusive ordered Document owner with atomic replace, revision snapshots, subscriptions and release.", "Standard CSSOM styleSheets/adoptedStyleSheets interfaces."),
      implementation("renderer", "packages/core/src/stylesheet-cache.ts", "cachedDocumentStyleRules", undefined, "Author sheets precede compiled and explicit consumer sheets and share cache keys across same-Document projections.", "Full CSS cascade grammar and live browser pixels."),
      test("renderer", "packages/dom/test/author-style-sheet.test.ts", name, "Order, deduplication, collision/exclusive ownership, transaction coalescing and release.", "Native CSSOM behavior."),
      test("renderer", "packages/core/test/author-style-sheet.test.ts", name, "Theme/compiled/consumer/inline precedence, semantic :root, multiple projections, shared parses and invalidation.", "Unsupported CSS grammar and live native presentation."),
    ])
  }
  if (name === "compiled-stylesheet-lifecycle") {
    return implemented("extension", [
      implementation("renderer", "packages/dom/src/compiled-style-sheet.ts", "Document compiled stylesheet registry", undefined, "Exact Document-scoped immutable records, collision rejection, revision snapshots, subscriptions and reference-counted leases.", "The standard CSSOM styleSheets/adoptedStyleSheets interfaces."),
      implementation("renderer", "packages/react/src/runtime.ts", "RootStyleSheetOwner", undefined, "Exact compiled template metadata is acquired once per ComponentRoot and released on unmount without per-instance scanning.", "Template compiler extraction outside the Renderer repository."),
      implementation("renderer", "packages/core/src/stylesheet-cache.ts", "cachedDocumentStyleRules", undefined, "Same-Document projections share parsed rules by compiled revision and explicit global CSS content.", "General incremental layout cost after a style change."),
      test("renderer", "packages/dom/test/compiled-style-sheet.test.ts", name, "Registry deduplication, collision atomicity, transaction coalescing and lease release.", "Full CSSOM behavior."),
      test("renderer", "packages/react/test/compiled-style-sheet.test.ts", name, "One thousand instances, isolated root snapshots with exact Template metadata, shared Document deduplication, collision rollback, memo metadata and root release.", "Compiler extraction and native browser pixels."),
      test("renderer", "packages/core/test/compiled-style-sheet.test.ts", name, "Initial/late rules, explicit global CSS, shared projection cache, pseudos, inheritance and release.", "Unsupported CSS grammar and general renderer performance."),
    ])
  }
  if (name === "pointer" || name === "default-activation") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/core/src/interaction.ts", "pointer capture and control default actions", undefined, "Deepest dispatch, nearest control ownership, semantic capture retargeting, range drag and select option activation share one interaction owner.", "The complete Pointer Events device model and every HTML default action."),
        test("renderer", "packages/core/test/interaction.test.ts", name, "Nested ownership, capture outside hits, select open/choice/light-dismiss and disabled/cancel cleanup.", "Native trusted-event provenance and every HTML control."),
        test("renderer", "packages/core/test/range-input.test.ts", "range pointer default action", "Rendered track geometry drives DOM range input/change semantics.", "Vertical/tick/datalist behavior."),
      ],
      "Implemented for the bounded rendered-control set including explicit semantic capture, horizontal Range and collapsed Select; implicit touch capture and complete Pointer Events/HTML default actions remain outside Core.",
    ))
  }
  if (name === "form-control-projection") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/core/src/renderer.ts", "bounded native control projection", undefined, "Checkbox check glyph, Radio dot, Select disclosure/picker and horizontal Range paint retain exact semantic control/option identities.", "Complete native form chrome, indeterminate Checkbox, listboxes, accessibility and every input type."),
        test("renderer", "packages/core/test/input-paint.test.ts", "checkbox and radio UA indicators", "Stable checked glyph/dot distinction, current color and disabled opacity/hit behavior.", "Indeterminate chrome and live native font pixels."),
        test("renderer", "packages/core/test/range-input.test.ts", "range input projection", "Stable range track/thumb paint and pointer behavior.", "Vertical/ticks/datalist and native pixels."),
        test("renderer", "packages/core/test/select-paint.test.ts", "collapsed select and picker projection", "Stable disclosure identity, label-safe geometry, exact option boxes/hits and presentation-coordinate viewport placement.", "Scrolling/type-ahead/multiple/listbox/accessibility and native font pixels."),
      ],
      "The bounded form-control set includes checked Checkbox/Radio indicators, collapsed Select disclosure/picker and horizontal Range interaction; indeterminate Checkbox, multiple/listbox, type-ahead, accessibility projection and complete native form chrome remain unsupported.",
    ))
  }
  if (name === "invalidation") {
    return rendererVerifiedAt(partial(
      "adapted",
      [
        implementation("renderer", "packages/core/src/renderer.ts", "projection-neutral invalidation", undefined, "Every admitted mutation still marks its exact target/ancestry before conservative selector-independent data and hidden-insertion work may reuse the retained projection.", "General dirty-subtree layout, arbitrary structural changes and complete browser invalidation."),
        test("renderer", "packages/core/test/incremental.test.ts", "projection-neutral mutation incremental frame", "Selector dependencies from ancestor compounds and visible or mixed work force complete projection while neutral data-plus-hidden insertion reuses exact records.", "Unsupported selectors, browser style invalidation or arbitrary DOM mutations."),
      ],
      "Dirty ancestry remains exact and bounded fast paths now include selector-independent data-plus-hidden insertion; general dirty frames still remeasure/place/re-emit.",
    ), projectionNeutralVerification)
  }
  if (name === "incremental-patches") {
    const classification = partial(
      "adapted",
      [
        implementation("renderer", "packages/core/src/renderer.ts", "incremental-patches", undefined, "Bounded Text, input-value, transform, VectorPath and projection-neutral DOM batches reuse exact retained frame records through conservative guards.", "General dirty-subtree layout, arbitrary structural changes and mixed mutation/state work."),
        test("renderer", "packages/core/test/incremental.test.ts", "projection-neutral mutation incremental frame", "Selector-independent data attributes plus Comment/hidden-root insertion reuse the exact projection; selector-dependent data and visible insertion fall back.", "General structural incremental layout or unsupported selector syntax."),
        test("renderer", "bench/projection-neutral-patch.ts", "10k projection-neutral patch", "Fresh-process p50/p95/p99 timing and exact projection identity across 10,000 visible semantic rows and 100 data-plus-hidden append batches.", "Browser scheduling, arbitrary DOM mutations or unrelated incremental paths."),
      ],
      "Dirty bookkeeping and bounded fast paths reuse exact retained records for narrow Text, input-value, transform, VectorPath and selector-independent data-plus-hidden insertion work; general dirty frames still remeasure/place/re-emit.",
    )
    return rendererVerifiedAt(classification, projectionNeutralVerification)
  }
  if (name === "input-value-fast-path") {
    return implemented("extension", [
      implementation("renderer", "packages/core/src/renderer.ts", "input-value-fast-path", undefined, "One text-like input value state change replaces only its existing immutable value display item while reusing all layout and hit records.", "General dirty-subtree layout, multiple controls, structural display-item insertion/removal, selection paint and other state kinds."),
      test("renderer", "packages/core/test/incremental.test.ts", "input value incremental frame", "Exact frame equality against a forced rebuild, record identity reuse and fail-closed mixed/multiple/structural fallbacks.", "Every form-control state or general incremental layout."),
      test("renderer", "bench/input-value-patch.ts", "10k input value patch", "Fresh-process p50/p95/p99 timing and exact layout/hit identity reuse across 10,000 semantic inputs.", "Browser scheduling, GPU presentation or unrelated state kinds."),
    ])
  }
  const implementedNames = new Set(["immutable-frame", "clean-frame-fast-path"])
  if (implementedNames.has(name)) {
    return implemented("extension", [implementation("renderer", "packages/core/src/renderer.ts", name, undefined, "Bounded immutable frame/clean reuse contract.", "General incremental rendering."), test("renderer", "packages/core/test/renderer.test.ts", name, "Exact frame identity and mutation protection.", "All dirty update paths.")])
  }
  const partialNames = new Set([
    "stylesheet-parser", "selector-matching", "specificity", "cascade", "computed-style", "inheritance", "block-layout", "inline-layout",
    "flex-layout", "sizing", "box-model", "positioning", "overflow", "clip-stacks", "scroll-metrics", "scrollbar-paint", "typography",
    "line-breaking", "images", "form-control-projection", "progress-meter", "textarea-select-range", "z-index", "transforms", "shadows",
    "display-list", "hit-metadata", "invalidation", "incremental-patches", "tooltip-title", "pointer", "wheel", "default-activation",
    "popover-projection", "text-leaf-fast-path", "transform-subtree-fast-path", "performance-paths",
  ])
  if (partialNames.has(name)) {
    return partial("adapted", [implementation("renderer", "packages/core/src/renderer.ts", name, undefined, "The bounded CPU frame stage exists.", "The complete CSS/browser algorithm."), test("renderer", rendererTestPath(name), name, "Observable behavior for the bounded subset.", "Unsupported values and general incremental coverage.")], rendererLimitation(name))
  }
  return unsupported(entry, "The CPU renderer has no implementation of this internal platform capability.")
}

function classifyBrowser(entry: CapabilityInventoryEntry): Classification {
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, browserExportStatus(entry))
  const name = entry.id.slice("browser.features.".length)
  if (name === "keyboard") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/browser/src/native-input-host.ts", "generic semantic keyboard owner", undefined, "One read-only native input hosts keydown/keyup for any focused semantic HTMLElement without mirroring unrelated control state.", "Complete browser key layout, sequential navigation and live native acceptance."),
        test("renderer", "packages/browser/test/native-input-host.test.ts", "generic Escape keyboard host", "Exact focused target, semantic cancellation, Auto-popover close and focus restoration.", "Live native browser execution and complete keyboard navigation."),
      ],
      "Focused semantic keyboard dispatch and bounded control/popover defaults are implemented through one host; complete key layout, sequential navigation and live native browser acceptance remain unsupported.",
    ))
  }
  if (name === "native-browser-evidence") return unverified(entry, "All current Browser tests use Bun seams/fakes; no live browser console, pixels, native IME, or real ResizeObserver/rAF evidence was reproduced.")
  if (name === "error-boundaries") return unsupported(entry, "The browser composition owner has lifecycle validation but no general application error-boundary contract.")
  if (name === "clipboard-proxy") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/browser/src/native-input-host.ts", "native text-control copy proxy", undefined, "The exact mirrored value/range performs native plain-text copy after one cancellable semantic copy Event.", "ClipboardEvent/DataTransfer, cut, paste, async API, permissions and live OS evidence."),
        test("renderer", "packages/browser/test/native-input-host.test.ts", "readonly textarea copy", "Selected substring and semantic cancellation through the exact proxy.", "Live OS clipboard, DataTransfer, cut/paste and permissions."),
      ],
      "Bounded native plain-text copy is implemented for the exact active Input/TextArea selection; ClipboardEvent/DataTransfer, cut, paste, async API, permissions and live OS acceptance remain unsupported.",
    ))
  }
  if (name === "number-input-proxy") {
    return recovered(implemented("extension", [
      implementation("renderer", "packages/browser/src/native-input-host.ts", "number and range input proxy", undefined, "One reusable native input mirrors focused semantic number/range value, min, max and step without fabricated selection and routes keyboard/beforeinput/input/change with cancellation rollback.", "Live native browser execution, forms and validity UI."),
      test("renderer", "packages/browser/test/native-input-host.test.ts", "number and range proxy", "Exact target/proxy identity, min/max/step and sanitized value sync, native Arrow default seam, cancellation, keyboard routing and input/change order.", "Live native browser behavior and visual chrome."),
    ]))
  }
  if (name === "select-picker") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/browser/src/native-input-host.ts", "select keyboard proxy", undefined, "The reusable native select is a keyboard owner while semantic/Core own selection and in-canvas picker paint.", "Native accessibility projection, multiple/listbox and type-ahead."),
        implementation("renderer", "packages/core/src/renderer.ts", "emitSelectPicker", undefined, "One edge-aware top-layer picker projects exact Option identities in the shared frame.", "Scrolling, multiple/listbox, type-ahead and native accessibility."),
        test("renderer", "packages/browser/test/native-input-host.test.ts", "select keyboard host", "Arrow selection, Space open, Escape close and input/change ordering.", "Live native browser execution and omitted picker modes."),
        test("renderer", "packages/core/test/interaction.test.ts", "select picker interaction", "Pointer open, exact option choice and outside light-dismiss.", "Multiple/listbox, scrolling and accessibility."),
      ],
      "Collapsed single-select pointer/keyboard picker behavior is implemented; scrolling beyond eight visible options, multiple/listbox, type-ahead and native accessibility projection remain unsupported.",
    ))
  }
  if (name === "pointer-capture") {
    return recovered(partial(
      "adapted",
      [
        implementation("renderer", "packages/browser/src/runtime.ts", "canvas and semantic pointer capture", undefined, "Native canvas capture retains host delivery while Core retargets through the exact semantic Document override.", "Live native devices and implicit touch capture."),
        test("renderer", "packages/browser/test/runtime.test.ts", "canvas pointer capture", "Host capture lifecycle and cleanup.", "Live native browser execution."),
        test("renderer", "packages/core/test/interaction.test.ts", "semantic pointer capture", "Captured Element receives move/up outside its hit and emits got/lost in order.", "Implicit touch capture and live devices."),
      ],
      "Native canvas delivery and explicit semantic capture are integrated; implicit touch capture and live native browser acceptance remain outside this evidence.",
    ))
  }
  if (name === "one-experience-topology") {
    return implemented("extension", [
      implementation("renderer", "packages/browser/src/space-runtime.ts", name, undefined, "One exact semantic Document/style/font/interaction owner is shared by every projection in one Space host.", "Live native browser execution."),
      implementation("renderer", "packages/browser/src/presentation-host.ts", "presentation-host claim", undefined, "CanvasRuntime and SpaceRuntime share one native-Document/canvas cardinality claim with rollback and release.", "Direct Engine-only canvas ownership outside renderer-browser."),
      test("renderer", "packages/browser/test/space-runtime.test.ts", name, "Same-Document display/HUD reparenting, foreign/detached rejection, shared state and host lifecycle.", "Live browser/native input/WebGPU pixels."),
      test("renderer", "packages/browser/test/presentation-host.test.ts", "presentation-host claim", "Exact canvas/native Document cardinality and release.", "Cross-process or direct Engine hosts."),
    ])
  }
  if (name === "linked-author-stylesheets") {
    return implemented("extension", [
      implementation("renderer", "packages/browser/src/linked-author-style-sheet-host.ts", "createBrowserLinkedAuthorStyleSheetHost", undefined, "Exact native-tree-ordered link sources, awaitable readiness, origin-clean loaded CSSOM mirroring, bounded observation, refresh and disposal without fetch or global scan.", "Native browser pixels, cross-origin access, @import, @font-face, nesting or grouping rules."),
      test("renderer", "packages/browser/test/linked-author-style-sheet-host.test.ts", name, "Loaded and late CSSOM, native order, required load rejection, exact observation, refresh, disposal, collision/security and unsupported-rule failure.", "Live native load/CSSOM/browser rendering."),
      test("renderer", "packages/browser/test/plane-runtime.test.ts", "author stylesheet scheduling", "Author revisions use the same coalesced projection frame channel and are inert after disposal.", "Live requestAnimationFrame/WebGPU pixels."),
    ])
  }
  if (name === "direct-world-regions") {
    return implemented("extension", [
      implementation("renderer", "packages/browser/src/space-runtime.ts", "addWorld", undefined, "One host attaches bounded direct Engine Spaces, maps logical/DPR viewport geometry and routes input through the shared frame lifecycle.", "Unrelated direct-world picking and application-specific scene behavior."),
      test("renderer", "packages/browser/test/space-runtime.test.ts", name, "Exact Space attachment, framebuffer geometry, overlay/world/plane input priority, capture cleanup and presented-frame notification.", "Cross-process hosts and unrelated browser controls."),
      {
        type: "visual-evidence",
        repository: "external",
        revision: "daa1cf663667710894282ce8",
        path: "storybook://captures/capture_JncmVXljfyjQ_ihTqhrfD47d",
        symbol: "@engine/core/space/coordinate-system/z-up",
        proves: "The exact Engine owner route presents a visible non-black bounded world through the shared Storybook canvas with zero console errors.",
        doesNotProve: "Every Engine scene, device, viewport size or input modality.",
      },
    ])
  }
  if (name === "compiled-stylesheet-scheduling") {
    return implemented("extension", [
      implementation("renderer", "packages/browser/src/plane-runtime.ts", "compiled stylesheet subscription", undefined, "Plane, overlay and isolated canvas runtimes route exact Document style revisions through their existing coalesced frame lifecycle.", "Live native browser execution."),
      test("renderer", "packages/browser/test/plane-runtime.test.ts", name, "Late registration requests a frame, changes projected style and becomes inert after disposal.", "Every browser host and live WebGPU pixels."),
    ])
  }
  if (name === "semantic-pointer-events") {
    return partial(
      "adapted",
      [
        implementation("renderer", "packages/browser/src/space-runtime.ts", "resolvePointerOwnerHit arbitration", undefined, "Overlay/plane arbitration uses the nearest rendered interactive or disabled ancestor without replacing the deepest semantic event target.", "Live native browser execution and unrelated world-scene activation."),
        test("renderer", "packages/browser/test/space-runtime.test.ts", name, "Actual canvas listener routing over nested span/img descendants, cross-child release, disabled world/camera blocking, wheel/context/double-click arbitration and capture cleanup.", "Native browser trusted events and live WebGPU pixels."),
      ],
      "Implemented through the bounded one-Experience host; live native browser acceptance remains separate.",
    )
  }
  const implementedNames = new Set(["pointer-mapping", "selection-synchronization", "cancellation-rollback", "document-plane", "multiple-planes", "overlays", "camera-gestures", "cleanup", "animation-frame-coalescing", "same-document-input-identity"])
  if (implementedNames.has(name)) {
    return implemented("extension", [implementation("renderer", browserSourcePath(name), name, undefined, "The bounded browser composition adapter logic.", "Live native browser execution."), test("renderer", browserTestPath(name), name, "Adapter lifecycle, mapping, rollback, and identity.", "Live browser/native input/WebGPU pixels.")])
  }
  return partial("adapted", [implementation("renderer", browserSourcePath(name), name, undefined, "The bounded host slice exists.", "Complete browser-host semantics."), test("renderer", browserTestPath(name), name, "Current adapter behavior.", "Live browser/native input/WebGPU acceptance.")], "Implemented through a bounded host adapter; actual native browser execution was not reproduced in this checkout.")
}

function classifyWebgpu(entry: CapabilityInventoryEntry): Classification {
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, webgpuExportStatus(entry))
  const name = entry.id.slice("webgpu.features.".length)
  if (name === "device-pixel-evidence") {
    return {
      ...partial(
        "extension",
        [
          {
            ...implementation("renderer", "packages/webgpu/src/webgpu-backend.ts", "RendererWebGpuBackend text materialization", undefined, "The production adapter materializes the exact resolved frame text into retained Engine geometry and transforms used by the live canvas path.", "Successful GPU submission, readback, every display kind or every device."),
            revision: textBaselineVerification.revision,
          },
          {
            type: "visual-evidence",
            repository: "external",
            revision: "ead10e484f57705410ce58e9",
            path: "storybook://captures/capture_kIyZqHyIxkZgmDu4DCMIa7Er",
            symbol: "@ui/components/components/foundation/button/icon/svg",
            proves: "The production retained WebGPU path presents the exact SVG label with complete final-glyph pixels, font-owned advance and baseline on one visible canvas with empty diagnostics and console output.",
            doesNotProve: "Every display kind, font, GPU adapter, viewport, clipping combination or device-loss path.",
          },
        ],
        "Actual browser canvas pixels are proven for the exact default-font text route; the remaining display kinds, devices, fonts and failure modes do not yet have complete pixel evidence.",
      ),
      lastVerified: textAdvanceVerification,
    }
  }
  if (name === "vector-path") {
    return rendererPathWorkingTree({
      ...implemented("extension", [
      implementation("renderer", "packages/webgpu/src/webgpu-backend.ts", "retained stroked Path planning", undefined, "Exact-opaque Paths use stable semantic style and sampled-segment slots in transform/clip-compatible Engine draw-range runs; non-opaque Paths retain one continuous scalar Mesh fallback.", "Complete SVG stroking, fill, dashes, arbitrary joins/caps or adaptive curve quality."),
      test("renderer", "packages/webgpu/test/vector-path.test.ts", name, "10k opaque one-run batching, zero-upload pan/zoom, one-record style/route updates, barriers, clips, slot-generation safety, scalar fallback identity/updates/cleanup and atomic validation.", "Every GPU/device, complete SVG stroking or live browser pixels."),
      test("engine", "packages/core/src/renderer/shaders/stroked-path-instanced.webgpu.test.ts", "InstancedStrokedPath pixels", "Real WebGPU pixels cover exact-opaque sampled segment width, transform and presentation clipping.", "Non-opaque fallback pixels, every adapter/device or complete SVG stroking."),
      ]),
      limitations: webgpuVectorPathLimitations,
    })
  }
  if (name === "text") {
    return {
      ...partial(
        "adapted",
        [
          {
            ...implementation("renderer", "packages/webgpu/src/webgpu-backend.ts", "readFontMetrics/createFontTextMeasurer/positionText", undefined, "One exact Engine font owns the cached baseline ratio and a bounded per-codepoint advance cache shared with CPU layout; retained text uses the same font and letter spacing.", "Font-family selection, fallback, shaping, bidi, vertical writing or every device."),
            revision: textAdvanceVerification.revision,
          },
          {
            ...test("renderer", "packages/webgpu/test/webgpu-backend.test.ts", "alphabetic baseline and cached font advances", "Different line heights preserve retained geometry, spaces receive between-character spacing, and one thousand repeated SVG measures map each code point only once.", "Every real font, glyph and GPU adapter."),
            revision: textAdvanceVerification.revision,
          },
          {
            type: "visual-evidence",
            repository: "external",
            revision: "ead10e484f57705410ce58e9",
            path: "storybook://captures/capture_kIyZqHyIxkZgmDu4DCMIa7Er",
            symbol: "@ui/components/components/foundation/button/icon/svg",
            proves: "Real default-font SVG glyph pixels use the corrected baseline, exact 22.854px advance and a complete final G on the exact one-canvas route with zero console errors.",
            doesNotProve: "Font selection/fallback, shaping, every script, size, clip chain, device or native-browser equivalence.",
          },
        ],
        "The backend owns one resolved TrueTypeFont, a bounded per-codepoint advance cache and a metric-derived alphabetic baseline proven in real pixels; font-family selection, fallback, shaping, bidi and complete multi-font CSS text remain unsupported.",
      ),
      lastVerified: textAdvanceVerification,
    }
  }
  const implementedNames = new Set(["frame-validation", "scalar-retained-path", "automatic-rect-instancing", "run-barriers", "overlap-law", "stable-slots", "partial-record-uploads", "paint-order", "cleanup", "geometry-invalidation", "diagnostics", "unsupported-combinations", "screen-overlay", "document-plane"])
  if (implementedNames.has(name)) {
    return implemented("extension", [implementation("renderer", "packages/webgpu/src/webgpu-backend.ts", name, undefined, "The bounded retained backend contract.", "Actual device pixels and unsupported combinations."), test("renderer", "packages/webgpu/test/webgpu-backend.test.ts", name, "Retained identity, planning, updates, fail-closed validation, and cleanup.", "Actual GPU submission/readback.")])
  }
  return partial("adapted", [implementation("renderer", "packages/webgpu/src/webgpu-backend.ts", name, undefined, "The bounded materialization path.", "Complete CSS paint semantics and actual GPU pixels."), test("renderer", "packages/webgpu/test/webgpu-backend.test.ts", name, "Current retained Engine-object behavior.", "Every CSS combination and device output.")], webgpuLimitation(name))
}

function classifyReact(entry: CapabilityInventoryEntry): Classification {
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, reactExportStatus(entry))
  if (entry.id.startsWith("react.hooks.")) {
    if (supportedReactHooks.has(entry.name)) {
      return partial("adapted", [externalEvidence(entry), implementation("renderer", "packages/react/src/runtime.ts", entry.name, "1722-2065", "Slot/order/dependency/cleanup implementation in the compiled runtime.", "Fiber, concurrency, StrictMode replay, server behavior, and browser-after-paint timing."), test("renderer", "packages/react/test/hooks.test.ts", entry.name, "Current hook identity, dependencies, cleanup, and failure behavior.", "Full React 19.2 scheduling/server/StrictMode semantics.")], reactHookLimitation(entry.name))
    }
    return unsupported(entry, "The reference hook is absent or exported only as an explicit UnsupportedReactFeatureError path.")
  }
  if (entry.id.startsWith("react.react-dom.") || entry.id.startsWith("react.jsx-runtime.") || entry.id.startsWith("react.compiler-runtime.")) {
    return notApplicable(entry, "@zavx0z/react is a compiled React-shaped runtime, not npm React or a react-dom host; TSX is compiled to the project ABI before runtime.")
  }
  if (entry.id.startsWith("react.semantics.architecture-")) {
    return implemented("extension", [implementation("renderer", "packages/react/src/compatibility.ts", entry.name, "3-47", "The explicit false architecture flags and custom runtime profile.", "React compatibility behavior."), test("renderer", "packages/react/test/boundary.test.ts", entry.name, "No npm react/react-dom/reconciler, Fiber, or virtual DOM dependency/import.", "External package manager state outside this checkout.")])
  }
  if (entry.id === "react.semantics.root-stylesheet-snapshot") {
    return implemented("extension", [
      implementation("renderer", "packages/react/src/runtime.ts", "ComponentRoot.readStyleSheets", undefined, "Stable immutable first-adoption snapshots preserve exact full Template sheet objects per root while Document execution ownership remains separate.", "Storybook navigation/UI behavior and native browser pixels."),
      test("renderer", "packages/react/test/compiled-style-sheet.test.ts", entry.name, "Empty/stable snapshots, one thousand instances, exact source metadata, isolated Workbench/story roots, shared Document deduplication, collision rollback and unmount inaccessibility.", "Compiler opt-in routing and live consumer integration."),
    ])
  }
  if (supportedReactSemanticIds.has(entry.id)) {
    return partial("adapted", [externalEvidence(entry), implementation("renderer", "packages/react/src/runtime.ts", entry.name, undefined, "Compiled component/root lifecycle implementation.", "Fiber/concurrent/StrictMode/server semantics."), test("renderer", "packages/react/test/runtime.test.ts", entry.name, "Current synchronous component lifecycle and rollback.", "Full React 19.2 behavior.")], "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM.")
  }
  if (entry.id.startsWith("react.semantics.")) return unsupported(entry, "This React 19.2 reference behavior is not part of the current compiled runtime.")
  if (["memo", "createContext"].includes(entry.name)) {
    return partial("adapted", [externalEvidence(entry), implementation("renderer", "packages/react/src/composition.ts", entry.name, undefined, "Bounded compiled composition API.", "React element API and full concurrent semantics."), test("renderer", "packages/react/test/runtime.test.ts", entry.name, "Current compiled component behavior.", "Full React reference behavior.")], "Implemented as a compiled runtime adaptation, not an npm React implementation.")
  }
  return unsupported(entry, "The React 19.2 public reference API is not implemented by @zavx0z/react.")
}

function classifyTemplate(entry: CapabilityInventoryEntry): Classification {
  if (entry.id.startsWith("platform.")) return classifyTemplatePublicExport(entry)
  if (entry.id.startsWith("tsx.typescript.")) return classifyTypescriptJsx(entry)
  if (entry.id.startsWith("tsx.tagged-html.")) return classifyTaggedHtml(entry)
  if (entry.id.startsWith("tsx.compiler.")) return classifyTsxCompiler(entry)
  return unsupported(entry, "No Template support classification was found.")
}

const templateCapabilityRuntimeExports = new Set([
  "CAPABILITY_USAGE_GENERATOR_VERSION",
  "CAPABILITY_USAGE_SCHEMA_VERSION",
  "createCapabilityUsageManifest",
  "serializeCapabilityUsageManifest",
])

const templateCapabilityTypeExports = new Set([
  "CapabilityUsage",
  "CapabilityUsageFile",
  "CapabilityUsageManifest",
  "CapabilityUsagePosition",
  "CapabilityUsageSource",
  "CapabilityUsageValue",
  "CssAttributeSelectorCapabilityUsage",
  "CssPropertyCapabilityUsage",
  "CssPseudoCapabilityUsage",
  "DomMemberCapabilityUsage",
  "EventCapabilityUsage",
  "IntrinsicAttributeCapabilityUsage",
  "IntrinsicElementCapabilityUsage",
  "JsxCompileResult",
  "RefCapabilityUsage",
])

function classifyTemplatePublicExport(entry: CapabilityInventoryEntry): Classification {
  if (templateCapabilityRuntimeExports.has(entry.name)) {
    return {
      ...implemented("extension", [
        ...classifyPublicExport(entry, "partial").evidence,
        test("template", "compiler/capability-usage.test.ts", entry.name, "The public manifest value participates in exact extraction, versioning and deterministic serialization behavior.", "Renderer matrix resolution or runtime conformance."),
        test("template", "script/package-proof.ts", entry.name, "The packed package exposes the public manifest value to an external consumer.", "Every consumer build integration."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (templateCapabilityTypeExports.has(entry.name)) {
    return {
      ...implemented("extension", [
        ...classifyPublicExport(entry, "partial").evidence,
        test("template", "script/package-proof.ts", entry.name, "A packed-package consumer imports and uses the public neutral usage/result type contract.", "Runtime matrix resolution or standard DOM implementation."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (entry.name === "CreateTemplateJsxPluginOptions") {
    return {
      ...implemented("extension", [
        ...classifyPublicExport(entry, "partial").evidence,
        test("template", "compiler/compiler.test.ts", "capabilityManifestPath", "A real Bun build exercises the typed explicit manifest output option.", "Consumer identity or Renderer matrix policy."),
        test("template", "script/package-proof.ts", "capabilityManifestPath", "The packed plugin option remains consumable from the public package.", "Every bundler or build lifecycle."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  return classifyPublicExport(entry, templateExportStatus(entry))
}

function classifyTypescriptJsx(entry: CapabilityInventoryEntry): Classification {
  const supported = new Set(["tsx-file-syntax", "intrinsic-elements", "value-elements", "jsx-namespace", "attribute-type-checking", "children-type-checking", "expression-children", "automatic-runtime", "development-runtime", "angle-bracket-assertion-rejection"])
  const suffix = entry.id.slice("tsx.typescript.".length)
  if (["intrinsic-elements", "attribute-type-checking", "jsx-namespace"].includes(suffix)) {
    return {
      ...implemented("adapted", [
        externalEvidence(entry),
        implementation("template", "jsx-runtime.ts", entry.name, undefined, "The governed JSX namespace maps the supported standard HTML tags, properties, event types, exact currentTarget and callback refs to global lib.dom interfaces.", "Complete browser DOM behavior or TypeScript JSX profiles outside the governed compiler."),
        test("template", "compiler/jsx-types.test.ts", entry.name, "A strict real tsc project proves standard tag/property rejection, exact event/currentTarget inference, callback ref targets and object-ref rejection.", "Runtime DOM behavior or every standard HTML interface."),
      ]),
      limitations: ["Implemented for the governed standard HTML JSX profile; TypeScript JSX modes outside that profile and complete browser runtime behavior remain outside this row."],
      lastVerified: templateCapabilityVerification,
    }
  }
  if (supported.has(suffix)) return partial("adapted", [externalEvidence(entry), implementation("template", "jsx-runtime.ts", entry.name, undefined, "Type namespace/runtime boundary used by the project compiler.", "TypeScript-wide JSX runtime semantics or compiler acceptance."), test("template", "compiler/compiler.test.ts", entry.name, "Current compiler typing/transform profile.", "Every TypeScript-accepted JSX program.")], "TypeScript typing is intentionally broader than the project compiler's accepted source profile.")
  return unsupported(entry, "The syntax exists in TypeScript JSX but is rejected or not emitted by the project compiler profile.")
}

function classifyTaggedHtml(entry: CapabilityInventoryEntry): Classification {
  const suffix = entry.id.slice("tsx.tagged-html.".length)
  const implementedNames = new Set(["static-element-names", "dynamic-values", "attributes", "boolean-remove-semantics", "events", "nested-templates", "arrays", "positional-reconciliation", "disposal", "transaction-boundaries", "security-injection"])
  if (implementedNames.has(suffix)) return implemented("extension", [implementation("template", "dom.ts", entry.name, undefined, "Direct semantic DOM tagged-template implementation.", "WHATWG parsing and keyed reconciliation."), test("template", "dom.test.ts", entry.name, "Observable mount/update/identity/disposal/security behavior.", "Failure rollback and unsupported grammar.")])
  if (suffix === "failure-rollback") return unverified(entry, "Document.transaction gives one mutation batch, but no Template-owned rollback test proves restoration after a later part throws.")
  return unsupported(entry, "The tagged-html parser fails closed or intentionally omits this grammar/reconciliation capability.")
}

function classifyTsxCompiler(entry: CapabilityInventoryEntry): Classification {
  const suffix = entry.id.slice("tsx.compiler.".length)
  if (suffix === "standard-dom-jsx-typing") {
    return {
      ...implemented("extension", [
        implementation("template", "jsx-runtime.ts", "governed standard DOM JSX namespace", undefined, "Authored intrinsic TSX uses global lib.dom element/event interfaces with exact tag properties, handler currentTarget and callback ref targets, without @zavx0z/dom type imports.", "Runtime implementation or complete browser conformance."),
        test("template", "compiler/jsx-types.test.ts", suffix, "A strict tsc project proves valid standard DOM inference and rejects unknown tags/properties, wrong event types, wrong callback ref targets and object refs.", "Runtime DOM behavior."),
        test("template", "script/package-proof.ts", suffix, "The packed public package preserves standard DOM JSX typing for a real consumer.", "Platform implementation of every typed member."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (suffix === "configured-project-ownership") {
    return {
      ...implemented("extension", [
        implementation("template", "compiler/session.ts", "configured TypeScript project ownership", undefined, "Governed TSX must resolve through an explicit configured TypeScript project before semantic checking or transformation; inferred JSX outside TSX remains admitted for explicitly governed physical dependency roots.", "Every TypeScript project topology or consumer build configuration."),
        test("template", "compiler/compiler.test.ts", "inferred TypeScript project rejection", "A governed TSX source owned only by /dev/null/inferred fails with the precise tsconfig ownership diagnostic, while the explicit inferred JSX dependency contract remains covered separately.", "Runtime DOM behavior or matrix resolution."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (suffix === "host-attribute-transport") {
    return {
      ...implemented("extension", [
        implementation("template", "compiler/host-profile.ts", "hostAttributeTransport/hostAttributeValue", undefined, "One shared compiler profile assigns exact content-attribute, live-property, style, event and callback-ref transport and preserves static/dynamic authored values for both lowering and capability evidence.", "Runtime behavior outside the admitted host property set or complete HTML reflection semantics."),
        implementation("template", "compiler/transform.ts", "compileIntrinsic host transport", undefined, "Intrinsic lowering consumes the same reviewed transport decision and never substitutes a content attribute for admitted indeterminate/tabIndex live properties.", "Renderer implementation of every standard property."),
        test("template", "compiler/host-transport-runtime.test.ts", "compiled host property transport", "Dynamic and literal indeterminate/tabIndex values reach exact retained DOM properties, preserve identity across rerender, and do not create a false indeterminate content attribute.", "Every HTML property/reflection/default-action behavior."),
        test("template", "compiler/compiler.test.ts", "host transport ABI", "Generated code routes reviewed live properties through BindProperty and rejects stale attribute lowering.", "Downstream browser pixels."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (suffix === "semantic-dependency-invalidation") {
    return {
      ...implemented("extension", [
        implementation("template", "compiler/symbols.ts", "semantic dependency closure", undefined, "Checker-resolved governed dependencies include transitive type-only ownership used by neutral lib.dom member classification.", "Arbitrary dependencies outside governed roots."),
        implementation("template", "compiler/session.ts", "fresh semantic snapshot restart", undefined, "A changed transitive semantic dependency invalidates cached code/usages and restarts the TypeScript API snapshot before reclassification.", "Every editor/build-server topology or external filesystem race."),
        test("template", "compiler/capability-usage.test.ts", "transitive governed type-only dependency", "Changing a transitive type alias from lib.dom HTMLInputElement to a consumer interface removes the stale showPicker standard usage and records a cache miss plus fresh snapshot.", "Runtime platform implementation of showPicker."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (suffix === "semantic-diagnostics") {
    return {
      ...implemented("extension", [
        implementation("template", "compiler/session.ts", "JsxCompilerSession.compileFile semantic diagnostics", undefined, "The governed TypeScript project runs semantic diagnostics with exact authored line/column before code or usage artifacts become observable.", "Runtime DOM behavior and matrix resolution outside Template."),
        test("template", "compiler/compiler.test.ts", "standard JSX semantic diagnostics", "Compiler builds reject unknown standard tags/properties/events and incompatible standard event handler types with source diagnostics.", "Every lib.dom API or downstream runtime behavior."),
        test("template", "compiler/jsx-types.test.ts", "strict standard DOM JSX typing", "A strict tsc project proves valid event/currentTarget/ref inference and expected invalid forms.", "Runtime platform conformance."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (suffix === "capability-usage-extraction") {
    return {
      ...implemented("extension", [
        implementation("template", "compiler/capability-usage.ts", "collectCapabilityUsages", undefined, "The compiler emits neutral intrinsic transport/operation/static-or-dynamic value facts, events, refs, CSS property values, CSS attribute/pseudo selectors and checker-resolved lib.dom members with exact source ranges.", "Whether the requested platform behavior is implemented or conformant."),
        test("template", "compiler/capability-usage.test.ts", suffix, "Exact neutral usage kinds, literal checkbox/number/range values, dynamic values, attribute selectors, lib.dom symbol resolution, source ranges, immutable cache identity and extension separation are behaviorally proven.", "Renderer matrix resolution or runtime conformance."),
        test("template", "css.test.ts", "CSS shape attribute selectors and values", "The shared CSS shape retains declaration values plus presence/exact-value attribute selectors consumed by capability extraction.", "Complete CSS parsing or Renderer matching."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (suffix === "capability-usage-manifest") {
    return {
      ...implemented("extension", [
        implementation("template", "compiler/capability-manifest.ts", "createCapabilityUsageManifest/serializeCapabilityUsageManifest", undefined, "Neutral usages become one stable, deterministic schema-version-2 interchange manifest without consumer or matrix knowledge.", "Matrix resolution, gap reproduction or runtime conformance."),
        test("template", "compiler/capability-usage.test.ts", suffix, "Manifest sorting, schema version 2, generator version v2 and byte-stable serialization are proven.", "Consumer matrix resolution."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (suffix === "capability-usage-build-lifecycle") {
    return {
      ...implemented("extension", [
        implementation("template", "compiler/bun.ts", "capabilityManifestPath", undefined, "An explicit Bun build option collects successful governed loads and writes one deterministic manifest at build end without inventing an implicit path.", "Consumer identity, matrix policy or runtime conformance."),
        test("template", "compiler/compiler.test.ts", "capabilityManifestPath", "A real Bun build writes one versioned manifest only after the governed build succeeds.", "Renderer matrix resolution or runtime DOM behavior."),
        test("template", "script/package-proof.ts", "capabilityManifestPath", "The packed public Bun plugin exposes and executes the explicit manifest output option.", "Consumer-specific build orchestration."),
      ]),
      lastVerified: templateCapabilityVerification,
    }
  }
  if (suffix === "object-refs") {
    return unsupported(entry, "The governed JSX type profile and compiler admit callback refs only; object refs are rejected before runtime.")
  }
  if (suffix === "static-style-extraction") {
    return implemented("extension", [
      implementation("template", "compiler/style.ts", "component-local css extraction", undefined, "Canonical direct base declarations, non-escaping private same-module reusable CSS constants, bounded & attribute/pseudo selectors and ordered fragments become one compiled sheet plus addressed inline bindings; zero/one-site, exported, multi-declarator and escaping CSS constants fail closed.", "Dynamic non-base selector values, cross-module CSS constants, general selectors, at-rules and complete CSS nesting."),
      implementation("template", "compiled.ts", "CompiledTemplate.styleSheets", undefined, "Immutable stylesheet metadata crosses the compiled-template ABI with exact duplicate collapse and collision rejection.", "Document registration and rendered pixels outside Template."),
      test("template", "compiler/css-style-compiler.test.ts", suffix, "Direct base syntax plus redundant wrapper, zero/one-site, export, multi-declarator and out-of-style CSS constant rejection, scoped selectors, precedence and exact diagnostics.", "Downstream Document/Renderer lifecycle."),
      test("template", "compiled-style-sheet.test.ts", suffix, "Compiled metadata reaches the runtime package without runtime JSX or defineStyles authoring.", "Native browser presentation."),
    ])
  }
  if (suffix === "compiler-diagnostics") {
    return implemented("extension", [
      implementation("template", "compiler/transform.ts", entry.name, undefined, "Governed TSX-to-fixed-slot ABI transform and exact syntax rejection boundary.", "Syntax outside the project profile."),
      test("template", "compiler/compiler.test.ts", entry.name, "General accepted/rejected JSX syntax, symbol resolution, cache invalidation and emitted ABI.", "CSS authoring diagnostics and downstream host behavior."),
      test("template", "compiler/css-style-compiler.test.ts", "canonical CSS diagnostics", "Redundant base wrappers, non-reusable/exported/escaping CSS constants, invalid selectors and dynamic pseudo values fail with exact diagnostics.", "Downstream Document/Renderer lifecycle."),
    ])
  }
  const implementedNames = new Set([
    "intrinsic-elements", "function-components", "nested-components", "props", "children", "primitive-children", "component-children",
    "conditional-branches", "refs", "callback-refs", "event-bindings", "event-capture-bindings", "property-bindings",
    "style-bindings", "source-roots", "dependency-invalidation", "symbol-resolution", "compiler-diagnostics", "browser-target-build",
    "runtime-jsx-fail-closed", "root-render", "memo-components", "keyed-component-map", "multiple-keyed-children", "custom-hooks",
    "hook-order-validation", "react-import-rejection", "dynamic-import-rejection", "dangerously-set-inner-html-rejection",
    "async-component-rejection", "arrow-component-rejection", "early-return-rejection", "component-escape-rejection", "fixed-slot-abi",
  ])
  if (implementedNames.has(suffix)) {
    return implemented("extension", [implementation("template", "compiler/transform.ts", entry.name, undefined, "Governed TSX-to-fixed-slot ABI transform or explicit rejection.", "Syntax outside the project profile."), test("template", "compiler/compiler.test.ts", entry.name, "Accepted/rejected syntax, symbol resolution, cache invalidation, and emitted ABI.", "Downstream host behavior unless covered by integration tests.")])
  }
  const partialNames = new Set(["arrays", "map", "keys", "binding-range-validation", "same-parent-anchor-validation", "binding-realm-validation"])
  if (partialNames.has(suffix)) return partial("extension", [implementation("template", "compiler/transform.ts", entry.name, undefined, "Bounded compiler/ABI branch.", "General arrays or complete anchor/realm validation."), test("template", "compiler/component-children-runtime.test.ts", entry.name, "Current keyed/fixed-slot behavior.", "All general source/runtime forms.")], "Only compiler-owned keyed component maps or partial ABI validation are supported.")
  return unsupported(entry, "The governed TSX compiler rejects this syntax or does not provide the requested diagnostic/source-map contract.")
}

function classifyDevtools(entry: CapabilityInventoryEntry): Classification {
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, devtoolsExportStatus(entry))
  const name = entry.id.slice("devtools.features.".length)
  const implementedNames = new Set(["document-inspector", "stable-node-ids", "subtree-snapshots", "mutation-notifications", "state-notifications", "renderer-projection", "hit-projection", "display-key-projection", "deep-frozen-json", "reverse-reference-release", "disposal"])
  if (implementedNames.has(name)) return implemented("extension", [implementation("renderer", "packages/devtools/src/inspector.ts", name, "31-319", "Pull snapshot/notification inspection bridge.", "Browser panel, editing, transport, or Engine resources."), test("renderer", "packages/devtools/test/dom-inspector.test.ts", name, "Exact identity, snapshots, projection, notifications, and disposal.", "Chrome DevTools integration.")])
  return unsupported(entry, "The inspection bridge intentionally has no panel/editing/transport/React/Engine integration for this capability.")
}

function classifyEngine(entry: CapabilityInventoryEntry): Classification {
  if (
    entry.id.startsWith("platform.") && entry.id.includes("instanced-stroked-path")
    || [
      "InstancedStrokedPath",
      "StrokedPathInstanceLayer",
      "StrokedPathInstanceLayerOptions",
      "STROKED_PATH_STYLE_RECORD_WORDS",
      "STROKED_PATH_STYLE_RECORD_BYTE_LENGTH",
      "STROKED_PATH_SEGMENT_RECORD_WORDS",
      "STROKED_PATH_SEGMENT_RECORD_BYTE_LENGTH",
      "STROKED_PATH_STYLE_OFFSETS",
      "STROKED_PATH_SEGMENT_OFFSETS",
    ].includes(entry.name)
  ) return enginePathWorkingTree(implemented("extension", [
    implementation(
      "engine",
      "packages/core/src/core/instanced-stroked-path.ts",
      entry.name,
      undefined,
      "The public symbol belongs to the exact fixed-stride retained stroked-Path Engine ABI.",
      "DOM/CSS semantics, Renderer batching policy or complete SVG stroking.",
    ),
    test("engine", "packages/core/src/core/instanced-stroked-path.test.ts", entry.name, "Exact constants, slots, generation validation, draw ranges and exact-opaque admission.", "Every GPU/device or consumer integration."),
  ]))
  if (entry.id === "platform.at-engine-core.export-paths.fonts-inter-regular.ttf") {
    return {
      ...implemented("extension", [
        implementation("engine", "packages/core/package.json", "./fonts/inter-regular.ttf", undefined, "The package exports the exact Engine-owned Blender Inter asset.", "Browser route wiring and rendered pixels."),
        test("engine", "packages/core/src/text/default-font-asset.test.ts", "Engine-owned default font asset", "Pinned Blender source/output hashes, OFL provenance, cmap coverage, outlines and tabular digits.", "Live external Storybook activation and rendered glyph pixels."),
      ]),
      lastVerified: engineFontVerification,
    }
  }
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, engineExportStatus(entry))
  const name = entry.id.slice("engine.features.".length)
  if (name === "instanced-stroked-paths") {
    return enginePathWorkingTree({
      ...implemented("extension", [
        implementation("engine", "packages/core/src/core/instanced-stroked-path.ts", "StrokedPathInstanceLayer/InstancedStrokedPath", undefined, "Separate fixed-stride style and sampled-segment InstanceLayers share one unit quad and retained draw-range views.", "DOM, CSS, Node routing or complete vector path semantics."),
        implementation("engine", "packages/core/src/renderer/index.ts", "InstancedStrokedPath pipeline", undefined, "One retained WebGPU pipeline binds shared style/segment/order storage and presentation clips.", "Complete SVG stroking or every GPU adapter."),
        test("engine", "packages/core/src/core/instanced-stroked-path.test.ts", name, "Record layout, stable storage and draw ranges.", "GPU pixels and consumer integration."),
        test("engine", "packages/core/src/core/instance-layer.test.ts", "setOrder/moveRange/orderIndexOf", "Atomic bulk order validation, allocation-free contiguous block moves, exact dirty ranges and O(1) canonical order lookup.", "Renderer Path stacking policy or GPU pixels."),
        test("engine", "packages/core/src/renderer/shaders/stroked-path-instanced.webgpu.test.ts", name, "Actual WebGPU exact-opaque capsule pixels, width, transform and clipping plus fail-closed non-opaque admission.", "Renderer scalar fallback pixels, complete SVG stroking or every device."),
      ]),
      limitations: engineVectorPathLimitations,
    })
  }
  if (name === "bounded-multi-view-frame") {
    return implemented("extension", [
      implementation("engine", "packages/core/src/renderer/index.ts", "Renderer.renderComposition", undefined, "One Renderer/current texture presents a base Space, ordered bounded descendant Spaces and foreground overlays with independent ViewPoints and pass bounds.", "Unrelated post-processing and multi-canvas composition."),
      test("engine", "packages/core/src/renderer/render-composition.test.ts", name, "Root ownership, exclusion, ordering, exact physical viewport validation and legacy delegation.", "GPU pixels on every adapter."),
      {
        type: "integration-test",
        repository: "engine",
        revision: revisions.engine ?? "unknown",
        path: "packages/core/src/renderer/render-composition.webgpu.test.ts",
        symbol: "Renderer bounded composition WebGPU pass",
        proves: "One initialized Renderer/current texture paints the bounded Space background inside its scissor while preserving base pixels outside.",
        doesNotProve: "Every material pipeline or physical GPU adapter.",
      },
    ])
  }
  if (name === "glyph-cache-identity") {
    return {
      ...implemented("extension", [
        {
          ...implementation("engine", "packages/core/src/objects/text.ts", "font-keyed glyph geometry cache", undefined, "A WeakMap owns one glyph-id geometry map per exact TrueTypeFont identity, so equal gids from different fonts cannot share outlines or cover bounds.", "Shaping, fallback selection or cross-process cache behavior."),
          revision: engineTextVerification.revision,
        },
        {
          ...test("engine", "packages/core/src/objects/text.test.ts", "exact font identity and glyph id", "Two fake fonts with the same glyph id and different outlines retain different stencil geometry.", "Every real font file or shaping engine."),
          revision: engineTextVerification.revision,
        },
      ]),
      lastVerified: engineTextVerification,
    }
  }
  if (name === "text" || name === "font-loading") {
    return {
      ...partial(
        "extension",
        [
          {
            ...implementation("engine", "packages/core/src/objects/text.ts", "font-owned Text geometry and advance-cell cover", undefined, "Text uses exact font/glyph cache identity, inserts letter spacing only between code points and covers the complete horizontal advance cell including side bearings.", "Kerning, shaping, ligatures, bidi, fallback or multiline layout."),
            revision: engineTextVerification.revision,
          },
          {
            ...test("engine", "packages/core/src/objects/text.test.ts", "Text font-owned geometry", "The final cover reaches advanceWidth rather than ink xMax and equal gids from different fonts preserve distinct outlines.", "Every real glyph, transform, GPU adapter or shaping mode."),
            revision: engineTextVerification.revision,
          },
          {
            type: "visual-evidence",
            repository: "external",
            revision: "ead10e484f57705410ce58e9",
            path: "storybook://captures/capture_kIyZqHyIxkZgmDu4DCMIa7Er",
            symbol: "@ui/components/components/foundation/button/icon/svg",
            proves: "The default Inter SVG label presents its complete final G through the production Engine text cover on one canvas with zero console errors.",
            doesNotProve: "Every font, glyph, size, transform, device, shaping or fallback path.",
          },
        ],
        "Exact font/glyph cache identity, advance-cell cover geometry and between-codepoint spacing are behaviorally proven; shaping, kerning, ligatures, bidi, fallback and multiline text layout remain unsupported.",
      ),
      lastVerified: engineTextVerification,
    }
  }
  const implementedNames = new Set(["buffer-attributes", "dirty-intervals", "instance-layer", "instanced-rounded-rectangles", "draw-range-views", "clipping", "gpu-device-evidence"])
  if (implementedNames.has(name)) return implemented("extension", [implementation("engine", engineSourcePath(name), name, undefined, "Bounded Engine ABI implementation.", "DOM/CSS semantics and unsupported renderables."), test("engine", engineTestPath(name), name, "Behavioral and, where applicable, real GPU pipeline/pixel evidence.", "Browser integration and unrelated Engine features.")])
  if (name === "texture-device-identity") return unsupportedGap(entry, "Texture and fallback caches are process-global by src rather than scoped by GPUDevice.", "gap.engine.texture-cache-device-identity")
  if (name === "renderer-disposal") return unsupportedGap(entry, "Renderer and TextureLoader have no whole-owner teardown for GPU resources, caches, callbacks, pipelines, or attachments.", "gap.engine.renderer-resource-teardown")
  if (name === "dom-css-ownership-boundary") return unsupportedGap(entry, "@engine/core publicly owns CSS-like LayoutProps/ComputedLayout on Object3D, violating the accepted platform boundary.", "gap.engine.css-layout-ownership")
  if (name === "browser-document-boundary") {
    return {
      status: "partial",
      conformance: "extension",
      limitations: ["Listener-free host ViewPoints are available, but default browser controls and Renderer.init still accept browser-owned HTMLElement/HTMLCanvasElement resources."],
      evidence: [
        implementation("engine", "packages/core/src/core/view-point.ts", "ViewPoint host controls", undefined, "Host mode owns camera math and viewport mapping without browser listeners or element mutation.", "A fully host-neutral Renderer/canvas boundary."),
        test("engine", "packages/core/src/core/view-point.test.ts", name, "Listener-free viewport-aware controls and anchored zoom mapping.", "Default browser controls and Renderer canvas ownership."),
      ],
      blocks: ["gap.engine.browser-document-ownership"],
    }
  }
  if (name === "index-buffer-format") return unverifiedGap(entry, "setIndex accepts arbitrary typed arrays while Renderer binds every non-Uint32 index as uint16; invalid inputs are not rejected.", "gap.engine.index-buffer-format")
  if (name === "material-groups") return unsupportedGap(entry, "Public Mesh documentation promises material arrays mapped to geometry.groups, but BufferGeometry has no groups and Renderer uses material[0].", "gap.engine.material-groups")
  const partialNames = new Set(["scene-graph", "transforms", "world-transform-update", "geometry", "materials", "analytical-ui-materials", "text", "font-loading", "texture-image-loading", "ray-casting", "culling", "view-point", "space", "webgpu-pipelines", "resource-lifetime", "capture-readback", "loaders", "gltf", "animation", "public-math", "device-loss", "legacy-ui-display-flag", "clip-surface-unification"])
  if (partialNames.has(name)) return partial("extension", [implementation("engine", engineSourcePath(name), name, undefined, "Current bounded Engine implementation.", "Complete correctness/lifecycle/conformance contract."), test("engine", engineTestPath(name), name, "Existing focused behavior where available.", "Uncovered branches and browser integration.")], engineLimitation(name))
  return unverified(entry, "A public implementation symbol or contract claim exists, but current behavioral evidence is insufficient for a stronger status.")
}

function classifyPublicExport(entry: CapabilityInventoryEntry, status: CapabilityStatus): Classification {
  const path = typeof entry.metadata?.path === "string" ? entry.metadata.path : undefined
  const [repository, repositoryPath] = path?.includes(":") ? path.split(/:(.*)/s, 2) : [entry.ownerHint.repository, undefined]
  const evidence = repositoryPath
    ? [implementation(repository ?? entry.ownerHint.repository, repositoryPath, entry.name, typeof entry.metadata?.line === "number" ? String(entry.metadata.line) : undefined, "The public export exists at the pinned revision.", "Observable runtime behavior or semantic conformance.")]
    : [implementation(entry.ownerHint.repository, packageManifestPath(entry.ownerHint), entry.name, undefined, "The package export path exists.", "Every symbol and observable behavior behind the path.")]
  if (status === "implemented") {
    evidence.push(test(entry.ownerHint.repository, publicExportTestPath(entry), entry.name, "The bounded project API has behavioral coverage.", "External-standard compatibility unless separately mapped."))
    return implemented("extension", evidence)
  }
  if (status === "partial") return partial("extension", evidence, "The export exists and a bounded implementation is present, but the complete observable contract is not behaviorally covered.")
  if (status === "unsupported") return { status, conformance: "none", limitations: ["The export is an explicit fail-closed unsupported path."], evidence }
  return { status: "unverified", conformance: "unknown", limitations: ["Export/type presence is not behavioral evidence."], evidence }
}

function domExportStatus(entry: CapabilityInventoryEntry): CapabilityStatus {
  if (entry.kind === "package-export-path") return "partial"
  if ([
    "acquireDocumentCompiledStyleSheets",
    "readDocumentCompiledStyleSheets",
    "subscribeDocumentCompiledStyleSheets",
    "acquireDocumentAuthorStyleSheetOwner",
    "readDocumentAuthorStyleSheets",
    "subscribeDocumentAuthorStyleSheets",
  ].includes(entry.name)) return "implemented"
  if (entry.name === "HTMLVectorPathElement") return "implemented"
  return ["Node", "Document", "DocumentFragment", "Text", "Comment", "Element", "Event", "EventTarget"].includes(entry.name) ? "partial" : "unverified"
}

function rendererExportStatus(entry: CapabilityInventoryEntry): CapabilityStatus {
  if (entry.kind === "package-export-path") return "partial"
  if (entry.name === "resolvePointerOwnerHit") return "implemented"
  return ["createDocumentRenderer", "DocumentInteractionController", "hitTest"].includes(entry.name) ? "partial" : "unverified"
}

function browserExportStatus(entry: CapabilityInventoryEntry): CapabilityStatus {
  if (entry.kind === "package-export-path") return "partial"
  if (entry.name === "createBrowserLinkedAuthorStyleSheetHost") return "implemented"
  return entry.kind === "runtime-export" ? "partial" : "unverified"
}

function webgpuExportStatus(entry: CapabilityInventoryEntry): CapabilityStatus {
  if (entry.kind === "package-export-path") return "implemented"
  return ["RendererWebGpuBackend", "RendererWebGpuScreenOverlay", "RendererWebGpuDocumentPlane"].includes(entry.name) ? "implemented" : "unverified"
}

function reactExportStatus(entry: CapabilityInventoryEntry): CapabilityStatus {
  if (entry.kind === "package-export-path") return "partial"
  if (unsupportedReactHooks.has(entry.name)) return "unsupported"
  if (supportedReactHooks.has(entry.name) || ["createRoot", "batch", "component", "keyedComponents", "memo", "createContext", "provideContext", "when"].includes(entry.name)) return "implemented"
  return entry.kind === "type-export" ? "unverified" : "partial"
}

function templateExportStatus(entry: CapabilityInventoryEntry): CapabilityStatus {
  if (entry.kind === "package-export-path") return "partial"
  if (["jsx", "jsxs", "jsxDEV", "Fragment"].includes(entry.name)) return "unsupported"
  if (entry.kind === "runtime-export") return "implemented"
  return "unverified"
}

function devtoolsExportStatus(entry: CapabilityInventoryEntry): CapabilityStatus {
  if (entry.kind === "package-export-path") return "implemented"
  return entry.name === "createDomInspector" ? "implemented" : "unverified"
}

function engineExportStatus(entry: CapabilityInventoryEntry): CapabilityStatus {
  if (entry.kind === "package-export-path") return "partial"
  if (["BufferAttribute", "Float32BufferAttribute", "InstanceLayer", "RoundedRectInstanceLayer", "InstancedRoundedRect", "StrokedPathInstanceLayer", "InstancedStrokedPath"].includes(entry.name)) return "implemented"
  if (["Renderer", "Text", "CachedText", "TextureLoader", "ViewPoint", "Raycaster", "GLTFLoader"].includes(entry.name)) return "partial"
  return "unverified"
}

function implemented(conformance: CapabilityConformance, evidence: EvidenceRecord[]): Classification {
  return { status: "implemented", conformance, limitations: [], evidence }
}

function recovered(classification: Classification): Classification {
  return {
    ...classification,
    evidence: classification.evidence.map((record) => record.repository === "renderer"
      ? {...record, revision: recoveryVerification.revision}
      : record),
    lastVerified: recoveryVerification,
  }
}

function rendererPathWorkingTree(classification: Classification): Classification {
  return {
    ...classification,
    evidence: classification.evidence.map((record) => {
      if (record.repository === "renderer") {
        return {...record, revision: rendererPathVerification.revision}
      }
      if (record.repository === "engine") {
        return {...record, revision: enginePathVerification.revision}
      }
      return record
    }),
    lastVerified: rendererPathVerification,
  }
}

function rendererVerifiedAt(
  classification: Classification,
  verification: Readonly<{revision: string; date: string}>,
): Classification {
  return {
    ...classification,
    evidence: classification.evidence.map(record => record.repository === "renderer"
      ? {...record, revision: verification.revision}
      : record),
    lastVerified: verification,
  }
}

function enginePathWorkingTree(classification: Classification): Classification {
  return {
    ...classification,
    evidence: classification.evidence.map((record) => record.repository === "engine"
      ? {...record, revision: enginePathVerification.revision}
      : record),
    lastVerified: enginePathVerification,
  }
}

function partial(
  conformance: CapabilityConformance,
  evidence: EvidenceRecord[],
  limitation: string,
  stages?: Record<string, CapabilityStatus>,
): Classification {
  return partialClassification(conformance, evidence, limitation, stages)
}

function partialClassification(
  conformance: CapabilityConformance,
  evidence: EvidenceRecord[],
  limitation: string,
  stages?: Record<string, CapabilityStatus>,
): Classification {
  return { status: "partial", conformance, limitations: [limitation], evidence, ...(stages ? { stages } : {}) }
}

function unsupported(entry: CapabilityInventoryEntry, limitation: string, stages?: Record<string, CapabilityStatus>): Classification {
  return { status: "unsupported", conformance: "none", limitations: [limitation], evidence: [externalEvidence(entry)], ...(stages ? { stages } : {}) }
}

function reviewedLeafAbsent(
  entry: CapabilityInventoryEntry,
  limitation: string,
): Classification {
  return {
    ...unsupported(entry, limitation),
    evidence: [
      externalEvidence(entry),
      {
        type: "negative-test",
        repository: "renderer",
        revision: domLeafVerification.revision,
        path: "scripts/capabilities/leaf-support.test.ts",
        symbol: entry.id,
        proves: `The focused runtime-surface audit verifies that ${entry.name} is absent from the current implemented interface object.`,
        doesNotProve: "Future implementation, the complete interface algorithm, or downstream browser behavior.",
      },
    ],
    lastVerified: domLeafVerification,
  }
}

function reviewedCurrent(classification: Classification): Classification {
  return {
    ...classification,
    evidence: classification.evidence.map(record => record.repository === "renderer"
      ? {...record, revision: domLeafVerification.revision}
      : record),
    lastVerified: domLeafVerification,
  }
}

function notApplicable(entry: CapabilityInventoryEntry, reason: string): Classification {
  return { status: "not-applicable", conformance: "none", limitations: [], reason, evidence: [externalEvidence(entry)] }
}

function unverified(entry: CapabilityInventoryEntry, limitation: string): Classification {
  return { status: "unverified", conformance: "unknown", limitations: [limitation], evidence: [projectEvidence(entry)] }
}

function unsupportedGap(entry: CapabilityInventoryEntry, limitation: string, gap: string): Classification {
  return { ...unsupported(entry, limitation), blocks: [gap] }
}

function unverifiedGap(entry: CapabilityInventoryEntry, limitation: string, gap: string): Classification {
  return { ...unverified(entry, limitation), blocks: [gap] }
}

function externalEvidence(entry: CapabilityInventoryEntry): EvidenceRecord {
  if (entry.spec.profile === "project-contract") {
    return {
      type: "requirement",
      repository: entry.ownerHint.repository,
      revision: revisions[entry.ownerHint.repository] ?? entry.spec.version,
      path: requirementPath(entry.ownerHint),
      symbol: entry.name,
      proves: `The pinned project inventory contains ${entry.id}.`,
      doesNotProve: "Runtime implementation or observable conformance.",
    }
  }
  return {
    type: "external-spec",
    repository: "external",
    revision: entry.spec.version,
    path: entry.spec.anchor,
    proves: `The pinned ${entry.spec.profile ?? "standard"} inventory contains ${entry.id}.`,
    doesNotProve: "Runtime implementation or observable conformance.",
  }
}

function projectEvidence(entry: CapabilityInventoryEntry): EvidenceRecord {
  if (entry.spec.profile !== "project-contract") return externalEvidence(entry)
  return {
    type: "requirement",
    repository: entry.ownerHint.repository,
    revision: revisions[entry.ownerHint.repository] ?? entry.spec.version,
    path: requirementPath(entry.ownerHint),
    symbol: entry.name,
    proves: "The owner contract or public export claims this bounded capability.",
    doesNotProve: "Observable implementation behavior.",
  }
}

function implementation(
  repository: string,
  path: string,
  symbol: string,
  lines: string | undefined,
  proves: string,
  doesNotProve: string,
): EvidenceRecord {
  return {
    type: "implementation",
    repository,
    revision: revisions[repository] ?? "unknown",
    path,
    symbol,
    ...(lines ? { lines } : {}),
    proves,
    doesNotProve,
  }
}

function test(
  repository: string,
  path: string,
  symbol: string,
  proves: string,
  doesNotProve: string,
): EvidenceRecord {
  return { type: path.includes("browser") && path.includes("e2e") ? "browser-e2e" : "unit-test", repository, revision: revisions[repository] ?? "unknown", path, symbol, proves, doesNotProve }
}

function domImplementation(entry: CapabilityInventoryEntry): EvidenceRecord {
  return implementation("renderer", domSourcePath(entry), entry.name, undefined, "The bounded semantic DOM implementation exists.", "The complete referenced standard algorithm.")
}

function domSourcePath(entry: CapabilityInventoryEntry): string {
  if (entry.id.includes("input")) return "packages/dom/src/html-input-element.ts"
  if (entry.id.includes("textarea")) return "packages/dom/src/html-text-area-element.ts"
  if (entry.id.includes("select") || entry.id.includes("option")) return "packages/dom/src/html-select-element.ts"
  if (entry.id.includes("popover")) return "packages/dom/src/internal/popover.ts"
  if (entry.id.includes("event")) return "packages/dom/src/event-target.ts"
  if (entry.id.includes("element")) return "packages/dom/src/element.ts"
  return "packages/dom/src/node.ts"
}

function eventSourcePath(entry: CapabilityInventoryEntry): string {
  const candidates = ["composition", "focus", "input", "keyboard", "mouse", "pointer", "ui", "wheel"]
  const normalizedId = entry.id.toLowerCase()
  const owner = candidates.find((candidate) => normalizedId.includes(`.${candidate}event`) || normalizedId.includes(`.${candidate}-event`))
  return `packages/dom/src/${owner ?? "event"}-event.ts`
}

function controlTestPath(id: string): string {
  if (id.includes("textarea") || id.includes("input-selection")) return "packages/dom/test/text-input-events.test.ts"
  if (id.includes("select") || id.includes("option")) return "packages/dom/test/select-option.test.ts"
  if (id.includes("popover")) return "packages/dom/test/popover.test.ts"
  return "packages/dom/test/html-input-element.test.ts"
}

function htmlInputLeafTest(entry: CapabilityInventoryEntry): EvidenceRecord {
  const reflectedMember = /^HTMLInputElement\.(.+) reflection$/.exec(entry.name)?.[1]
  const member = reflectedMember ?? entry.name
  if (["indeterminate", "max", "min", "step", "valueAsNumber"].includes(member)) {
    return test(
      "renderer",
      "packages/dom/test/input-numeric-state.test.ts",
      member,
      `The focused numeric/control-state suite exercises the implemented ${member} member.`,
      "Forms, validation, picker behavior, and other input states.",
    )
  }
  if (["select", "selectionDirection", "selectionEnd", "selectionStart", "setSelectionRange"].includes(member)) {
    return test(
      "renderer",
      "packages/dom/test/text-selection.test.ts",
      member,
      `The focused text-selection suite exercises the implemented ${member} member and its applicability boundary.`,
      "Standard Selection/Range, proportional geometry, and every input state.",
    )
  }
  return test(
    "renderer",
    "packages/dom/test/html-input-element.test.ts",
    member,
    `The focused HTMLInputElement suite exercises the implemented ${member} reflection or live-state member.`,
    "Every input state, form algorithm, validation, and browser-owned interaction.",
  )
}

function cssDefaultStages(): Record<string, CapabilityStatus> {
  return {
    parse: "partial",
    cascade: "partial",
    computed: "unsupported",
    layout: "unsupported",
    paint: "unsupported",
    "hit-test": "unsupported",
    webgpu: "unsupported",
    browser: "unsupported",
    evidence: "implemented",
  }
}

function cssVariableStages(
  stages: Record<string, CapabilityStatus>,
): Record<string, CapabilityStatus> {
  return {
    ...stages,
    parse: "partial",
    cascade: "partial",
    computed: "partial",
    layout: "partial",
    paint: "partial",
    "hit-test": "partial",
    webgpu: "partial",
    browser: "partial",
  }
}

function cssPropertyStages(name: string): Record<string, CapabilityStatus> {
  const paint = paintProperties.has(name)
  const hit = hitProperties.has(name)
  const layout = layoutProperties.has(name)
  return {
    parse: "partial",
    cascade: "partial",
    computed: "partial",
    layout: layout ? "partial" : "not-applicable",
    paint: paint ? "partial" : "not-applicable",
    "hit-test": hit ? "partial" : "not-applicable",
    webgpu: paint ? "partial" : "not-applicable",
    browser: hit ? "partial" : "not-applicable",
    evidence: "implemented",
  }
}

function cssPropertyLimitation(name: string): string {
  if (["color", "background", "background-color", "border-color"].includes(name)) return "Only the bounded canonical computed-color transport is implemented; unsupported CSS Color forms are discarded before display projection."
  if (name === "box-shadow") return "Only one bounded outer analytical shadow is parsed and transported."
  if (name.includes("border") || name.includes("radius")) return "Rounded/nonuniform/multicolor combinations exceed the bounded backend contract and fail closed."
  if (name.startsWith("flex") || name === "align-items" || name === "align-content" || name === "justify-content") return "Balance, reverse main axes, flex-flow, order, align-self, percentage gaps, gap decorations/rules, writing modes, and complete intrinsic multi-line Flexbox sizing remain unsupported."
  if (name === "transform" || name === "transform-origin") return "Only axis-aligned translate/scale transforms are supported; rotate/skew/matrix/3D are absent."
  return "Only the explicitly admitted property values and bounded CPU/backend algorithms are implemented."
}

function cssTestPath(name: string): string {
  if (name.includes("overflow") || name.includes("scrollbar")) return "packages/core/test/overflow.test.ts"
  if (name.includes("transform")) return "packages/core/test/transform.test.ts"
  if (name.includes("z-index")) return "packages/core/test/z-index.test.ts"
  if (name.includes("shadow")) return "packages/core/test/box-shadow.test.ts"
  if (name.includes("border") || name.includes("background") || name === "color" || name === "opacity") return "packages/core/test/renderer.test.ts"
  if (name === "gap" || name === "row-gap" || name === "column-gap") return "packages/core/test/gap.test.ts"
  if (name.startsWith("flex") || name === "align-items" || name === "align-content" || name === "justify-content") return "packages/core/test/renderer.test.ts"
  return "packages/core/test/renderer.test.ts"
}

function rendererTestPath(name: string): string {
  if (name.includes("scroll") || name === "overflow" || name === "clip-stacks") return "packages/core/test/overflow.test.ts"
  if (name.includes("transform")) return "packages/core/test/transform.test.ts"
  if (name.includes("incremental") || name.includes("fast-path") || name === "invalidation") return "packages/core/test/incremental.test.ts"
  if (name.includes("pointer") || name.includes("wheel") || name.includes("activation") || name.includes("hit")) return "packages/core/test/interaction.test.ts"
  if (name.includes("title") || name.includes("tooltip")) return "packages/core/test/interaction.test.ts"
  return "packages/core/test/renderer.test.ts"
}

function rendererLimitation(name: string): string {
  if (name === "invalidation" || name === "incremental-patches" || name.includes("fast-path")) return "Dirty bookkeeping exists, but general dirty frames still remeasure/place/re-emit; only narrow Text, input-value and transform fast paths reuse records."
  if (name.includes("typography") || name.includes("line-breaking")) return "Text measurement is an adapted fixed advance model without shaping, kerning, bidi, fallback, or full inline formatting."
  return "The CPU owner implements only the bounded DOM/CSS/WebGPU UI subset documented by focused tests."
}

function browserSourcePath(name: string): string {
  if (name.includes("multiple") || name.includes("camera") || name.includes("experience")) return "packages/browser/src/space-runtime.ts"
  if (name.includes("plane")) return "packages/browser/src/plane-runtime.ts"
  if (name.includes("overlay")) return "packages/browser/src/overlay-runtime.ts"
  if (name.includes("input") || name.includes("keyboard") || name.includes("composition") || name.includes("selection") || name.includes("cancellation")) return "packages/browser/src/native-input-host.ts"
  return "packages/browser/src/runtime.ts"
}

function browserTestPath(name: string): string {
  if (name.includes("multiple") || name.includes("camera") || name.includes("experience")) return "packages/browser/test/space-runtime.test.ts"
  if (name.includes("plane")) return "packages/browser/test/plane-runtime.test.ts"
  if (name.includes("overlay")) return "packages/browser/test/overlay-runtime.test.ts"
  if (name.includes("input") || name.includes("keyboard") || name.includes("composition") || name.includes("selection") || name.includes("cancellation")) return "packages/browser/test/native-input-host.test.ts"
  return "packages/browser/test/runtime.test.ts"
}

function webgpuLimitation(name: string): string {
  if (name === "colors") return "Transport accepts transparent, hex, and rgb/rgba only; it is not a CSS Color implementation."
  if (name === "borders" || name === "radii") return "Different visible border colors, nonuniform rounded borders, and elliptical clips can fail closed."
  if (name === "text") return "Requires one external TrueTypeFont and does not prove real glyph pixels in this checkout."
  if (name === "image" || name === "texture-readiness") return "Image readiness is signaled by the Engine/host and actual fetch/decode remains outside the backend."
  return "Implemented only for display-list values admitted by frame validation and retained materialization."
}

function reactHookLimitation(name: string): string {
  if (["useEffect", "useLayoutEffect", "useInsertionEffect"].includes(name)) return "Commit ordering is bounded and synchronous; passive effects are not browser-after-paint and StrictMode replay is absent."
  if (name === "useSyncExternalStore") return "Client subscription identity is implemented, but getServerSnapshot/SSR behavior is not."
  if (name === "useDebugValue") return "Debug values are retained, but no inspection integration exposes them."
  return "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
}

function engineSourcePath(name: string): string {
  if (name.includes("texture")) return "packages/core/src/loaders/texture-loader.ts"
  if (name.includes("glyph") || name === "text" || name.includes("font")) return "packages/core/src/objects/text.ts"
  if (name.includes("instance") || name.includes("rounded") || name.includes("draw-range")) return "packages/core/src/core/instance-layer.ts"
  if (name.includes("buffer") || name.includes("dirty")) return "packages/core/src/core/buffer-attribute.ts"
  if (name.includes("clip")) return "packages/core/src/renderer/index.ts"
  if (name.includes("view") || name.includes("browser-document")) return "packages/core/src/core/view-point.ts"
  if (name.includes("layout") || name.includes("ownership") || name.includes("scene") || name.includes("transform")) return "packages/core/src/core/object-3d.ts"
  if (name.includes("gltf") || name === "loaders") return "packages/core/src/loaders/gltf-loader.ts"
  return "packages/core/src/renderer/index.ts"
}

function engineTestPath(name: string): string {
  if (name.includes("instance") || name.includes("rounded") || name.includes("draw-range")) return "packages/core/src/core/instance-layer.test.ts"
  if (name.includes("buffer") || name.includes("dirty")) return "packages/core/src/core/buffer-attribute.test.ts"
  if (name.includes("clip") || name.includes("gpu-device")) return "packages/core/src/renderer/shaders/presentation-clip.webgpu.test.ts"
  if (name.includes("view")) return "packages/core/src/core/view-point.test.ts"
  return "packages/core/src/renderer/dpr-viewport.test.ts"
}

function engineLimitation(name: string): string {
  if (name === "text" || name === "font-loading") return "No shaping, kerning, ligatures, bidi, multiline layout, or direct Text geometry behavioral suite; cache identity also has a font-key correctness gap."
  if (name === "resource-lifetime" || name === "device-loss") return "No whole-renderer/texture-cache teardown or device-loss recovery contract exists."
  if (name === "ray-casting") return "Mesh uses bounding-sphere hits; Text, lines, rounded rectangles, and instances lack exact per-primitive ray tests."
  if (name === "gltf" || name === "animation") return "A bounded implementation exists without focused behavioral tests for many admitted branches."
  return "Implementation exists, but the public lifecycle/value space or focused behavioral evidence is incomplete."
}

function isHtmlNotApplicable(entry: CapabilityInventoryEntry): boolean {
  const id = entry.id.toLowerCase()
  return htmlNotApplicableTokens.some((token) => id.includes(token))
}

function htmlNotApplicableReason(entry: CapabilityInventoryEntry): string {
  if (/media|audio|video|track/.test(entry.id)) return "This platform is a WebGPU UI renderer, not an HTML media playback user agent; media resource selection/playback/tracks remain outside the accepted owner graph."
  if (/canvas|offscreencanvas/.test(entry.id)) return "Engine/WebGPU presentation owns the host canvas; semantic HTML Canvas2D/WebGL context APIs would create a parallel rendering surface and are outside the accepted architecture."
  if (/window|worker|history|navigation|storage|broadcastchannel/.test(entry.id)) return "Browsing-context, navigation, worker, and storage APIs are outside the Document-scoped UI platform contract."
  if (/script|styleelement|linkelement|metaelement|baseelement/.test(entry.id)) return "Executable/resource-owning document elements are outside the compiled Template and bounded semantic DOM runtime."
  return "The capability belongs to a full browsing user agent rather than the accepted semantic DOM to CPU Renderer to retained WebGPU platform."
}

function packageManifestPath(owner: CapabilityOwner): string {
  if (owner.repository === "template") return "package.json"
  if (owner.repository === "engine") return "packages/core/package.json"
  const packageDir: Record<string, string> = {
    "@zavx0z/dom": "dom",
    "@zavx0z/renderer": "core",
    "@zavx0z/renderer-browser": "browser",
    "@zavx0z/renderer-webgpu": "webgpu",
    "@zavx0z/react": "react",
    "@zavx0z/dom-devtools": "devtools",
  }
  return `packages/${packageDir[owner.package] ?? "unknown"}/package.json`
}

function requirementPath(owner: CapabilityOwner): string {
  if (owner.repository === "template") return "requirements.md"
  if (owner.repository === "engine") return "packages/core/contract.md"
  const packageDir: Record<string, string> = {
    "@zavx0z/dom": "dom",
    "@zavx0z/renderer": "core",
    "@zavx0z/renderer-browser": "browser",
    "@zavx0z/renderer-webgpu": "webgpu",
    "@zavx0z/react": "react",
    "@zavx0z/dom-devtools": "devtools",
  }
  return `packages/${packageDir[owner.package] ?? "unknown"}/requirements.md`
}

function ownerTestPath(owner: CapabilityOwner): string {
  if (owner.repository === "template") return "compiled.test.ts"
  if (owner.repository === "engine") return "packages/core/src/renderer/dpr-viewport.test.ts"
  const packageDir: Record<string, string> = {
    "@zavx0z/dom": "dom/test/tree.test.ts",
    "@zavx0z/renderer": "core/test/renderer.test.ts",
    "@zavx0z/renderer-browser": "browser/test/runtime.test.ts",
    "@zavx0z/renderer-webgpu": "webgpu/test/webgpu-backend.test.ts",
    "@zavx0z/react": "react/test/runtime.test.ts",
    "@zavx0z/dom-devtools": "devtools/test/dom-inspector.test.ts",
  }
  return `packages/${packageDir[owner.package] ?? "unknown"}`
}

function publicExportTestPath(entry: CapabilityInventoryEntry): string {
  if (entry.name.includes("AuthorStyleSheet") && entry.ownerHint.package === "@zavx0z/dom") {
    return "packages/dom/test/author-style-sheet.test.ts"
  }
  if (entry.name === "createBrowserLinkedAuthorStyleSheetHost") {
    return "packages/browser/test/linked-author-style-sheet-host.test.ts"
  }
  return ownerTestPath(entry.ownerHint)
}

const supportedCssProperties = new Set([
  "display", "box-sizing", "flex-direction", "flex-grow", "flex-shrink", "flex-basis", "flex", "align-items", "align-content", "justify-content", "gap", "row-gap", "column-gap",
  "width", "height", "min-width", "min-height", "max-width", "max-height", "inline-size", "block-size", "min-inline-size", "min-block-size", "max-inline-size", "max-block-size",
  "position", "left", "top", "right", "bottom", "transform", "transform-origin", "box-shadow", "z-index",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "margin-inline", "margin-block", "margin-inline-start", "margin-inline-end", "margin-block-start", "margin-block-end",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-inline", "padding-block", "padding-inline-start", "padding-inline-end", "padding-block-start", "padding-block-end",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-width", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-style", "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "background", "background-color", "color", "font-size", "line-height", "letter-spacing", "opacity", "overflow", "overflow-x", "overflow-y", "scrollbar-width", "object-fit", "text-align", "text-overflow", "white-space",
])

const computedColorPropertyIds = new Set([
  "css.properties.background",
  "css.properties.background-color",
  "css.properties.color",
  "css.properties.border-color",
  "css.properties.border-top-color",
  "css.properties.border-right-color",
  "css.properties.border-bottom-color",
  "css.properties.border-left-color",
])

const layoutProperties = new Set([...supportedCssProperties].filter((name) => !["background", "background-color", "color", "opacity", "box-shadow", "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"].includes(name)))
const paintProperties = new Set(["display", "background", "background-color", "color", "opacity", "box-shadow", "border", "border-top", "border-right", "border-bottom", "border-left", "border-width", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-style", "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius", "font-size", "line-height", "letter-spacing", "object-fit", "text-align", "text-overflow", "white-space", "overflow", "overflow-x", "overflow-y", "scrollbar-width", "transform"])
const hitProperties = new Set(["display", "position", "left", "top", "right", "bottom", "z-index", "overflow", "overflow-x", "overflow-y", "transform", "transform-origin"])
const supportedSelectors = new Set([">", ":active", ":checked", ":disabled", ":focus", ":focus-within", ":hover", ":indeterminate", ":root"])
const supportedCssFunctions = new Set(["rgb()", "rgba()", "translate()", "translateX()", "translateY()", "scale()", "scaleX()", "scaleY()"])
const supportedCssTypes = new Set(["alpha-value", "color", "hex-color", "integer", "length", "length-percentage", "named-color", "number", "percentage", "position", "shadow", "transform-function"])

const supportedReactHooks = new Set(["useCallback", "useContext", "useDebugValue", "useEffect", "useEffectEvent", "useId", "useImperativeHandle", "useInsertionEffect", "useLayoutEffect", "useMemo", "useReducer", "useRef", "useState", "useSyncExternalStore"])
const unsupportedReactHooks = new Set(["use", "useActionState", "useDeferredValue", "useOptimistic", "useTransition"])
const supportedReactSemanticIds = new Set([
  "react.semantics.function-components", "react.semantics.nested-components", "react.semantics.component-identity", "react.semantics.props",
  "react.semantics.children", "react.semantics.keys", "react.semantics.callback-refs", "react.semantics.memo", "react.semantics.context",
  "react.semantics.create-root", "react.semantics.render-update", "react.semantics.unmount", "react.semantics.batching",
  "react.semantics.render-phase-updates", "react.semantics.commit-phases", "react.semantics.cleanup", "react.semantics.failed-render-isolation",
  "react.semantics.conditional-ranges", "react.semantics.custom-hooks", "react.semantics.low-level-context-providers",
  "react.semantics.template-compiler-abi", "react.semantics.template-compiler-integration", "react.semantics.tsx-authoring",
  "react.semantics.browser-target-build", "react.semantics.static-template-identity",
])

const htmlNotApplicableTokens = [
  ".htmlaudioelement", ".htmlvideoelement", ".htmlmediaelement", ".audiotrack", ".videotrack", ".texttrack",
  ".htmlcanvaselement", ".canvasrenderingcontext", ".offscreencanvas", ".imagedata", ".imagebitmap",
  ".window", ".history", ".navigation", ".navigator", ".worker", ".storage", ".broadcastchannel",
  ".htmlscriptelement", ".htmlstyleelement", ".htmllinkelement", ".htmlmetaelement", ".htmlbaseelement",
  "html.elements.audio", "html.elements.video", "html.elements.canvas", "html.elements.iframe", "html.elements.embed", "html.elements.object", "html.elements.script", "html.elements.style", "html.elements.link", "html.elements.meta", "html.elements.base",
  "html.behaviors.media", "html.behaviors.canvas", "html.behaviors.links-navigation", "html.behaviors.resource-loading",
]

await main()
