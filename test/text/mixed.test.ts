import { describe, it, expect, beforeAll } from "bun:test"
import { Context } from "@zavx0z/context"
import { render } from "@zavx0z/renderer"

const html = String.raw

describe("микс статических и динамических значений", () => {
  const ctx = new Context((t) => ({
    family: t.string.optional("Filipenko"),
    name: t.string.optional("Vladimir"),
  }))
  let element: HTMLElement
  beforeAll(() => {
    element = render({
      el: document.createElement("div"),
      ctx,
      st: { state: "", states: [] },
      core: {},
      tpl: ({ html, context }) => html`<p>Hello, ${context.family} ${context.name}!</p>`,
    })
  })
  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`<p>Hello, Filipenko Vladimir!</p>`)
  })
  it("update", () => {
    ctx.update({ family: "Guido", name: "van Rossum" })
    expect(element.innerHTML).toMatchStringHTML(html`<p>Hello, Guido van Rossum!</p>`)
  })
})
