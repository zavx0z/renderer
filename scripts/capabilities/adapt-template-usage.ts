import {
  CAPABILITY_SCHEMA_VERSION,
} from "./model.ts"
import type {
  CapabilityConsumerIdentity,
  CapabilityUsage,
  CapabilityUsageFile,
  CapabilityUsageOperation,
  CapabilityUsageSelector,
  CapabilityUsageValue,
} from "./model.ts"

interface TemplateSourcePosition {
  line: number
  column: number
  offset: number
}

interface TemplateUsageSource {
  path: string
  start: TemplateSourcePosition
  end: TemplateSourcePosition
}

type TemplateCapabilityUsage =
  | Readonly<{kind: "intrinsic-element"; profile: "html" | "template-extension"; tagName: string; source: TemplateUsageSource}>
  | Readonly<{
      kind: "intrinsic-attribute"
      tagName: string
      name: string
      operation: "binding" | "mount" | "style"
      transport: "content-attribute" | "property" | "style"
      value: CapabilityUsageValue
      source: TemplateUsageSource
    }>
  | Readonly<{kind: "event"; tagName: string; propName: string; eventType: string; capture: boolean; source: TemplateUsageSource}>
  | Readonly<{kind: "ref"; tagName: string; mode: "callback"; source: TemplateUsageSource}>
  | Readonly<{kind: "css-property"; name: string; value: CapabilityUsageValue; source: TemplateUsageSource}>
  | Readonly<{kind: "css-attribute-selector"; name: string; value: string | null; source: TemplateUsageSource}>
  | Readonly<{kind: "css-pseudo"; name: string; source: TemplateUsageSource}>
  | Readonly<{kind: "dom-member"; standardLibrary: "lib.dom"; interfaceName: string; memberName: string; operation: "read" | "write" | "call"; source: TemplateUsageSource}>

interface TemplateCapabilityManifest {
  schemaVersion: 2
  generatorVersion: "template-capability-usage-v2"
  files: Array<{
    path: string
    usages: TemplateCapabilityUsage[]
  }>
}

/**
 * Adapts the public Template-neutral compiler manifest directly into resolver
 * usages. Consumer identity is supplied by the build invocation, never hidden
 * inside Template or a hand-authored intermediate file.
 */
export function adaptTemplateCapabilityManifest(
  value: unknown,
  requiredBy: CapabilityConsumerIdentity,
): CapabilityUsageFile {
  const manifest = parseTemplateManifest(value)
  const usages = manifest.files.flatMap(file => file.usages.flatMap(usage =>
    adaptUsage(usage, requiredBy, file.path)))
  return {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    generatorVersion: manifest.generatorVersion,
    usages,
  }
}

