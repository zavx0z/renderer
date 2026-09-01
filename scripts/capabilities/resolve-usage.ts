import {
  CAPABILITY_POLICIES,
  CAPABILITY_SCHEMA_VERSION,
  CAPABILITY_USAGE_OPERATIONS,
  GENERATOR_VERSION,
  sha256,
  stableStringify,
} from "./model.ts"
import type {
  CapabilityDiagnostic,
  CapabilityPolicy,
  CapabilityRecord,
  CapabilityRequest,
  CapabilityRequestKind,
  CapabilityRequestReport,
  CapabilityUsage,
  CapabilityUsageFile,
  CapabilityUsageValue,
} from "./model.ts"

export interface CapabilityIndex {
  records: CapabilityRecord[]
  gaps?: unknown[]
  [key: string]: unknown
}

export interface ResolveCapabilityUsageOptions {
  matrix: CapabilityIndex
  matrixPath: string
  source: CapabilityUsageFile
  sourcePath: string
  sourceDigest?: string
  policy: CapabilityPolicy
}

type RequestDisposition = CapabilityRequest["disposition"]

type Resolution = Readonly<{
  candidates: CapabilityRecord[]
  status: "resolved" | "missing" | "ambiguous"
}>

const requestOrder = (left: CapabilityRequest, right: CapabilityRequest): number =>
  left.usage.source.path.localeCompare(right.usage.source.path) ||
  left.usage.source.start.line - right.usage.source.start.line ||
  left.usage.source.start.column - right.usage.source.start.column ||
  left.id.localeCompare(right.id)

export function resolveCapabilityUsages(
  options: ResolveCapabilityUsageOptions,
): CapabilityRequestReport {
  if (!CAPABILITY_POLICIES.includes(options.policy)) {
    throw new TypeError(`Unknown capability policy: ${String(options.policy)}`)
  }

  const matrixDigest = capabilityMatrixDigest(options.matrix)
  const sourceDigest = options.sourceDigest ?? sha256(stableStringify(options.source))
  const records = [...options.matrix.records]
  const recordsById = new Map(records.map(record => [record.id, record]))
  const baseInterfaces = buildBaseInterfaceIndex(records, recordsById)
  const requests: CapabilityRequest[] = []

  for (const usage of options.source.usages) {
    const resolution = resolveUsage(usage, records, recordsById, baseInterfaces)
    if (resolution.status === "resolved") {
      const record = resolution.candidates[0]!
      if (isSatisfied(record)) continue
      requests.push(requestForRecord(usage, record, matrixDigest))
      continue
    }
    requests.push(requestForUnresolved(usage, resolution, matrixDigest))
  }

  requests.sort(requestOrder)
  const diagnostics = requests.map(request => diagnosticForRequest(request, options.policy))
  return {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    policy: options.policy,
    matrix: {
      path: options.matrixPath,
      digest: matrixDigest,
    },
    source: {
      path: options.sourcePath,
      digest: sourceDigest,
    },
    requests,
    diagnostics,
    summary: {
      usages: options.source.usages.length,
      satisfied: options.source.usages.length - requests.length,
      requests: requests.length,
      blocking: diagnostics.filter(diagnostic => diagnostic.blocking).length,
    },
  }
}

export function capabilityMatrixDigest(matrix: CapabilityIndex): string {
  return sha256(stableStringify(matrix))
}

export function formatCapabilityDiagnostic(diagnostic: CapabilityDiagnostic): string {
  const location = `${diagnostic.source.path}:${diagnostic.source.start.line}:${diagnostic.source.start.column}`
  return `${location} [${diagnostic.code}] ${diagnostic.message}`
}

export function parseCapabilityUsageFile(value: unknown): CapabilityUsageFile {
  const file = object(value, "capability usage file")
  if (file.schemaVersion !== CAPABILITY_SCHEMA_VERSION) {
    throw new TypeError(`Capability usage schemaVersion must be ${CAPABILITY_SCHEMA_VERSION}`)
  }
  string(file.generatorVersion, "capability usage generatorVersion")
  if (!Array.isArray(file.usages)) throw new TypeError("Capability usage file usages must be an array")
  const usages = file.usages.map((usage, index) => parseUsage(usage, index))
  return {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    generatorVersion: file.generatorVersion,
    usages,
  }
}

