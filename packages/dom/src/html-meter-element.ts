import type {Document} from "./document.ts"
import {HTMLElement} from "./html-element.ts"
import {
  finiteHTMLNumber,
  parseHTMLFloatingPointNumberPrefix,
  serializeHTMLNumber
} from "./internal/html-number.ts"

export class HTMLMeterElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "meter")
  }

  get min(): number {
    return this.attributeNumber("min") ?? 0
  }

  set min(value: number) {
    this.setNumberAttribute("min", value)
  }

  get max(): number {
    return Math.max(this.min, this.attributeNumber("max") ?? 1)
  }

  set max(value: number) {
    this.setNumberAttribute("max", value)
  }

  get value(): number {
    return Math.max(this.min, Math.min(this.max, this.attributeNumber("value") ?? 0))
  }

  set value(value: number) {
    this.setNumberAttribute("value", value)
  }

  get low(): number {
    return Math.max(this.min, Math.min(this.max, this.attributeNumber("low") ?? this.min))
  }

  set low(value: number) {
    this.setNumberAttribute("low", value)
  }

  get high(): number {
    return Math.max(this.low, Math.min(this.max, this.attributeNumber("high") ?? this.max))
  }

  set high(value: number) {
    this.setNumberAttribute("high", value)
  }

  get optimum(): number {
    const fallback = this.min + (this.max - this.min) / 2
    return Math.max(this.min, Math.min(this.max, this.attributeNumber("optimum") ?? fallback))
  }

  set optimum(value: number) {
    this.setNumberAttribute("optimum", value)
  }

  private attributeNumber(name: string): number | null {
    return parseHTMLFloatingPointNumberPrefix(this.getAttribute(name) ?? "")
  }

  private setNumberAttribute(name: string, value: number): void {
    this.setAttribute(name, serializeHTMLNumber(finiteHTMLNumber(value)))
  }
}