function adaptUsage(
  usage: TemplateCapabilityUsage,
  requiredBy: CapabilityConsumerIdentity,
  manifestPath: string,
): CapabilityUsage[] {
  const source = {
    path: usage.source.path || manifestPath,
    start: {line: usage.source.start.line, column: usage.source.start.column},
    end: {line: usage.source.end.line, column: usage.source.end.column},
  }
  const create = (
    selector: CapabilityUsageSelector,
    operation: CapabilityUsageOperation,
    behavior: string,
  ): CapabilityUsage => ({requiredBy, source, selector, operation, behavior})

  if (usage.kind === "intrinsic-element") {
    const compilerUsage = create(
      {kind: "named-capability", domain: "tsx", capabilityKind: "tsx-compiler", name: "intrinsic elements"},
      "create",
      `Compile the intrinsic <${usage.tagName}> element through the governed Template profile.`,
    )
    if (usage.profile === "template-extension") {
      return [
        compilerUsage,
        create(
          {kind: "project-element", tag: usage.tagName},
          "create",
          `Create and retain the project-contract <${usage.tagName}> semantic element.`,
        ),
      ]
    }
    return [
      compilerUsage,
      create(
        {kind: "named-capability", domain: "tsx", capabilityKind: "tsx-compiler", name: "standard dom jsx typing"},
        "create",
        `Type <${usage.tagName}> through the governed global standard DOM JSX profile.`,
      ),
      create(
        {kind: "html-element", tag: usage.tagName},
        "create",
        `Create and retain the standard <${usage.tagName}> semantic element.`,
      ),
      create(
        {kind: "html-element", tag: usage.tagName, interfaceMapping: true},
        "create",
        `Map <${usage.tagName}> to its standard semantic element interface.`,
      ),
    ]
  }

  if (usage.kind === "intrinsic-attribute") {
    if (usage.transport === "style") {
      return [create(
        {kind: "named-capability", domain: "tsx", capabilityKind: "tsx-compiler", name: "style bindings"},
        "style",
        `Compile the ${usage.tagName} style ${usage.operation} with ${usageValueDescription(usage.value)} through the governed Template ABI.`,
      )]
    }
    const transport = usage.transport
    const attributeName = normalizeAttributeName(usage.name)
    const result = [create(
      {
        kind: "html-attribute",
        tag: usage.tagName,
        name: attributeName,
        transport,
        operation: usage.operation,
        value: usage.value,
      },
      transport === "property" ? "write" : "attribute",
      transport === "property"
        ? `Write the standard ${usage.tagName}.${attributeName} live property through ${usage.operation} with ${usageValueDescription(usage.value)}.`
        : `Apply the standard ${attributeName} content attribute to <${usage.tagName}> through ${usage.operation} with ${usageValueDescription(usage.value)}.`,
    )]
    if (transport === "property") {
      result.unshift(create(
        {kind: "named-capability", domain: "tsx", capabilityKind: "tsx-compiler", name: "property bindings"},
        "write",
        `Compile the ${usage.tagName}.${attributeName} live-property binding through the governed Template ABI.`,
      ))
    }
    if (
      usage.tagName === "input" &&
      attributeName === "type" &&
      usage.value.kind === "static" &&
      typeof usage.value.value === "string"
    ) {
      result.push(create(
        {kind: "html-input-type", value: usage.value.value},
        "behavior",
        `Execute the standard <input type=${JSON.stringify(usage.value.value)}> behavior requested by this static authored value.`,
      ))
    }
    return result
  }

  if (usage.kind === "event") {
    const result = [
      create(
        {kind: "named-capability", domain: "tsx", capabilityKind: "tsx-compiler", name: "event bindings"},
        "listen",
        `Compile the ${usage.propName} listener through the governed Template ABI.`,
      ),
      create(
        {kind: "event", name: usage.eventType, targetTag: usage.tagName, capture: usage.capture},
        "listen",
        `Dispatch the standard ${usage.eventType} event to <${usage.tagName}>.`,
      ),
    ]
    if (usage.capture) {
      result.splice(1, 0, create(
        {kind: "named-capability", domain: "tsx", capabilityKind: "tsx-compiler", name: "event capture bindings"},
        "listen",
        `Compile the capture phase for ${usage.propName} through the governed Template ABI.`,
      ))
    }
    return result
  }

  if (usage.kind === "ref") {
    return [
      create(
        {kind: "named-capability", domain: "tsx", capabilityKind: "tsx-compiler", name: "refs"},
        "ref",
        `Compile the callback ref for <${usage.tagName}> through the governed Template ABI.`,
      ),
      create(
        {kind: "named-capability", domain: "tsx", capabilityKind: "tsx-compiler", name: "callback refs"},
        "ref",
        `Attach and detach the callback ref for <${usage.tagName}>.`,
      ),
      create(
        {kind: "html-element", tag: usage.tagName, interfaceMapping: true},
        "ref",
        `Expose the standard semantic interface for the <${usage.tagName}> callback ref.`,
      ),
    ]
  }

  if (usage.kind === "css-property") {
    return [create(
      {kind: "css-property", name: usage.name, value: usage.value},
      "style",
      `Parse and execute the standard CSS ${usage.name} property with ${usageValueDescription(usage.value)}.`,
    )]
  }

  if (usage.kind === "css-attribute-selector") {
    return [create(
      {kind: "css-attribute-selector", name: usage.name, value: usage.value},
      "style",
      usage.value === null
        ? `Match the authored standard CSS presence selector [${usage.name}].`
        : `Match the authored standard CSS exact-value selector [${usage.name}=${JSON.stringify(usage.value)}].`,
    )]
  }

  if (usage.kind === "css-pseudo") {
    const name = usage.name.startsWith(":") ? usage.name : `:${usage.name}`
    return [create(
      {kind: "css-selector", name},
      "style",
      `Match and execute the standard CSS ${name} pseudo selector.`,
    )]
  }

  return [create(
    {
      kind: "interface-member",
      interface: usage.interfaceName,
      member: usage.memberName,
      standardLibrary: usage.standardLibrary,
      ...(usage.operation === "call" ? {memberKind: "operation"} : {}),
    },
    usage.operation,
    `${usage.operation} the standard ${usage.interfaceName}.${usage.memberName} DOM member.`,
  )]
}

function parseTemplateManifest(value: unknown): TemplateCapabilityManifest {
  const manifest = object(value, "Template capability manifest")
  if (manifest.schemaVersion !== 2) throw new TypeError("Template capability manifest schemaVersion must be 2")
  const generatorVersion = string(manifest.generatorVersion, "Template capability manifest generatorVersion")
  if (generatorVersion !== "template-capability-usage-v2") {
    throw new TypeError("Template capability manifest generatorVersion must be template-capability-usage-v2")
  }
  if (!Array.isArray(manifest.files)) throw new TypeError("Template capability manifest files must be an array")
  return {
    schemaVersion: 2,
    generatorVersion,
    files: manifest.files.map((file, fileIndex) => {
      const record = object(file, `Template capability manifest file ${fileIndex}`)
      const path = string(record.path, `Template capability manifest file ${fileIndex} path`)
      if (!Array.isArray(record.usages)) throw new TypeError(`Template capability manifest file ${fileIndex} usages must be an array`)
      return {
        path,
        usages: record.usages.map((usage, usageIndex) => parseTemplateUsage(usage, fileIndex, usageIndex, path)),
      }
    }),
  }
}