function parseUsage(value: unknown, index: number): CapabilityUsage {
  const usage = object(value, `usage ${index}`)
  const requiredBy = object(usage.requiredBy, `usage ${index} requiredBy`)
  const scope = string(requiredBy.scope, `usage ${index} requiredBy.scope`)
  if (scope !== "production" && scope !== "storybook" && scope !== "development") {
    throw new TypeError(`usage ${index} requiredBy.scope is invalid`)
  }
  const source = object(usage.source, `usage ${index} source`)
  const start = position(source.start, `usage ${index} source.start`)
  const end = position(source.end, `usage ${index} source.end`)
  const operation = string(usage.operation, `usage ${index} operation`)
  if (!CAPABILITY_USAGE_OPERATIONS.includes(operation as never)) {
    throw new TypeError(`usage ${index} operation is invalid`)
  }
  const selector = parseSelector(usage.selector, index)
  return {
    requiredBy: {
      repository: string(requiredBy.repository, `usage ${index} requiredBy.repository`),
      package: string(requiredBy.package, `usage ${index} requiredBy.package`),
      subject: string(requiredBy.subject, `usage ${index} requiredBy.subject`),
      scope,
      revision: string(requiredBy.revision, `usage ${index} requiredBy.revision`),
    },
    source: {
      path: string(source.path, `usage ${index} source.path`),
      start,
      end,
      ...(source.symbol === undefined
        ? {}
        : {symbol: string(source.symbol, `usage ${index} source.symbol`)}),
    },
    operation: operation as CapabilityUsage["operation"],
    selector,
    behavior: string(usage.behavior, `usage ${index} behavior`),
  }
}

function parseSelector(value: unknown, index: number): CapabilityUsage["selector"] {
  const selector = object(value, `usage ${index} selector`)
  const kind = string(selector.kind, `usage ${index} selector.kind`)
  if (kind === "capability") {
    return {kind, id: string(selector.id, `usage ${index} selector.id`)}
  }
  if (kind === "html-element") {
    return {
      kind,
      tag: string(selector.tag, `usage ${index} selector.tag`),
      ...(selector.interfaceMapping === undefined
        ? {}
        : {interfaceMapping: boolean(selector.interfaceMapping, `usage ${index} selector.interfaceMapping`)}),
    }
  }
  if (kind === "html-attribute") {
    const transport = string(selector.transport, `usage ${index} selector.transport`)
    if (transport !== "content-attribute" && transport !== "property") {
      throw new TypeError(`usage ${index} selector.transport is invalid`)
    }
    return {
      kind,
      ...(selector.tag === undefined ? {} : {tag: string(selector.tag, `usage ${index} selector.tag`)}),
      name: string(selector.name, `usage ${index} selector.name`),
      transport,
      ...(selector.operation === undefined
        ? {}
        : {operation: templateOperation(selector.operation, `usage ${index} selector.operation`)}),
      ...(selector.value === undefined
        ? {}
        : {value: parseUsageValue(selector.value, `usage ${index} selector.value`)}),
    }
  }
  if (kind === "event") {
    return {
      kind,
      name: string(selector.name, `usage ${index} selector.name`),
      ...(selector.target === undefined ? {} : {target: string(selector.target, `usage ${index} selector.target`)}),
      ...(selector.targetTag === undefined ? {} : {targetTag: string(selector.targetTag, `usage ${index} selector.targetTag`)}),
      ...(selector.capture === undefined ? {} : {capture: boolean(selector.capture, `usage ${index} selector.capture`)}),
    }
  }
  if (kind === "interface-member") {
    const memberKind = selector.memberKind === undefined
      ? undefined
      : string(selector.memberKind, `usage ${index} selector.memberKind`)
    if (memberKind !== undefined && !["attribute", "operation", "constructor", "const", "inheritance"].includes(memberKind)) {
      throw new TypeError(`usage ${index} selector.memberKind is invalid`)
    }
    return {
      kind,
      interface: string(selector.interface, `usage ${index} selector.interface`),
      member: string(selector.member, `usage ${index} selector.member`),
      ...(selector.standardLibrary === undefined
        ? {}
        : {standardLibrary: standardLibrary(selector.standardLibrary, `usage ${index} selector.standardLibrary`)}),
      ...(memberKind === undefined ? {} : {memberKind: memberKind as "attribute"}),
      ...(selector.signature === undefined
        ? {}
        : {signature: string(selector.signature, `usage ${index} selector.signature`)}),
    }
  }
  if (kind === "css-property") {
    return {
      kind,
      name: string(selector.name, `usage ${index} selector.name`),
      ...(selector.value === undefined
        ? {}
        : {value: parseUsageValue(selector.value, `usage ${index} selector.value`)}),
    }
  }
  if (kind === "css-selector") {
    return {kind, name: string(selector.name, `usage ${index} selector.name`)}
  }
  if (kind === "named-capability") {
    return {
      kind,
      domain: string(selector.domain, `usage ${index} selector.domain`),
      capabilityKind: string(selector.capabilityKind, `usage ${index} selector.capabilityKind`),
      name: string(selector.name, `usage ${index} selector.name`),
    }
  }
  if (kind === "project-element") {
    return {kind, tag: string(selector.tag, `usage ${index} selector.tag`)}
  }
  if (kind === "html-input-type") {
    return {kind, value: text(selector.value, `usage ${index} selector.value`)}
  }
  if (kind === "css-attribute-selector") {
    return {
      kind,
      name: string(selector.name, `usage ${index} selector.name`),
      value: selector.value === null ? null : text(selector.value, `usage ${index} selector.value`),
    }
  }
  throw new TypeError(`usage ${index} selector.kind is invalid: ${kind}`)
}

