import { resolve } from "node:path"
import {
  CAPABILITY_SCHEMA_VERSION,
  GENERATOR_VERSION,
  readJson,
  rendererRoot,
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
const flexWrapVerification = {
  revision: "6aac3e2960ff04ff2450c605c25fd1c54dfc081e+dirty",
  date: "2026-08-30",
} as const
const storybookAggregateRevision = "035d5fbb559ddf886c38f5c212e0e6484c8d5e75+dirty"
const revisions: Record<string, string> = {
  renderer: "3c91038c3f14ccc44616209fd82b1e59b7369408",
  template: "87d0ec3d2a9f19c3750d567ee20dc4bace995e90",
  engine: "18c55d6c3dc68d1f2ab257378a505e5bac2eea3e",
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
    const output = overlayPaths[packageName]
    if (!output) throw new Error(`No support overlay path for ${packageName}`)
    const repository = packageEntries[0]?.ownerHint.repository
    if (!repository) throw new Error(`No repository for ${packageName}`)
    const revision = revisions[repository]
    if (!revision) throw new Error(`No revision for ${repository}`)
    const records = packageEntries
      .map((entry) => supportRecord(entry, classify(entry)))
      .sort((left, right) => left.id.localeCompare(right.id))
    const overlay: SupportOverlay = {
      schemaVersion: CAPABILITY_SCHEMA_VERSION,
      generatorVersion: GENERATOR_VERSION,
      repository,
      package: packageName,
      revision,
      verificationDate,
      records,
    }
    await writeJsonIfChanged(output, overlay)
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
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, domExportStatus(entry))
  if (entry.domain === "dom") return classifyDom(entry)
  return classifyHtml(entry)
}

function classifyDom(entry: CapabilityInventoryEntry): Classification {
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
  if (id.startsWith("dom.interfaces.event")) {
    return partial("adapted", [implementation("renderer", "packages/dom/src/event.ts", "Event", "9-80", "Event state, cancellation, phases, and propagation controls.", "High-resolution timestamp and every legacy field."), test("renderer", "packages/dom/test/event.test.ts", "Event behavioral tests", "Core observable dispatch state and cancellation.", "All legacy and browser-trusted semantics.")], "Event.timeStamp uses Date.now and the complete legacy/composed surface is not behaviorally proven.")
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
    return specialized.has(tag)
      ? partial("adapted", [implementation("renderer", "packages/dom/src/document.ts", "HTML_ELEMENT_FACTORIES", "66-96", "Exact specialized constructor mapping for the supported tag subset.", "The complete per-element interface surface."), test("renderer", "packages/dom/test/structural-elements.test.ts", tag, "Current prototype mapping.", "Complete element algorithms.")], "The constructor mapping exists while the full interface behavior does not.")
      : unsupported(entry, "The tag is created as a generic HTMLElement or is outside the bounded platform, not as its specified specialized interface.")
  }
  if (entry.kind === "activation-behavior") return partial("adapted", [implementation("renderer", "packages/dom/src/html-element.ts", "activation hooks", undefined, "Bounded focus/click/control activation hooks.", "Form submission, navigation, media, and other tag-specific default actions."), test("renderer", "packages/dom/test/event.test.ts", "activation behavior", "Current checkbox/radio and subclass hook behavior.", "Complete tag-specific default action.")], "Only checkbox/radio and bounded button/control hooks have owner behavior.")
  return partial("adapted", [implementation("renderer", "packages/dom/src/document.ts", "createElement", "98-159", "Stable semantic element identity for the standard tag name.", "The tag's complete HTML contract."), test("renderer", "packages/dom/test/structural-elements.test.ts", tag, "Current element construction/prototype subset.", "Complete default behavior and accessibility semantics.")], specialized.has(tag) ? "A specialized class exists but implements only the bounded UI subset." : "A generic HTMLElement preserves tag identity but not the specialized HTML interface or behavior.")
}

