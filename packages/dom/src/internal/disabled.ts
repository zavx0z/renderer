import type {HTMLElement} from "../html-element.ts"

export function disabledByAncestorFieldSet(element: HTMLElement): boolean {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.localName !== "fieldset" || !ancestor.hasAttribute("disabled")) continue
    const firstLegend = ancestor.children.find(child => child.localName === "legend") ?? null
    if (firstLegend?.contains(element)) continue
    return true
  }
  return false
}