function parseTemplateUsage(
  value: unknown,
  fileIndex: number,
  usageIndex: number,
  fallbackPath: string,
): TemplateCapabilityUsage {
  const label = `Template capability manifest file ${fileIndex} usage ${usageIndex}`
  const usage = object(value, label)
  const kind = string(usage.kind, `${label} kind`)
  const source = parseSource(usage.source, `${label} source`, fallbackPath)
  if (kind === "intrinsic-element") {
    const profile = string(usage.profile, `${label} profile`)
    if (profile !== "html" && profile !== "template-extension") throw new TypeError(`${label} profile is invalid`)
    return {kind, profile, tagName: string(usage.tagName, `${label} tagName`), source}
  }
  if (kind === "intrinsic-attribute") {
    const operation = templateOperation(usage.operation, `${label} operation`)
    const transport = templateTransport(usage.transport, `${label} transport`)
    return {
      kind,
      tagName: string(usage.tagName, `${label} tagName`),
      name: string(usage.name, `${label} name`),
      operation,
      transport,
      value: parseUsageValue(usage.value, `${label} value`),
      source,
    }
  }
  if (kind === "event") {
    return {
      kind,
      tagName: string(usage.tagName, `${label} tagName`),
      propName: string(usage.propName, `${label} propName`),
      eventType: string(usage.eventType, `${label} eventType`),
      capture: boolean(usage.capture, `${label} capture`),
      source,
    }
  }
  if (kind === "ref") {
    if (usage.mode !== "callback") throw new TypeError(`${label} mode is invalid`)
    return {kind, tagName: string(usage.tagName, `${label} tagName`), mode: "callback", source}
  }
  if (kind === "css-property") {
    return {
      kind,
      name: string(usage.name, `${label} name`),
      value: parseUsageValue(usage.value, `${label} value`),
      source,
    }
  }
  if (kind === "css-attribute-selector") {
    return {
      kind,
      name: string(usage.name, `${label} name`),
      value: usage.value === null ? null : text(usage.value, `${label} value`),
      source,
    }
  }
  if (kind === "css-pseudo") {
    return {kind, name: string(usage.name, `${label} name`), source}
  }
  if (kind === "dom-member") {
    if (usage.standardLibrary !== "lib.dom") throw new TypeError(`${label} standardLibrary is invalid`)
    const operation = string(usage.operation, `${label} operation`)
    if (operation !== "read" && operation !== "write" && operation !== "call") {
      throw new TypeError(`${label} operation is invalid`)
    }
    return {
      kind,
      standardLibrary: "lib.dom",
      interfaceName: string(usage.interfaceName, `${label} interfaceName`),
      memberName: string(usage.memberName, `${label} memberName`),
      operation,
      source,
    }
  }
  throw new TypeError(`${label} kind is invalid: ${kind}`)
}

function parseSource(value: unknown, label: string, fallbackPath: string): TemplateUsageSource {
  const source = object(value, label)
  return {
    path: source.path === undefined ? fallbackPath : string(source.path, `${label} path`),
    start: templatePosition(source.start, `${label} start`),
    end: templatePosition(source.end, `${label} end`),
  }
}

function templatePosition(value: unknown, label: string): TemplateSourcePosition {
  const position = object(value, label)
  return {
    line: positiveInteger(position.line, `${label} line`),
    column: positiveInteger(position.column, `${label} column`),
    offset: nonNegativeInteger(position.offset, `${label} offset`),
  }
}

function normalizeAttributeName(name: string): string {
  if (name === "className") return "class"
  if (name === "htmlFor") return "for"
  return name
}

function templateOperation(value: unknown, label: string): "binding" | "mount" | "style" {
  if (value !== "binding" && value !== "mount" && value !== "style") {
    throw new TypeError(`${label} must be binding, mount, or style`)
  }
  return value
}

function templateTransport(value: unknown, label: string): "content-attribute" | "property" | "style" {
  if (value !== "content-attribute" && value !== "property" && value !== "style") {
    throw new TypeError(`${label} must be content-attribute, property, or style`)
  }
  return value
}

function parseUsageValue(value: unknown, label: string): CapabilityUsageValue {
  const usageValue = object(value, label)
  if (usageValue.kind === "dynamic") return {kind: "dynamic"}
  if (usageValue.kind !== "static") throw new TypeError(`${label}.kind must be static or dynamic`)
  if (typeof usageValue.value !== "boolean" && typeof usageValue.value !== "number" && typeof usageValue.value !== "string") {
    throw new TypeError(`${label}.value must be a boolean, number, or string`)
  }
  return {kind: "static", value: usageValue.value}
}

function usageValueDescription(value: CapabilityUsageValue): string {
  return value.kind === "dynamic" ? "a dynamic value" : `the static value ${JSON.stringify(value.value)}`
}

function object(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`)
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

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean`)
  return value
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) throw new TypeError(`${label} must be a positive integer`)
  return Number(value)
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new TypeError(`${label} must be a non-negative integer`)
  return Number(value)
}