function resolveUsage(
  usage: CapabilityUsage,
  records: readonly CapabilityRecord[],
  recordsById: ReadonlyMap<string, CapabilityRecord>,
  baseInterfaces: ReadonlyMap<string, readonly string[]>,
): Resolution {
  const selector = usage.selector
  let candidates: CapabilityRecord[]
  if (selector.kind === "capability") {
    const record = recordsById.get(selector.id)
    candidates = record ? [record] : []
  } else if (selector.kind === "html-element") {
    candidates = records.filter(record => selector.interfaceMapping
      ? record.kind === "interface-mapping" && metadataString(record, "element") === selector.tag
      : record.domain === "html" && record.kind === "element" && record.name === selector.tag)
  } else if (selector.kind === "html-attribute") {
    candidates = resolveHtmlAttribute(selector, records, recordsById, baseInterfaces)
  } else if (selector.kind === "event") {
    candidates = resolveEvent(selector, records, baseInterfaces)
  } else if (selector.kind === "interface-member") {
    candidates = resolveInterfaceMember(selector, records, recordsById, baseInterfaces)
  } else if (selector.kind === "css-property") {
    candidates = resolveCssProperty(selector, records)
  } else if (selector.kind === "css-selector") {
    candidates = records.filter(record =>
      record.domain === "css" && record.kind === "selector" && record.name === selector.name)
  } else if (selector.kind === "named-capability") {
    candidates = records.filter(record =>
      record.domain === selector.domain &&
      record.kind === selector.capabilityKind &&
      record.name === selector.name)
  } else if (selector.kind === "project-element") {
    const projectName = `${selector.tag.replaceAll("-", " ")} element`
    candidates = records.filter(record =>
      record.spec.profile === "project-contract" &&
      (metadataString(record, "element") === selector.tag ||
        (record.kind === "semantic-extension" && record.name === projectName)))
  } else if (selector.kind === "html-input-type") {
    const normalized = asciiLowercase(selector.value)
    const exact = records.filter(record =>
      record.domain === "html" &&
      record.kind === "input-type" &&
      record.name === `input type=${normalized}`)
    candidates = exact.length > 0
      ? exact
      : records.filter(record =>
          record.domain === "html" &&
          record.kind === "input-type" &&
          record.name === "input type=text")
  } else {
    candidates = records.filter(record =>
      record.domain === "css" &&
      record.kind === "data-type" &&
      record.name === "attribute-selector")
  }
  candidates = uniqueRecords(candidates)
  if (candidates.length === 0) return {status: "missing", candidates}
  if (candidates.length > 1) return {status: "ambiguous", candidates}
  return {status: "resolved", candidates}
}

