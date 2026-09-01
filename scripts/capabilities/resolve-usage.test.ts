import { describe, expect, test } from "bun:test"
import { createRequire } from "node:module"
import { resolve as resolvePath } from "node:path"
import {
  CAPABILITY_SCHEMA_VERSION,
  GENERATOR_VERSION,
  readJson,
  rendererRoot,
} from "./model.ts"
import type {
  CapabilityRecord,
  CapabilityUsage,
  CapabilityUsageFile,
} from "./model.ts"
import {
  capabilityMatrixDigest,
  parseCapabilityUsageFile,
  resolveCapabilityUsages,
} from "./resolve-usage.ts"
import type {CapabilityIndex} from "./resolve-usage.ts"

const currentMatrix = await readJson<CapabilityIndex>(resolvePath(rendererRoot, "capabilities.index.json"))

describe("capability usage resolver", () => {
  test("passes only an exact implemented standard capability", () => {
    const matrix = syntheticMatrix([record({status: "implemented", conformance: "exact"})])
    const report = resolve(matrix, usage({kind: "capability", id: "test.capability"}), "strict")
    expect(report.requests).toEqual([])
    expect(report.summary).toEqual({usages: 1, satisfied: 1, requests: 0, blocking: 0})
  })

  test.each([
    ["partial", "adapted", "conformance", "CAPABILITY_CONFORMANCE_REQUIRED", false],
    ["unsupported", "none", "implementation", "CAPABILITY_IMPLEMENTATION_REQUIRED", true],
    ["unverified", "unknown", "verification", "CAPABILITY_VERIFICATION_REQUIRED", true],
    ["not-applicable", "none", "misuse", "CAPABILITY_NOT_APPLICABLE", true],
  ] as const)("classifies %s/%s without claiming a runtime gap", (status, conformance, kind, code, blocking) => {
    const matrix = syntheticMatrix([record({status, conformance})])
    const report = resolve(matrix, usage({kind: "capability", id: "test.capability"}), "strict")
    expect(report.requests[0]).toMatchObject({
      kind,
      capability: "test.capability",
      runtimeGapProven: false,
    })
    expect(report.diagnostics[0]).toMatchObject({
      code,
      blocking,
      severity: blocking ? "error" : "warning",
    })
    expect(report.requests[0]!.evidence[0]!.doesNotProve).toContain("Runtime failure")
  })

  test("report policy preserves requests but never blocks", () => {
    const matrix = syntheticMatrix([record({status: "unsupported", conformance: "none"})])
    const report = resolve(matrix, usage({kind: "capability", id: "test.capability"}), "report")
    expect(report.requests).toHaveLength(1)
    expect(report.diagnostics[0]).toMatchObject({blocking: false, severity: "warning"})
    expect(report.summary.blocking).toBe(0)
  })

  test("strict reports conformance drift while exact blocks it", () => {
    const matrix = syntheticMatrix([record({status: "implemented", conformance: "adapted"})])
    const strict = resolve(matrix, usage({kind: "capability", id: "test.capability"}), "strict")
    const exact = resolve(matrix, usage({kind: "capability", id: "test.capability"}), "exact")
    expect(strict.requests[0]?.kind).toBe("conformance")
    expect(strict.summary.blocking).toBe(0)
    expect(exact.summary.blocking).toBe(1)
  })

  test("reports a missing inventory leaf without treating it as unsupported", () => {
    const report = resolve(syntheticMatrix([]), usage({
      kind: "interface-member",
      interface: "HTMLInputElement",
      member: "futureMember",
      memberKind: "operation",
    }), "strict")
    expect(report.requests[0]).toMatchObject({
      kind: "inventory",
      capability: null,
      matrix: {status: "missing"},
      runtimeGapProven: false,
    })
  })

  test("does not choose blindly when an event selector is ambiguous", () => {
    const report = resolve(currentMatrix, usage({kind: "event", name: "change"}), "report")
    expect(report.requests[0]).toMatchObject({
      kind: "resolution",
      capability: null,
      matrix: {status: "ambiguous"},
    })
    expect(report.requests[0]!.candidateCapabilities).toEqual([
      "html.events.change",
      "html.events.change--ad50e22a",
    ])
  })

  test.each([
    ["title", "html.attributes.title"],
    ["hidden", "html.attributes.hidden"],
    ["id", "html.attributes.id"],
    ["tabIndex", "html.attributes.tabindex"],
    ["popover", "html.attributes.popover"],
  ] as const)("prefers canonical content attribute %s", (name, capability) => {
    const report = resolve(currentMatrix, usage({
      kind: "html-attribute",
      tag: "div",
      name,
      transport: "content-attribute",
    }), "report")
    expect(report.requests[0]?.capability).toBe(capability)
    expect(report.requests[0]?.kind).not.toBe("resolution")
  })

  test("maps authored custom property names to the generic custom-properties capability", () => {
    const report = resolve(currentMatrix, usage({kind: "css-property", name: "--number-field-height"}), "report")
    expect(report.requests[0]?.capability).toBe("css.features.custom-properties")
  })

  test.each([
    ["checkbox", "html.behaviors.input-type-checkbox"],
    ["number", "html.behaviors.input-type-number"],
    ["range", "html.behaviors.input-type-range"],
    ["CHECKBOX", "html.behaviors.input-type-checkbox"],
    ["", "html.behaviors.input-type-text"],
    ["not-a-state", "html.behaviors.input-type-text"],
  ] as const)("resolves static input state %j", (value, capability) => {
    const report = resolve(currentMatrix, usage({kind: "html-input-type", value}), "report")
    expect(report.requests[0]?.capability).toBe(capability)
    expect(report.requests[0]?.usage.selector).toEqual({kind: "html-input-type", value})
  })

  test("retains CSS property values while resolving the property row", () => {
    const staticReport = resolve(currentMatrix, usage({
      kind: "css-property",
      name: "color",
      value: {kind: "static", value: "red"},
    }), "report")
    const dynamicReport = resolve(currentMatrix, usage({
      kind: "css-property",
      name: "opacity",
      value: {kind: "dynamic"},
    }), "report")
    expect(staticReport.requests[0]).toMatchObject({
      capability: "css.properties.color",
      usage: {selector: {value: {kind: "static", value: "red"}}},
    })
    expect(dynamicReport.requests[0]).toMatchObject({
      capability: "css.properties.opacity",
      usage: {selector: {value: {kind: "dynamic"}}},
    })
  })

  test.each([
    ["data-state", "ready"],
    ["aria-label", null],
    ["data-empty", ""],
  ] as const)("resolves and retains CSS attribute selector [%s]", (name, value) => {
    const report = resolve(currentMatrix, usage({kind: "css-attribute-selector", name, value}), "report")
    expect(report.requests[0]).toMatchObject({
      capability: "css.types.attribute-selector",
      usage: {selector: {kind: "css-attribute-selector", name, value}},
    })
  })

  test("resolves inherited mixin-backed tabIndex property without content-attribute ambiguity", () => {
    const report = resolve(currentMatrix, usage({
      kind: "html-attribute",
      tag: "input",
      name: "tabIndex",
      transport: "property",
      operation: "binding",
      value: {kind: "static", value: 0},
    }), "report")
    expect(report.requests[0]?.capability).toBe("html.mixins.htmlorsvgormathmlelement.attributes.tabindex")
    expect(report.requests[0]?.kind).not.toBe("resolution")
  })

  test("uses the sole standard event row when target metadata is incomplete", () => {
    const report = resolve(currentMatrix, usage({
      kind: "event",
      name: "toggle",
      targetTag: "div",
    }), "report")
    expect(report.requests[0]?.capability).toBe("html.events.toggle")
  })

  test("resolves the TypeScript 7 lib.dom historical focus mixin alias explicitly", () => {
    const report = resolve(currentMatrix, usage({
      kind: "interface-member",
      standardLibrary: "lib.dom",
      interface: "HTMLOrSVGElement",
      member: "focus",
      memberKind: "operation",
    }), "report")
    expect(report.requests[0]?.capability).toBe("html.mixins.htmlorsvgormathmlelement.methods.focus")
  })

  test("does not apply the lib.dom mixin alias to an unqualified consumer interface", () => {
    const report = resolve(currentMatrix, usage({
      kind: "interface-member",
      interface: "HTMLOrSVGElement",
      member: "focus",
      memberKind: "operation",
    }), "report")
    expect(report.requests[0]).toMatchObject({kind: "inventory", capability: null})
  })
  test("resolves duplicate change events through exact target metadata", () => {
    const report = resolve(currentMatrix, usage({
      kind: "event",
      name: "change",
      target: "HTMLInputElement",
    }), "report")
    expect(report.requests[0]?.capability).toBe("html.events.change")
  })

  test("resolves the HTMLInputElement.showPicker Web IDL leaf", () => {
    const report = resolve(currentMatrix, usage({
      kind: "interface-member",
      interface: "HTMLInputElement",
      member: "showPicker",
      memberKind: "operation",
    }), "report")
    expect(report.requests[0]?.capability).toBe("html.interfaces.htmlinputelement.methods.showpicker")
  })

  test.each([
    ["data-consumer", "html.attributes.data-wildcard"],
    ["aria-label", "html.attributes.aria-wildcard"],
  ] as const)("resolves wildcard attribute %s", (name, capability) => {
    const report = resolve(currentMatrix, usage({
      kind: "html-attribute",
      tag: "div",
      name,
      transport: "content-attribute",
    }), "report")
    expect(report.requests[0]?.capability).toBe(capability)
  })

  test("resolves CSS pseudo selectors from the standard inventory", () => {
    const report = resolve(currentMatrix, usage({kind: "css-selector", name: ":hover"}), "report")
    expect(report.requests[0]?.capability).toBe("css.selectors.pseudo-class-hover")
  })

  test("keeps request identity and matrix digest stable", () => {
    const matrix = syntheticMatrix([record({status: "partial", conformance: "adapted"})])
    const input = usage({kind: "capability", id: "test.capability"})
    const first = resolve(matrix, input, "report")
    const second = resolve(structuredClone(matrix), structuredClone(input), "report")
    expect(second.requests[0]?.id).toBe(first.requests[0]?.id)
    expect(second.matrix.digest).toBe(first.matrix.digest)
    expect(first.matrix.digest).toBe(capabilityMatrixDigest(matrix))
  })

  test("validates a request report and never mutates matrix gaps", async () => {
    const gapsBefore = JSON.stringify(currentMatrix.gaps)
    const report = resolve(currentMatrix, usage({
      kind: "interface-member",
      interface: "HTMLInputElement",
      member: "showPicker",
      memberKind: "operation",
    }), "report")
    const specificationsRoot = resolvePath(rendererRoot, "specifications")
    const require = createRequire(import.meta.url)
    const Ajv = require(resolvePath(specificationsRoot, "sources/tooling/ajv2020.cjs"))
    const ajv = new Ajv({allErrors: true, strict: true, strictRequired: false})
    ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/)
    ajv.addSchema(await readJson(resolvePath(specificationsRoot, "capability.schema.json")))
    ajv.addSchema(await readJson(resolvePath(specificationsRoot, "capability-request.schema.json")))
    const validate = ajv.getSchema("https://zavx0z.dev/schemas/platform-capability-request-v1.json")
    expect(validate(report), JSON.stringify(validate.errors, null, 2)).toBe(true)
    expect(JSON.stringify(currentMatrix.gaps)).toBe(gapsBefore)
  })

  test("rejects malformed neutral usage input before resolution", () => {
    expect(() => parseCapabilityUsageFile({
      schemaVersion: 1,
      generatorVersion: "test",
      usages: [{operation: "call"}],
    })).toThrow("requiredBy")
  })
})

