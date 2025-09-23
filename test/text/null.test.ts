import { describe, it, expect, beforeAll } from "bun:test"
import { Context } from "@zavx0z/context"
import { render } from "@zavx0z/renderer"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw

describe("текстовые узлы — null не рендерится", () => {
  const ctx = new Context((t) => ({
    cups: t.number.required(0),
    last: t.string.optional(), // по умолчанию null
  }))

  const core = {}

  let element: HTMLElement
  beforeAll(() => {
    const nodes = parse(
      ({ html, context, state }) => html`
        <p>Status: ${state === "open" ? "Open" : "Closed"} Orders: ${context.cups} ${context.last}</p>
      `
    )
    element = render({ el: document.createElement("div"), ctx, st: { ...st, state: "open" }, core, nodes })
  })
  it("render", () => {
    expect(element.innerHTML, "не должен содержать 'null'").toMatchStringHTML(html`<p>Status: Open Orders: 0</p>`)
  })
  it("update", () => {
    ctx.update({ last: "Espresso" })
    expect(element.innerHTML, "должен содержать 'Espresso'").toMatchStringHTML(
      html`<p>Status: Open Orders: 0 Espresso</p>`
    )
  })
})