function resolveHtmlAttribute(
  selector: Extract<CapabilityUsage["selector"], {kind: "html-attribute"}>,
  records: readonly CapabilityRecord[],
  recordsById: ReadonlyMap<string, CapabilityRecord>,
  baseInterfaces: ReadonlyMap<string, readonly string[]>,
): CapabilityRecord[] {
  const lowerName = selector.name.toLowerCase()
  if (lowerName.startsWith("data-") || lowerName.startsWith("aria-")) {
    const family = lowerName.startsWith("data-") ? "data-*" : "aria-*"
    return records.filter(record => record.kind === "global-attribute-family" && record.name === family)
  }

  if (selector.transport === "content-attribute") {
    const canonical = records.filter(record =>
      record.domain === "html" &&
      record.id.startsWith("html.attributes.") &&
      record.name.toLowerCase() === lowerName)
    if (canonical.length > 0) return canonical
  }

  if (selector.transport === "property" && selector.tag) {
    const element = records.find(record =>
      record.domain === "html" && record.kind === "element" && record.name === selector.tag)
    const interfaceName = element ? metadataString(element, "interface") : undefined
    if (interfaceName) {
      const members = resolveInterfaceMember({
        kind: "interface-member",
        interface: interfaceName,
        member: selector.name,
        memberKind: "attribute",
      }, records, recordsById, baseInterfaces)
      if (members.length > 0) return members
    }
  }

  if (selector.tag) {
    const elementSpecific = records.filter(record =>
      record.kind === "element-attribute" &&
      metadataString(record, "element") === selector.tag &&
      record.name.toLowerCase() === lowerName)
    if (elementSpecific.length > 0) return elementSpecific
  }

  return records.filter(record =>
    (record.kind === "global-attribute" || record.kind === "attribute") &&
    record.name.toLowerCase() === lowerName)
}

function resolveCssProperty(
  selector: Extract<CapabilityUsage["selector"], {kind: "css-property"}>,
  records: readonly CapabilityRecord[],
): CapabilityRecord[] {
  if (selector.name.startsWith("--")) {
    return records.filter(record =>
      record.domain === "css" &&
      record.kind === "css-algorithm" &&
      record.name === "custom properties")
  }
  const properties = records.filter(record =>
    record.domain === "css" && record.kind === "property" && record.name === selector.name)
  if (selector.value?.kind !== "static") return properties
  const propertyIds = new Set(properties.map(record => record.id))
  const value = String(selector.value.value)
  const specific = records.filter(record =>
    record.domain === "css" &&
    record.parent !== undefined &&
    propertyIds.has(record.parent) &&
    ["value", "rawValue", "keyword"].some(key => metadataString(record, key) === value))
  return specific.length > 0 ? specific : properties
}

