import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"
import {toLong} from "./internal/web-idl.ts"

export type HTMLTableCellTagName = "th" | "td"

const knownScopes = new Set(["row", "col", "rowgroup", "colgroup"])

function reflectedRange(
  value: string | null,
  minimum: number,
  maximum: number
): number {
  const match = /^[\t\n\f\r ]*\+?(\d+)/.exec(value ?? "")
  if (!match?.[1]) return 1
  const parsed = Number(match[1])
  return Math.min(maximum, Math.max(minimum, parsed))
}

function reflectedRangeSetter(value: number): number {
  const converted = toLong(value, 32, true)
  return converted <= 2147483647 ? converted : 1
}

export class HTMLTableCellElement extends HTMLElement {
  constructor(ownerDocument: Document, localName: HTMLTableCellTagName) {
    super(ownerDocument, localName)
  }

  get colSpan(): number {
    return reflectedRange(this.getAttribute("colspan"), 1, 1000)
  }

  set colSpan(value: number) {
    this.setAttribute("colspan", String(reflectedRangeSetter(value)))
  }

  get rowSpan(): number {
    return reflectedRange(this.getAttribute("rowspan"), 0, 65534)
  }

  set rowSpan(value: number) {
    this.setAttribute("rowspan", String(reflectedRangeSetter(value)))
  }

  get scope(): string {
    const value = (this.getAttribute("scope") ?? "").toLowerCase()
    return knownScopes.has(value) ? value : ""
  }

  set scope(value: string) {
    this.setAttribute("scope", value)
  }
}