function classifyHtmlAttribute(entry: CapabilityInventoryEntry): Classification {
  const implemented = new Set(["id", "class", "title", "tabindex", "hidden", "popover", "disabled", "checked", "value", "type", "selected", "src", "alt", "width", "height"])
  if (implemented.has(entry.name.toLowerCase())) {
    return partial("adapted", [implementation("renderer", "packages/dom/src/element.ts", entry.name, undefined, "Content-attribute storage and selected reflected state.", "The full attribute-specific HTML algorithm."), test("renderer", "packages/dom/test/html-input-element.test.ts", entry.name, "Bounded reflected/control behavior.", "All elements and attribute modes.")], "The platform implements selected reflection/live-state branches, not the complete attribute contract on every applicable element.")
  }
  return partial("adapted", [implementation("renderer", "packages/dom/src/element.ts", "setAttribute/getAttribute", undefined, "Generic string content-attribute storage.", "Attribute-specific reflection or default behavior."), test("renderer", "packages/dom/test/tree.test.ts", "attribute storage", "Generic attribute mutation.", `Specific semantics for ${entry.name}.`)], "Stored as a generic content attribute; no attribute-specific algorithm was found.")
}

function classifyHtmlBehavior(entry: CapabilityInventoryEntry): Classification {
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
  const supportedInterfaces = [
    "htmlelement", "htmlbuttonelement", "htmlinputelement", "htmlimageelement", "htmllabelelement", "htmlfieldsetelement",
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
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, rendererExportStatus(entry))
  if (entry.domain === "css") return classifyCss(entry)
  return classifyRenderer(entry)
}