function resolveEvent(
  selector: Extract<CapabilityUsage["selector"], {kind: "event"}>,
  records: readonly CapabilityRecord[],
  baseInterfaces: ReadonlyMap<string, readonly string[]>,
): CapabilityRecord[] {
  const named = records.filter(record => record.kind === "event" && record.name === selector.name)
  const targetElement = selector.targetTag
    ? records.find(record => record.domain === "html" && record.kind === "element" && record.name === selector.targetTag)
    : undefined
  if (selector.targetTag && !targetElement) return []
  const target = selector.target ?? (targetElement ? metadataString(targetElement, "interface") : undefined)
  if (!target) return named
  const scored = named.flatMap(record => {
    const targets = eventTargets(record)
    const distances = targets.map(candidateTarget => interfaceDistance(target, candidateTarget, baseInterfaces))
      .filter((distance): distance is number => distance !== null)
    if (distances.length === 0) return []
    return [{record, distance: Math.min(...distances)}]
  })
  if (scored.length === 0) {
    return named.length === 1 && standardProfile(named[0]!) ? named : []
  }
  const best = Math.min(...scored.map(candidate => candidate.distance))
  return scored.filter(candidate => candidate.distance === best).map(candidate => candidate.record)
}

function resolveInterfaceMember(
  selector: Extract<CapabilityUsage["selector"], {kind: "interface-member"}>,
  records: readonly CapabilityRecord[],
  recordsById: ReadonlyMap<string, CapabilityRecord>,
  baseInterfaces: ReadonlyMap<string, readonly string[]>,
): CapabilityRecord[] {
  const startingNames = [
    selector.interface,
    ...standardInterfaceAliases(selector.standardLibrary, selector.interface),
  ]
  const distances = interfaceDistances(startingNames, baseInterfaces)
  const interfaceNames = new Set(distances.keys())
  const interfaces = records.filter(record =>
    interfaceNames.has(record.name) && record.kind.includes("interface"))
  const candidates = records.filter(record => {
    if (!record.parent || !interfaces.some(parent => parent.id === record.parent)) return false
    if (record.name !== selector.member) return false
    if (selector.memberKind && record.kind !== selector.memberKind) return false
    if (selector.signature && metadataString(record, "signature") !== selector.signature) return false
    return recordsById.has(record.parent)
  })
  if (candidates.length === 0) return []
  const nearest = Math.min(...candidates.map(record =>
    distances.get(recordsById.get(record.parent!)!.name) ?? Number.POSITIVE_INFINITY))
  return candidates.filter(record =>
    distances.get(recordsById.get(record.parent!)!.name) === nearest)
}

function requestForRecord(
  usage: CapabilityUsage,
  record: CapabilityRecord,
  matrixDigest: string,
): CapabilityRequest {
  const [kind, disposition] = requestClassification(record)
  return requestRecord({
    usage,
    matrixDigest,
    kind,
    disposition,
    capability: record.id,
    candidates: [record],
    status: record.status,
    conformance: record.conformance,
    owner: record.owner,
    stages: record.stages ?? null,
    limitations: record.limitations,
    reason: record.reason ?? null,
    blockedBy: record.blockedBy,
    blocks: record.blocks,
    lastVerified: record.lastVerified,
    reference: record.spec.anchor,
  })
}

function requestForUnresolved(
  usage: CapabilityUsage,
  resolution: Resolution,
  matrixDigest: string,
): CapabilityRequest {
  const ambiguous = resolution.status === "ambiguous"
  const candidates = resolution.candidates
  return requestRecord({
    usage,
    matrixDigest,
    kind: ambiguous ? "resolution" : "inventory",
    disposition: ambiguous ? "needs-resolution" : "needs-inventory",
    capability: null,
    candidates,
    status: ambiguous ? "ambiguous" : "missing",
    conformance: "unknown",
    owner: null,
    stages: null,
    limitations: ambiguous
      ? [`Multiple capability records match this usage: ${candidates.map(record => record.id).join(", ")}`]
      : ["No capability inventory record matches this usage."],
    reason: null,
    blockedBy: [],
    blocks: [],
    lastVerified: null,
    reference: ambiguous
      ? "Capability inventory contains multiple matching records."
      : "Capability inventory has no matching record.",
  })
}

