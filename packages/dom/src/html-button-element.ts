import type {Document} from "./document.ts"
import {Event} from "./event.ts"
import {HTMLElement} from "./html-element.ts"
import {buttonActivationBehavior} from "./internal/activation.ts"
import {disabledByAncestorFieldSet} from "./internal/disabled.ts"
import {isProgrammaticallyFocusable} from "./internal/focus.ts"
import {MouseEvent} from "./mouse-event.ts"

export class HTMLButtonElement extends HTMLElement {
  constructor(ownerDocument: Document) {
    super(ownerDocument, "button")
  }

  get disabled(): boolean {
    return this.hasAttribute("disabled")
  }

  set disabled(value: boolean) {
    if (value) this.setAttribute("disabled", "")
    else this.removeAttribute("disabled")
  }

  get type(): "submit" | "reset" | "button" {
    const value = this.getAttribute("type")?.toLowerCase()
    return value === "reset" || value === "button" ? value : "submit"
  }

  set type(value: string) {
    this.setAttribute("type", value)
  }

  click(): void {
    if (this.disabled || disabledByAncestorFieldSet(this)) return
    const event = new MouseEvent("click", {bubbles: true, cancelable: true, composed: true})
    if (this.dispatchEvent(event)) this[buttonActivationBehavior](event)
  }

  protected [buttonActivationBehavior](_event: Event): void {}

  override [isProgrammaticallyFocusable](): boolean {
    return !this.disabled &&
      !disabledByAncestorFieldSet(this) &&
      super[isProgrammaticallyFocusable]()
  }

  protected override get defaultTabIndex(): number {
    return 0
  }
}
