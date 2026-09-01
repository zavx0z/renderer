import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import {Event, createDocument} from "@zavx0z/dom"
import { readJson, rendererRoot } from "./model.ts"
import type {CapabilityRecord} from "./model.ts"
import {
  reviewedEventLeafPresence,
  reviewedHtmlInputLeafPresence,
} from "./leaf-support.ts"

const matrix = await readJson<{records: CapabilityRecord[]}>(resolve(rendererRoot, "capabilities.index.json"))
const records = new Map(matrix.records.map(record => [record.id, record]))
const runtimeEvent = new Event("leaf-support-audit")
const runtimeInput = createDocument().createElement("input")

describe("reviewed DOM leaf support", () => {
  test.each([
    "dom.interfaces.event.attributes.currenttarget",
    "dom.interfaces.event.methods.preventdefault",
    "dom.interfaces.event.constants.at_target",
  ])("keeps reviewed Event leaf %s present", id => {
    expect(reviewedEventLeafPresence(requiredRecord(id))).toBe("present")
  })

  test.each([
    "dom.interfaces.event.attributes.cancelbubble",
    "dom.interfaces.event.attributes.returnvalue",
    "dom.interfaces.event.attributes.srcelement",
    "dom.interfaces.event.methods.composedpath",
    "dom.interfaces.event.methods.initevent",
  ])("fails absent Event leaf %s closed", id => {
    expect(reviewedEventLeafPresence(requiredRecord(id))).toBe("absent")
  })

  test.each([
    "html.interfaces.htmlinputelement.attributes.checked",
    "html.interfaces.htmlinputelement.attributes.valueasnumber",
    "html.interfaces.htmlinputelement.methods.select",
    "html.interfaces.htmlinputelement.methods.setselectionrange",
  ])("keeps reviewed HTMLInputElement leaf %s present", id => {
    expect(reviewedHtmlInputLeafPresence(requiredRecord(id))).toBe("present")
  })

  test.each([
    "html.interfaces.htmlinputelement.attributes.files",
    "html.interfaces.htmlinputelement.attributes.validationmessage",
    "html.interfaces.htmlinputelement.methods.checkvalidity",
    "html.interfaces.htmlinputelement.methods.reportvalidity",
    "html.interfaces.htmlinputelement.methods.showpicker",
  ])("fails absent HTMLInputElement leaf %s closed", id => {
    expect(reviewedHtmlInputLeafPresence(requiredRecord(id))).toBe("absent")
  })

  test("does not classify another interface from a matching member name", () => {
    const selectShowPicker = matrix.records.find(record =>
      record.id === "html.interfaces.htmlselectelement.methods.showpicker")
    expect(selectShowPicker).toBeDefined()
    expect(reviewedHtmlInputLeafPresence(selectShowPicker!)).toBeNull()
  })

  test("keeps every reviewed leaf synchronized with the actual runtime surface", () => {
    for (const record of matrix.records) {
      const eventPresence = reviewedEventLeafPresence(record)
      if (eventPresence !== null) {
        expect(eventPresence, record.id).toBe(runtimeEventMember(record) ? "present" : "absent")
      }
      const inputPresence = reviewedHtmlInputLeafPresence(record)
      if (inputPresence !== null) {
        expect(inputPresence, record.id).toBe(runtimeInputMember(record) ? "present" : "absent")
      }
    }
  })

  test("dates absent leaf verdicts to the focused audit and cites its negative proof", () => {
    for (const record of matrix.records) {
      const reviewedPresence = reviewedEventLeafPresence(record) ??
        reviewedHtmlInputLeafPresence(record)
      if (reviewedPresence !== "absent") continue
      expect(record.status, record.id).toBe("unsupported")
      expect(record.conformance, record.id).toBe("none")
      expect(record.lastVerified.date, record.id).toBe("2026-09-01")
      expect(record.evidence.some(evidence =>
        evidence.type === "negative-test" &&
        evidence.path === "scripts/capabilities/leaf-support.test.ts"
      ), record.id).toBe(true)
    }
  })

  test.each([
    ["html.interfaces.htmlinputelement.attributes.indeterminate", "packages/dom/test/input-numeric-state.test.ts"],
    ["html.interfaces.htmlinputelement.attributes.valueasnumber", "packages/dom/test/input-numeric-state.test.ts"],
    ["html.interfaces.htmlinputelement.attributes.selectionstart", "packages/dom/test/text-selection.test.ts"],
    ["html.interfaces.htmlinputelement.methods.setselectionrange", "packages/dom/test/text-selection.test.ts"],
    ["html.interfaces.htmlinputelement.attributes.checked", "packages/dom/test/html-input-element.test.ts"],
  ] as const)("routes reviewed leaf %s to its focused behavioral evidence", (id, path) => {
    const record = requiredRecord(id)
    expect(record.evidence.some(evidence => evidence.path === path), id).toBe(true)
  })

  test.each([
    "css.types.attribute-selector",
    "dom.mixins.parentnode.methods.queryselector",
    "dom.mixins.parentnode.methods.queryselectorall",
    "html.events.focus",
    "html.interfaces.toggleevent.attributes.newstate",
    "html.mixins.htmlorsvgormathmlelement.attributes.tabindex",
    "html.mixins.htmlorsvgormathmlelement.methods.focus",
    "html.reflections.htmlorsvgormathmlelement.tabindex",
    "html.elements.aside.interface-mapping",
    "html.elements.code.interface-mapping",
    "html.elements.footer.interface-mapping",
    "html.elements.header.interface-mapping",
    "html.elements.nav.interface-mapping",
    "html.elements.section.interface-mapping",
    "html.elements.strong.interface-mapping",
  ])("keeps the focused UI-used capability %s partial with current evidence", id => {
    const record = requiredRecord(id)
    expect(record.status, id).toBe("partial")
    expect(record.conformance, id).toBe("adapted")
    expect(record.lastVerified.date, id).toBe("2026-09-01")
    expect(record.evidence.some(evidence => evidence.type === "implementation"), id).toBe(true)
    expect(record.evidence.some(evidence => evidence.type === "unit-test"), id).toBe(true)
  })

  test.each([
    "html.elements.hr.interface-mapping",
    "html.elements.ol.interface-mapping",
    "html.elements.optgroup.interface-mapping",
    "html.elements.output.interface-mapping",
    "html.elements.pre.interface-mapping",
  ])("does not claim an absent specialized mapping for %s", id => {
    const record = requiredRecord(id)
    expect(record.status, id).toBe("unsupported")
    expect(record.conformance, id).toBe("none")
  })
})

function runtimeEventMember(record: CapabilityRecord): boolean {
  if (record.id === "dom.interfaces.event" || record.name === "Event") return true
  return record.name in runtimeEvent
}

function runtimeInputMember(record: CapabilityRecord): boolean {
  if (record.id === "html.interfaces.htmlinputelement" ||
    record.name === "HTMLInputElement" ||
    record.name === "HTMLInputElement inherits HTMLElement") return true
  const reflection = /^HTMLInputElement\.(.+) reflection$/.exec(record.name)?.[1]
  return (reflection ?? record.name) in runtimeInput
}

function requiredRecord(id: string): CapabilityRecord {
  const record = records.get(id)
  if (!record) throw new Error(`Missing fixture capability: ${id}`)
  return record
}