function requestRecord(options: Readonly<{
  usage: CapabilityUsage
  matrixDigest: string
  kind: CapabilityRequestKind
  disposition: RequestDisposition
  capability: string | null
  candidates: CapabilityRecord[]
  status: CapabilityRequest["matrix"]["status"]
  conformance: CapabilityRequest["matrix"]["conformance"]
  owner: CapabilityRequest["matrix"]["owner"]
  stages: CapabilityRequest["matrix"]["stages"]
  limitations: string[]
  reason: string | null
  blockedBy: string[]
  blocks: string[]
  lastVerified: CapabilityRequest["matrix"]["lastVerified"]
  reference: string
}>): CapabilityRequest {
  const candidateCapabilities = options.candidates.map(record => record.id).sort()
  const identity = {
    capability: options.capability,
    candidates: candidateCapabilities,
    operation: options.usage.operation,
    requiredBy: options.usage.requiredBy,
    selector: options.usage.selector,
    source: options.usage.source,
  }
  const id = `request.${sha256(stableStringify(identity)).slice(0, 24)}`
  return {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    id,
    kind: options.kind,
    capability: options.capability,
    ...(options.capability === null && candidateCapabilities.length > 0
      ? {candidateCapabilities}
      : {}),
    requiredBy: options.usage.requiredBy,
    usage: {
      source: options.usage.source,
      operation: options.usage.operation,
      selector: options.usage.selector,
      behavior: options.usage.behavior,
    },
    expected: {
      reference: options.reference,
      behavior: options.usage.behavior,
    },
    matrix: {
      digest: options.matrixDigest,
      status: options.status,
      conformance: options.conformance,
      owner: options.owner,
      stages: options.stages,
      limitations: [...new Set(options.limitations)].sort(),
      reason: options.reason,
      blockedBy: [...new Set(options.blockedBy)].sort(),
      blocks: [...new Set(options.blocks)].sort(),
      lastVerified: options.lastVerified,
    },
    disposition: options.disposition,
    runtimeGapProven: false,
    evidence: [{
      type: "consumer-usage",
      repository: options.usage.requiredBy.repository,
      revision: options.usage.requiredBy.revision,
      path: options.usage.source.path,
      symbol: options.usage.source.symbol ?? selectorDescription(options.usage),
      lines: String(options.usage.source.start.line),
      proves: options.usage.behavior,
      doesNotProve: "Runtime failure, severity, owner defect, implementation, or conformance.",
    }],
  }
}

function diagnosticForRequest(
  request: CapabilityRequest,
  policy: CapabilityPolicy,
): CapabilityDiagnostic {
  const blocking = isBlocking(request, policy)
  const owner = request.matrix.owner
    ? `${request.matrix.owner.repository}/${request.matrix.owner.package}/${request.matrix.owner.stage}`
    : "unresolved"
  const capability = request.capability ?? request.candidateCapabilities?.join(", ") ?? "missing"
  const limitations = [
    ...(request.matrix.reason ? [request.matrix.reason] : []),
    ...request.matrix.limitations,
  ].join("; ") || "none recorded"
  const limitationSentence = /[.!?]$/.test(limitations) ? limitations : `${limitations}.`
  const requestMeaning = request.kind === "implementation"
    ? "implementation is requested by the current unsupported row"
    : request.kind === "verification"
      ? "verification is required before implementation can be claimed"
      : request.kind === "conformance"
        ? "the usage is not covered by an exact proven row"
        : request.kind === "misuse"
          ? "the capability is not applicable to this platform profile"
          : request.kind === "resolution"
            ? "the usage matches multiple rows and requires explicit resolution"
            : "the inventory needs a leaf record before support can be decided"
  return {
    code: diagnosticCode(request.kind),
    severity: blocking ? "error" : "warning",
    blocking,
    message: `${selectorDescription(request.usage)} requires ${capability}; matrix=${request.matrix.status}/${request.matrix.conformance}; owner=${owner}; ${requestMeaning}. Limitations: ${limitationSentence} Request ${request.id} records consumer demand only; no runtime gap is claimed.`,
    requestId: request.id,
    source: request.usage.source,
  }
}

function isSatisfied(record: CapabilityRecord): boolean {
  if (record.status !== "implemented") return false
  if (record.conformance === "exact") return true
  return record.spec.profile === "project-contract" && record.conformance === "extension"
}