function classifyCss(entry: CapabilityInventoryEntry): Classification {
  const defaultStages = cssDefaultStages()
  const external = externalEvidence(entry)
  if (entry.kind === "property") {
    if (entry.id === "css.properties.flex-wrap") {
      return {
        status: "partial",
        conformance: "adapted",
        limitations: [
          "Bounded to nowrap, wrap, and wrap-reverse on the existing row/column Flex subset: row wrapping uses its definite or auto-fill width, column wrapping requires a definite height, and one scalar gap serves both axes; balance and other invalid values are discarded before cascade priority, while align-content, row-gap/column-gap, flex-flow, row-reverse/column-reverse, order, align-self, and complete intrinsic multi-line sizing remain unsupported.",
        ],
        evidence: [
          external,
          {
            ...implementation("renderer", "packages/core/src/css.ts", "ComputedStyle.flexWrap/parseFlexWrap", undefined, "The computed-style stage admits nowrap, wrap, and wrap-reverse with nowrap as the initial value.", "The balance value, CSS-wide keywords, animation, CSSOM serialization, and complete Flexbox grammar."),
            revision: flexWrapVerification.revision,
          },
          {
            ...implementation("renderer", "packages/core/src/renderer.ts", "createFlexLines/placeFlexChildren", undefined, "The CPU layout stage forms bounded row or column flex lines, distributes main-axis flex sizing per line, and reverses the cross-axis line order for wrap-reverse.", "align-content, separate row/column gaps, reverse main axes, order/align-self, or complete intrinsic multi-line Flexbox sizing."),
            revision: flexWrapVerification.revision,
          },
          {
            ...test("renderer", "packages/core/test/flex-wrap.test.ts", "flex-wrap", "Observable computed values and frame boxes prove keyword validation, variable substitution, invalid-declaration cascade fallback, nowrap, definite-width row wrapping with auto cross growth, per-line grow/shrink/justification/alignment, definite-height column wrapping, auto-height non-wrapping, scalar gap, oversized-base line isolation, and wrap-reverse cross-end packing.", "Full CSS Flexbox conformance, native browser pixels, or the unsupported values and properties named in the limitation."),
            revision: flexWrapVerification.revision,
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
        lastVerified: flexWrapVerification,
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
    return partial(
      "adapted",
      [
        external,
        implementation("renderer", "packages/core/src/css.ts", "CustomPropertyResolver/substituteVariables", undefined, "Case-sensitive inherited custom-property environments and cycle-aware var() substitution for admitted longhands, one border/shadow path and nested color/calc functions.", "The complete CSS Variables grammar, typed properties, animation and every variable-bearing shorthand."),
        test("renderer", "packages/core/test/custom-properties.test.ts", "var()", "Nested fallback, cycles, casing, pseudo overrides, inline precedence, foundation/semantic/component aliases, focused border colors, rgb alpha, calc and one thousand instance values.", "Escaped names, every declaration grammar and full browser conformance."),
        test("renderer", "packages/react/test/compiler.test.ts", "compiled custom-property pseudo", "Exact authored TSX executes through Template metadata, React adoption and CPU hover substitution with one shared pseudo sheet.", "Live browser/WebGPU pixels and unrelated Template syntax."),
      ],
      "Implemented for admitted longhands, one solid border/border-color, one shadow and current background/color/sizing/transform/calc paths; other multi-value shorthands, escaped names, @property and animation remain unsupported.",
      cssVariableStages(defaultStages),
    )
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
  if (entry.kind === "data-type" && supportedCssTypes.has(entry.name)) {
    return partial("adapted", [external, implementation("renderer", "packages/core/src/css.ts", entry.name, undefined, "Bounded value parsing.", "The full data type grammar."), test("renderer", "packages/core/test/renderer.test.ts", entry.name, "Current bounded values.", "Full value space and interpolation semantics.")], "Only px/unitless/percentage and bounded color/number branches used by current properties are accepted.", defaultStages)
  }
  if (entry.id.startsWith("css.features.")) return classifyCssFeature(entry, defaultStages)
  if (entry.id.startsWith("css.cssom.")) return unsupported(entry, "The CPU renderer owns internal style data only; it does not expose the CSSOM interface in this pinned IDL row.", defaultStages)
  return { status: "unsupported", conformance: "none", limitations: ["No implementation of this pinned CSS feature was found."], evidence: [external], stages: defaultStages }
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
  if (suffix === "custom-properties") {
    return partialClassification(
      "adapted",
      [
        externalEvidence(entry),
        implementation("renderer", "packages/core/src/css.ts", "ComputedCustomProperties", undefined, "Ordinary case-sensitive custom-property cascade, sparse inheritance and cycle-aware substitution through admitted border, shadow, color and dimensional function paths.", "Full CSS Variables, CSSOM, typed custom properties and animation."),
        test("renderer", "packages/core/test/custom-properties.test.ts", suffix, "Inheritance identity, aliases, fallback/cycles, casing, pseudo changes, border/shadow, rgb/calc, descendant invalidation, consumer precedence and one thousand instances.", "Every grammar and native browser behavior."),
        test("renderer", "packages/react/test/compiler.test.ts", "exact dynamic pseudo authoring", "One shared compiled pseudo sheet consumes two instance-specific inline custom values and updates while hovered.", "Live browser/WebGPU pixels."),
      ],
      "Bounded to unescaped custom names and var() in admitted longhands, one border/border-color, one shadow and background/color/sizing/transform/calc paths; CSS-wide semantics, !important, @property, animation and other multi-value shorthands remain unsupported.",
      cssVariableStages(stages),
    )
  }
  if (partial.has(suffix)) return partialClassification("adapted", [externalEvidence(entry), implementation("renderer", "packages/core/src/css.ts", entry.name, undefined, "Bounded CSS stage implementation.", "Complete CSS module algorithms."), test("renderer", "packages/core/test/renderer.test.ts", entry.name, "Current bounded behavior.", "Full conformance.")], "Only the explicitly admitted values/algorithms are implemented.", stages)
  return { status: "unsupported", conformance: "none", limitations: ["The current stylesheet/cascade/layout pipeline does not implement this CSS module capability."], evidence: [externalEvidence(entry)], stages }
}

function classifyRenderer(entry: CapabilityInventoryEntry): Classification {
  if (!entry.id.startsWith("renderer.features.")) return unsupported(entry, "No current CPU renderer evidence was mapped.")
  const name = entry.id.slice("renderer.features.".length)
  if (name === "flex-layout") {
    return {
      status: "partial",
      conformance: "adapted",
      limitations: [
        "The bounded owner supports row/column single-line Flex and nowrap/wrap/wrap-reverse multi-line packing with one scalar gap and per-line grow/shrink/justification/align-items; balance, reverse main axes, flex-flow, order, align-self, align-content, separate row/column gaps, and complete intrinsic multi-line Flexbox sizing remain unsupported.",
      ],
      evidence: [
        {
          type: "requirement",
          repository: "renderer",
          revision: flexWrapVerification.revision,
          path: "packages/core/requirements.md",
          symbol: "RENDERER-CPU-004",
          proves: "The owner contract defines the bounded multi-line Flex semantics and explicit exclusions.",
          doesNotProve: "Runtime behavior or full CSS Flexbox conformance.",
        },
        {
          ...implementation("renderer", "packages/core/src/renderer.ts", "createFlexLines/placeFlexChildren", undefined, "The CPU owner implements single-line and bounded multi-line row/column Flex placement.", "The excluded Flexbox values and complete standard algorithms."),
          revision: flexWrapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/renderer.test.ts", "production CSS box and flex slice", "Observable frames prove the existing bounded single-line grow/shrink/justification/alignment contract.", "Multi-line packing and full CSS Flexbox conformance."),
          revision: flexWrapVerification.revision,
        },
        {
          ...test("renderer", "packages/core/test/flex-wrap.test.ts", "flex-wrap", "Observable computed values and frame boxes prove the bounded row/column nowrap, wrap, wrap-reverse, per-line sizing/alignment, gap, definite-boundary, and cross-axis reversal contract.", "Full CSS Flexbox conformance and the explicitly excluded values."),
          revision: flexWrapVerification.revision,
        },
      ],
      lastVerified: flexWrapVerification,
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
    return partial(
      "adapted",
      [
        implementation("renderer", "packages/core/src/interaction.ts", "resolvePointerOwnerHit", undefined, "Deepest pointer targets retain ordinary dispatch while nearest interactive/disabled ancestors own focus, disabled state and cross-descendant activation continuity.", "The complete Pointer Events hit-testing, capture and browser default-action standards."),
        test("renderer", "packages/core/test/interaction.test.ts", name, "Nested target bubbling, same-descendant click target, cross-descendant owner activation, disabled suppression, ordinary noninteractive click and cancel cleanup.", "Native browser trusted events and every interactive HTML element."),
      ],
      "Implemented for the bounded rendered-control set; complete browser Pointer Events and default actions remain outside Core.",
    )
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
  if (name === "native-browser-evidence") return unverified(entry, "All current Browser tests use Bun seams/fakes; no live browser console, pixels, native IME, or real ResizeObserver/rAF evidence was reproduced.")
  if (name === "error-boundaries") return unsupported(entry, "The browser composition owner has lifecycle validation but no general application error-boundary contract.")
  if (["number-input-proxy", "select-picker", "clipboard-proxy"].includes(name)) return unsupported(entry, "The native host intentionally exposes only the current text input/textarea proxy subset; this control/browser integration is absent.")
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
  if (name === "device-pixel-evidence") return unverified(entry, "Renderer WebGPU tests exercise Engine objects and fake fonts, not GPUDevice submission/readback or browser canvas pixels.")
  if (name === "vector-path") return unsupported(entry, "RenderFrame and retained backend admit Rect, Text, and Image only; no generic vector/path display item exists.")
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
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, templateExportStatus(entry))
  if (entry.id.startsWith("tsx.typescript.")) return classifyTypescriptJsx(entry)
  if (entry.id.startsWith("tsx.tagged-html.")) return classifyTaggedHtml(entry)
  if (entry.id.startsWith("tsx.compiler.")) return classifyTsxCompiler(entry)
  return unsupported(entry, "No Template support classification was found.")
}

function classifyTypescriptJsx(entry: CapabilityInventoryEntry): Classification {
  const supported = new Set(["tsx-file-syntax", "intrinsic-elements", "value-elements", "jsx-namespace", "attribute-type-checking", "children-type-checking", "expression-children", "automatic-runtime", "development-runtime", "angle-bracket-assertion-rejection"])
  const suffix = entry.id.slice("tsx.typescript.".length)
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
  if (suffix === "static-style-extraction") {
    return implemented("extension", [
      implementation("template", "compiler/style.ts", "component-local css extraction", undefined, "Global css intrinsic rules, bounded attribute/pseudo selectors and nested fragments become one ordered compiled sheet with addressed markers.", "Dynamic non-base selector values, general selectors and CSS nesting."),
      implementation("template", "compiled.ts", "CompiledTemplate.styleSheets", undefined, "Immutable stylesheet metadata crosses the compiled-template ABI with exact duplicate collapse and collision rejection.", "Document registration and rendered pixels outside Template."),
      test("template", "compiler/style-compiler.test.ts", suffix, "Global intrinsic identity, css-only lowering, authored precedence, component base styles, residual caller style and exact fail-closed diagnostics.", "Downstream Document/Renderer lifecycle."),
      test("template", "compiled-style-sheet.test.ts", suffix, "Compiled metadata reaches the runtime package without runtime JSX or defineStyles authoring.", "Native browser presentation."),
    ])
  }
  const implementedNames = new Set([
    "intrinsic-elements", "function-components", "nested-components", "props", "children", "primitive-children", "component-children",
    "conditional-branches", "refs", "callback-refs", "object-refs", "event-bindings", "event-capture-bindings", "property-bindings",
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
  if (entry.id.startsWith("platform.")) return classifyPublicExport(entry, engineExportStatus(entry))
  const name = entry.id.slice("engine.features.".length)
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
  const implementedNames = new Set(["buffer-attributes", "dirty-intervals", "instance-layer", "instanced-rounded-rectangles", "draw-range-views", "clipping", "gpu-device-evidence"])
  if (implementedNames.has(name)) return implemented("extension", [implementation("engine", engineSourcePath(name), name, undefined, "Bounded Engine ABI implementation.", "DOM/CSS semantics and unsupported renderables."), test("engine", engineTestPath(name), name, "Behavioral and, where applicable, real GPU pipeline/pixel evidence.", "Browser integration and unrelated Engine features.")])
  if (name === "glyph-cache-identity") return unsupportedGap(entry, "Glyph geometry cache keys only by gid, so different fonts with the same glyph ID reuse incorrect geometry.", "gap.engine.glyph-cache-font-identity")
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
  if (["BufferAttribute", "Float32BufferAttribute", "InstanceLayer", "RoundedRectInstanceLayer", "InstancedRoundedRect"].includes(entry.name)) return "implemented"
  if (["Renderer", "Text", "CachedText", "TextureLoader", "ViewPoint", "Raycaster", "GLTFLoader"].includes(entry.name)) return "partial"
  return "unverified"
}

function implemented(conformance: CapabilityConformance, evidence: EvidenceRecord[]): Classification {
  return { status: "implemented", conformance, limitations: [], evidence }
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
  if (["color", "background", "background-color", "border-color"].includes(name)) return "CPU style can retain arbitrary/named colors, while the WebGPU transport accepts only transparent, hex, and rgb/rgba forms; unsupported resolved colors fail closed."
  if (name === "box-shadow") return "Only one bounded outer analytical shadow is parsed and transported."
  if (name.includes("border") || name.includes("radius")) return "Rounded/nonuniform/multicolor combinations exceed the bounded backend contract and fail closed."
  if (name.startsWith("flex") || name === "align-items" || name === "justify-content") return "Balance, reverse main axes, flex-flow, order, align-self, align-content, separate row/column gaps, and complete intrinsic multi-line Flexbox sizing remain unsupported."
  if (name === "transform" || name === "transform-origin") return "Only axis-aligned translate/scale transforms are supported; rotate/skew/matrix/3D are absent."
  return "Only the explicitly admitted property values and bounded CPU/backend algorithms are implemented."
}

function cssTestPath(name: string): string {
  if (name.includes("overflow") || name.includes("scrollbar")) return "packages/core/test/overflow.test.ts"
  if (name.includes("transform")) return "packages/core/test/transform.test.ts"
  if (name.includes("z-index")) return "packages/core/test/z-index.test.ts"
  if (name.includes("shadow")) return "packages/core/test/box-shadow.test.ts"
  if (name.includes("border") || name.includes("background") || name === "color" || name === "opacity") return "packages/core/test/renderer.test.ts"
  if (name.startsWith("flex") || name === "align-items" || name === "justify-content" || name === "gap") return "packages/core/test/renderer.test.ts"
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
  if (name === "invalidation" || name === "incremental-patches" || name.includes("fast-path")) return "Dirty bookkeeping exists, but general dirty frames still remeasure/place/re-emit; only narrow Text and transform fast paths reuse records."
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
  "display", "box-sizing", "flex-direction", "flex-grow", "flex-shrink", "flex-basis", "flex", "align-items", "justify-content", "gap",
  "width", "height", "min-width", "min-height", "max-width", "max-height", "inline-size", "block-size", "min-inline-size", "min-block-size", "max-inline-size", "max-block-size",
  "position", "left", "top", "right", "bottom", "transform", "transform-origin", "box-shadow", "z-index",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "margin-inline", "margin-block", "margin-inline-start", "margin-inline-end", "margin-block-start", "margin-block-end",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-inline", "padding-block", "padding-inline-start", "padding-inline-end", "padding-block-start", "padding-block-end",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-width", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-style", "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius",
  "background", "background-color", "color", "font-size", "line-height", "letter-spacing", "opacity", "overflow", "overflow-x", "overflow-y", "scrollbar-width", "object-fit", "text-align", "text-overflow", "white-space",
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