function resolve(
  matrix: CapabilityIndex,
  inputUsage: CapabilityUsage,
  policy: "report" | "strict" | "exact",
) {
  const source = sourceFile(inputUsage)
  return resolveCapabilityUsages({
    matrix,
    matrixPath: "/matrix.json",
    source,
    sourcePath: "/usage.json",
    policy,
  })
}

function sourceFile(inputUsage: CapabilityUsage): CapabilityUsageFile {
  return {
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    generatorVersion: GENERATOR_VERSION,
    usages: [inputUsage],
  }
}

function usage(selector: CapabilityUsage["selector"]): CapabilityUsage {
  return {
    requiredBy: {
      repository: "ui",
      package: "@ui/components",
      subject: "ResolverFixture",
      scope: "production",
      revision: "fixture-revision",
    },
    source: {
      path: "packages/components/resolver-fixture.tsx",
      start: {line: 10, column: 5},
      end: {line: 10, column: 25},
      symbol: "ResolverFixture",
    },
    operation: selector.kind === "event" ? "listen" : "call",
    selector,
    behavior: "Exercise the requested standard behavior.",
  }
}

function syntheticMatrix(records: CapabilityRecord[]): CapabilityIndex {
  return {records, gaps: [{id: "gap.fixture"}]}
}

function record(
  state: Pick<CapabilityRecord, "status" | "conformance">,
): CapabilityRecord {
  return {
    id: "test.capability",
    domain: "test",
    kind: "behavior",
    name: "fixture capability",
    description: "Synthetic resolver capability.",
    spec: {
      source: "fixture-standard",
      version: "1",
      anchor: "https://example.test/capability",
      profile: "standard",
    },
    ownerHint: {repository: "renderer", package: "@zavx0z/dom", stage: "semantic"},
    ...state,
    owner: {repository: "renderer", package: "@zavx0z/dom", stage: "semantic"},
    limitations: state.status === "implemented" ? [] : ["Fixture limitation."],
    ...(state.status === "not-applicable" ? {reason: "Fixture profile exclusion."} : {}),
    evidence: [],
    consumers: [],
    blockedBy: [],
    blocks: [],
    lastVerified: {revision: "fixture-revision", date: "2026-09-01"},
  }
}