function requestClassification(record: CapabilityRecord): readonly [CapabilityRequestKind, RequestDisposition] {
  if (record.status === "unsupported") return ["implementation", "needs-implementation"]
  if (record.status === "unverified") return ["verification", "needs-verification"]
  if (record.status === "not-applicable") return ["misuse", "consumer-misuse"]
  return ["conformance", "needs-conformance"]
}

function isBlocking(request: CapabilityRequest, policy: CapabilityPolicy): boolean {
  if (policy === "report") return false
  if (policy === "exact") return true
  return request.kind !== "conformance"
}

function diagnosticCode(kind: CapabilityRequestKind): string {
  if (kind === "implementation") return "CAPABILITY_IMPLEMENTATION_REQUIRED"
  if (kind === "verification") return "CAPABILITY_VERIFICATION_REQUIRED"
  if (kind === "conformance") return "CAPABILITY_CONFORMANCE_REQUIRED"
  if (kind === "inventory") return "CAPABILITY_INVENTORY_REQUIRED"
  if (kind === "resolution") return "CAPABILITY_RESOLUTION_REQUIRED"
  return "CAPABILITY_NOT_APPLICABLE"
}

function selectorDescription(usage: Omit<CapabilityUsage, "requiredBy">): string {
  const selector = usage.selector
  if (selector.kind === "capability") return selector.id
  if (selector.kind === "html-element") return selector.interfaceMapping
    ? `<${selector.tag}> interface mapping`
    : `<${selector.tag}>`
  if (selector.kind === "html-attribute") {
    const owner = selector.tag ? `<${selector.tag}>` : "HTML"
    return `${owner} ${selector.transport} ${selector.name} (${selector.operation ?? "unspecified"}; ${usageValueDescription(selector.value)})`
  }
  if (selector.kind === "event") return `${selector.target ?? selector.targetTag ?? "EventTarget"}.${selector.name}${selector.capture ? " capture" : ""}`
  if (selector.kind === "interface-member") return `${selector.interface}.${selector.member}`
  if (selector.kind === "css-property") return `CSS property ${selector.name}: ${usageValueDescription(selector.value)}`
  if (selector.kind === "css-selector") return `CSS selector ${selector.name}`
  if (selector.kind === "named-capability") return `${selector.domain}/${selector.capabilityKind}/${selector.name}`
  if (selector.kind === "project-element") return `project element <${selector.tag}>`
  if (selector.kind === "html-input-type") return `<input type=${JSON.stringify(selector.value)}> behavior`
  return selector.value === null
    ? `CSS attribute selector [${selector.name}]`
    : `CSS attribute selector [${selector.name}=${JSON.stringify(selector.value)}]`
}

function buildBaseInterfaceIndex(
  records: readonly CapabilityRecord[],
  recordsById: ReadonlyMap<string, CapabilityRecord>,
): Map<string, readonly string[]> {
  const index = new Map<string, Set<string>>()
  for (const record of records) {
    if (record.kind === "includes") {
      const [target, included] = record.name.split("-includes-", 2)
      if (!target || !included) continue
      const bases = index.get(target) ?? new Set<string>()
      bases.add(included)
      index.set(target, bases)
      continue
    }
    if (record.kind !== "inheritance" || !record.parent) continue
    const child = recordsById.get(record.parent)?.name
    const base = metadataString(record, "base")
    if (!child || !base) continue
    const bases = index.get(child) ?? new Set<string>()
    bases.add(base)
    index.set(child, bases)
  }
  return new Map([...index].map(([name, bases]) => [name, [...bases].sort()]))
}

function interfaceDistances(
  startingNames: readonly string[],
  baseInterfaces: ReadonlyMap<string, readonly string[]>,
): Map<string, number> {
  const distances = new Map(startingNames.map(name => [name, 0]))
  let frontier = [...new Set(startingNames)]
  while (frontier.length > 0) {
    const next: string[] = []
    for (const current of frontier) {
      const distance = distances.get(current)!
      for (const base of baseInterfaces.get(current) ?? []) {
        if (distances.has(base)) continue
        distances.set(base, distance + 1)
        next.push(base)
      }
    }
    frontier = next
  }
  return distances
}

