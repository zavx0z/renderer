import { afterAll, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { adaptTemplateCapabilityManifest } from "./adapt-template-usage.ts"
import {
  parseConsumerCheckOptions,
  runConsumerCheck,
} from "./consumer-check.ts"
import { readJson, rendererRoot } from "./model.ts"
import type {CapabilityConsumerIdentity} from "./model.ts"
import {
  resolveCapabilityUsages,
} from "./resolve-usage.ts"
import type {CapabilityIndex} from "./resolve-usage.ts"

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "renderer-capability-consumer-check-"))
const matrixPath = resolve(rendererRoot, "capabilities.index.json")
const matrix = await readJson<CapabilityIndex>(matrixPath)
const consumer: CapabilityConsumerIdentity = {
  repository: "ui",
  package: "@ui/components",
  subject: "TemplateManifestFixture",
  scope: "production",
  revision: "fixture-revision",
}

afterAll(async () => {
  await rm(temporaryRoot, {recursive: true, force: true})
})

describe("Template capability manifest adapter", () => {
  test("fails closed for the incompatible Template v1 manifest", () => {
    expect(() => adaptTemplateCapabilityManifest({
      schemaVersion: 1,
      generatorVersion: "template-capability-usage-v1",
      files: [],
    }, consumer)).toThrow("schemaVersion must be 2")
  })

  test("routes template-extension elements to project inventory rather than HTML", () => {
    const adapted = adaptTemplateCapabilityManifest(templateManifest([{
      kind: "intrinsic-element",
      profile: "template-extension",
      tagName: "vector-path",
      source: source(),
    }]), consumer)
    expect(adapted.usages.map(usage => usage.selector)).toEqual([
      {kind: "named-capability", domain: "tsx", capabilityKind: "tsx-compiler", name: "intrinsic elements"},
      {kind: "project-element", tag: "vector-path"},
    ])
    expect(adapted.usages.some(usage => usage.selector.kind === "html-element")).toBe(false)

    const compilerRecord = matrix.records.find(record => record.id === "tsx.compiler.intrinsic-elements")
    const vectorRecord = matrix.records.find(record => record.id === "dom.project.vector-path-element")
    if (!compilerRecord || !vectorRecord) throw new Error("Missing project element fixture capabilities")
    const report = resolveCapabilityUsages({
      matrix: {records: [compilerRecord, vectorRecord]},
      matrixPath: "/matrix.json",
      source: adapted,
      sourcePath: "/template-manifest.json",
      policy: "strict",
    })
    expect(report.requests).toEqual([])
  })

  test("adapts events, refs, CSS pseudo selectors, and lib.dom members", () => {
    const adapted = adaptTemplateCapabilityManifest(templateManifest([
      {kind: "event", tagName: "input", propName: "onChange", eventType: "change", capture: false, source: source()},
      {kind: "ref", tagName: "input", mode: "callback", source: source(2)},
      {kind: "css-pseudo", name: "hover", source: source(3)},
      {kind: "dom-member", standardLibrary: "lib.dom", interfaceName: "HTMLInputElement", memberName: "showPicker", operation: "call", source: source(4)},
    ]), consumer)
    expect(adapted.usages.map(usage => usage.selector)).toContainEqual({
      kind: "event",
      name: "change",
      targetTag: "input",
      capture: false,
    })
    expect(adapted.usages.map(usage => usage.selector)).toContainEqual({kind: "css-selector", name: ":hover"})
    expect(adapted.usages.map(usage => usage.selector)).toContainEqual({
      kind: "interface-member",
      interface: "HTMLInputElement",
      member: "showPicker",
      standardLibrary: "lib.dom",
      memberKind: "operation",
    })
  })

  test("preserves intrinsic transport, operation and values and resolves static input states", () => {
    const adapted = adaptTemplateCapabilityManifest(templateManifest([
      intrinsicType("checkbox", 1),
      intrinsicType("number", 2),
      intrinsicType("range", 3),
      intrinsicType("CHECKBOX", 4),
      intrinsicType("", 5),
      intrinsicType("not-a-state", 6),
      {
        kind: "intrinsic-attribute",
        tagName: "input",
        name: "type",
        operation: "binding",
        transport: "content-attribute",
        value: {kind: "dynamic"},
        source: source(7),
      },
    ]), consumer)
    const attributeSelectors = adapted.usages
      .map(usage => usage.selector)
      .filter(selector => selector.kind === "html-attribute")
    expect(attributeSelectors).toContainEqual({
      kind: "html-attribute",
      tag: "input",
      name: "type",
      transport: "content-attribute",
      operation: "mount",
      value: {kind: "static", value: "checkbox"},
    })
    expect(attributeSelectors).toContainEqual({
      kind: "html-attribute",
      tag: "input",
      name: "type",
      transport: "content-attribute",
      operation: "binding",
      value: {kind: "dynamic"},
    })
    expect(adapted.usages
      .map(usage => usage.selector)
      .filter(selector => selector.kind === "html-input-type")
      .map(selector => selector.value)).toEqual([
        "checkbox",
        "number",
        "range",
        "CHECKBOX",
        "",
        "not-a-state",
      ])

    const report = resolveCapabilityUsages({
      matrix,
      matrixPath,
      source: adapted,
      sourcePath: "/template-manifest.json",
      policy: "report",
    })
    const inputStates = report.requests.filter(request => request.usage.selector.kind === "html-input-type")
    expect(inputStates.map(request => request.capability)).toEqual([
      "html.behaviors.input-type-checkbox",
      "html.behaviors.input-type-number",
      "html.behaviors.input-type-range",
      "html.behaviors.input-type-checkbox",
      "html.behaviors.input-type-text",
      "html.behaviors.input-type-text",
    ])
    expect(report.requests.some(request =>
      request.usage.selector.kind === "html-attribute" &&
      request.usage.selector.value?.kind === "dynamic")).toBe(true)
  })

  test("preserves CSS values and authored attribute selector operands", () => {
    const adapted = adaptTemplateCapabilityManifest(templateManifest([
      {kind: "css-property", name: "color", value: {kind: "static", value: "red"}, source: source(1)},
      {kind: "css-property", name: "opacity", value: {kind: "dynamic"}, source: source(2)},
      {kind: "css-attribute-selector", name: "data-state", value: "ready", source: source(3)},
      {kind: "css-attribute-selector", name: "aria-label", value: null, source: source(4)},
      {kind: "css-attribute-selector", name: "data-empty", value: "", source: source(5)},
    ]), consumer)
    expect(adapted.usages.map(usage => usage.selector)).toContainEqual({
      kind: "css-property",
      name: "color",
      value: {kind: "static", value: "red"},
    })
    expect(adapted.usages.map(usage => usage.selector)).toContainEqual({
      kind: "css-property",
      name: "opacity",
      value: {kind: "dynamic"},
    })
    expect(adapted.usages.map(usage => usage.selector)).toContainEqual({
      kind: "css-attribute-selector",
      name: "data-empty",
      value: "",
    })
    const report = resolveCapabilityUsages({
      matrix,
      matrixPath,
      source: adapted,
      sourcePath: "/template-manifest.json",
      policy: "report",
    })
    expect(report.requests.filter(request => request.usage.selector.kind === "css-attribute-selector")
      .map(request => request.capability)).toEqual([
        "css.types.attribute-selector",
        "css.types.attribute-selector",
        "css.types.attribute-selector",
      ])
    expect(report.requests.find(request =>
      request.usage.selector.kind === "css-property" && request.usage.selector.name === "color")
      ?.expected.behavior).toContain("static value \"red\"")
    expect(report.requests.find(request =>
      request.usage.selector.kind === "css-property" && request.usage.selector.name === "opacity")
      ?.expected.behavior).toContain("dynamic value")
  })

  test("accepts implemented project-contract extensions without a conformance request", () => {
    const adapted = adaptTemplateCapabilityManifest(templateManifest([{
      kind: "intrinsic-element",
      profile: "html",
      tagName: "input",
      source: source(),
    }]), consumer)
    const report = resolveCapabilityUsages({
      matrix,
      matrixPath,
      source: adapted,
      sourcePath: "/template-manifest.json",
      policy: "report",
    })
    expect(report.requests.map(request => request.capability)).not.toContain("tsx.compiler.intrinsic-elements")
    expect(report.requests.map(request => request.capability)).toContain("html.elements.input")
  })

  test("runs the consumer CLI bridge directly from a Template manifest", async () => {
    const sourcePath = resolve(temporaryRoot, "template-capability-usages.json")
    const outputPath = resolve(temporaryRoot, "capability-requests.json")
    await Bun.write(sourcePath, JSON.stringify(templateManifest([
      {
        kind: "dom-member",
        standardLibrary: "lib.dom",
        interfaceName: "HTMLInputElement",
        memberName: "showPicker",
        operation: "call",
        source: source(),
      },
      {kind: "css-attribute-selector", name: "data-empty", value: "", source: source(2)},
    ])))
    const options = parseConsumerCheckOptions([
      "--matrix", matrixPath,
      "--source", sourcePath,
      "--output", outputPath,
      "--source-format", "template",
      "--policy", "report",
      "--repository", consumer.repository,
      "--package", consumer.package,
      "--subject", consumer.subject,
      "--scope", consumer.scope,
      "--revision", consumer.revision,
    ])
    const result = await runConsumerCheck(options)
    expect(result.exitCode).toBe(0)
    expect(result.report.requests[0]?.capability).toBe("html.interfaces.htmlinputelement.methods.showpicker")
    expect(await readJson<unknown>(outputPath)).toEqual(result.report)
  })
})

function templateManifest(usages: unknown[]) {
  return {
    schemaVersion: 2,
    generatorVersion: "template-capability-usage-v2",
    files: [{path: "packages/components/fixture.tsx", usages}],
  }
}

function source(line = 1) {
  return {
    path: "packages/components/fixture.tsx",
    start: {line, column: 1, offset: line - 1},
    end: {line, column: 10, offset: line + 8},
  }
}

function intrinsicType(value: string, line: number) {
  return {
    kind: "intrinsic-attribute",
    tagName: "input",
    name: "type",
    operation: "mount",
    transport: "content-attribute",
    value: {kind: "static", value},
    source: source(line),
  }
}
