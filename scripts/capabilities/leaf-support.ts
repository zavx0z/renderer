import type {CapabilityInventoryEntry} from "./model.ts"

export type ReviewedLeafPresence = "present" | "absent"

const presentEventMembers = new Set([
  "AT_TARGET",
  "BUBBLING_PHASE",
  "CAPTURING_PHASE",
  "Event",
  "NONE",
  "bubbles",
  "cancelable",
  "composed",
  "constructor",
  "currentTarget",
  "defaultPrevented",
  "eventPhase",
  "isTrusted",
  "preventDefault",
  "stopImmediatePropagation",
  "stopPropagation",
  "target",
  "timeStamp",
  "type",
])

const presentHtmlInputMembers = new Set([
  "HTMLInputElement",
  "HTMLInputElement inherits HTMLElement",
  "checked",
  "constructor",
  "defaultChecked",
  "defaultValue",
  "disabled",
  "indeterminate",
  "max",
  "min",
  "placeholder",
  "readOnly",
  "required",
  "select",
  "selectionDirection",
  "selectionEnd",
  "selectionStart",
  "setSelectionRange",
  "step",
  "type",
  "value",
  "valueAsNumber",
])

/**
 * Returns a reviewed leaf presence only for Event itself and its direct Web IDL
 * children. Other Event-prefixed definitions keep their independent owner audit.
 */
export function reviewedEventLeafPresence(
  entry: Pick<CapabilityInventoryEntry, "id" | "name" | "parent">,
): ReviewedLeafPresence | null {
  if (entry.id !== "dom.interfaces.event" && entry.parent !== "dom.interfaces.event") return null
  return presentEventMembers.has(entry.name) ? "present" : "absent"
}

/**
 * Returns the explicit reviewed HTMLInputElement surface. A matching standard
 * name is never treated as implementation evidence by itself.
 */
export function reviewedHtmlInputLeafPresence(
  entry: Pick<CapabilityInventoryEntry, "id" | "name" | "parent">,
): ReviewedLeafPresence | null {
  if (entry.id === "html.interfaces.htmlinputelement" || entry.parent === "html.interfaces.htmlinputelement") {
    return presentHtmlInputMembers.has(entry.name) ? "present" : "absent"
  }
  if (entry.id.startsWith("html.reflections.htmlinputelement.")) {
    const member = /^HTMLInputElement\.(.+) reflection$/.exec(entry.name)?.[1]
    return member && presentHtmlInputMembers.has(member) ? "present" : "absent"
  }
  return null
}