function interfaceDistance(
  child: string,
  target: string,
  baseInterfaces: ReadonlyMap<string, readonly string[]>,
): number | null {
  if (child === target) return 0
  const visited = new Set([child])
  let frontier = [child]
  let distance = 0
  while (frontier.length > 0) {
    distance += 1
    const next: string[] = []
    for (const current of frontier) {
      for (const base of baseInterfaces.get(current) ?? []) {
        if (base === target) return distance
        if (visited.has(base)) continue
        visited.add(base)
        next.push(base)
      }
    }
    frontier = next
  }
  return null
}

function eventTargets(record: CapabilityRecord): string[] {
  const targets = record.metadata?.targets
  if (!Array.isArray(targets)) return []
  return targets.flatMap(target => {
    if (!target || typeof target !== "object") return []
    const value = (target as Record<string, unknown>).target
    return typeof value === "string" ? [value] : []
  })
}

function metadataString(record: CapabilityRecord, key: string): string | undefined {
  const value = record.metadata?.[key]
  return typeof value === "string" ? value : undefined
}

function standardProfile(record: CapabilityRecord): boolean {
  return record.spec.profile === "standard" || record.spec.profile === "reference"
}

/**
 * TypeScript 7.0.2 still exposes the historical lib.dom mixin name while the
 * pinned WHATWG HTML commit renamed the same focus/tabIndex contract to include
 * MathML. The alias is source-version-specific and applies only to lib.dom
 * symbols; arbitrary consumer interfaces are never renamed.
 */
function standardInterfaceAliases(
  standardLibrary: "lib.dom" | undefined,
  interfaceName: string,
): readonly string[] {
  if (standardLibrary === "lib.dom" && interfaceName === "HTMLOrSVGElement") {
    return ["HTMLOrSVGOrMathMLElement"]
  }
  return []
}

function uniqueRecords(records: readonly CapabilityRecord[]): CapabilityRecord[] {
  return [...new Map(records.map(record => [record.id, record])).values()]
    .sort((left, right) => left.id.localeCompare(right.id))
}

function object(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value as Record<string, any>
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`)
  return value
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`)
  return value
}

function asciiLowercase(value: string): string {
  return value.replace(/[A-Z]/g, character => character.toLowerCase())
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean`)
  return value
}

function standardLibrary(value: unknown, label: string): "lib.dom" {
  if (value !== "lib.dom") throw new TypeError(`${label} must be lib.dom`)
  return value
}

function templateOperation(value: unknown, label: string): "binding" | "mount" | "style" {
  if (value !== "binding" && value !== "mount" && value !== "style") {
    throw new TypeError(`${label} must be binding, mount, or style`)
  }
  return value
}

function parseUsageValue(value: unknown, label: string): CapabilityUsageValue {
  const record = object(value, label)
  if (record.kind === "dynamic") return {kind: "dynamic"}
  if (record.kind !== "static") throw new TypeError(`${label}.kind must be static or dynamic`)
  if (typeof record.value !== "boolean" && typeof record.value !== "number" && typeof record.value !== "string") {
    throw new TypeError(`${label}.value must be a boolean, number, or string`)
  }
  return {kind: "static", value: record.value}
}

function usageValueDescription(value: CapabilityUsageValue | undefined): string {
  if (value === undefined) return "value unspecified"
  if (value.kind === "dynamic") return "dynamic value"
  return `static value ${JSON.stringify(value.value)}`
}

function position(value: unknown, label: string): {line: number; column: number} {
  const result = object(value, label)
  if (!Number.isInteger(result.line) || result.line < 1) throw new TypeError(`${label}.line must be a positive integer`)
  if (!Number.isInteger(result.column) || result.column < 1) throw new TypeError(`${label}.column must be a positive integer`)
  return {line: result.line, column: result.column}
}
