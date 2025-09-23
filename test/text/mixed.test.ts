import { describe, it, expect, beforeAll } from "bun:test"
import { Context } from "@zavx0z/context"
import { render } from "@zavx0z/renderer"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw

describe("микс статических и динамических значений", () => {
  const ctx = new Context((t) => ({
    family: t.string.optional("Filipenko"),
    name: t.string.optional("Vladimir"),
  }))
  let element: HTMLElement
  beforeAll(() => {
    const nodes = parse(({ html, context }) => html`<p>Hello, ${context.family} ${context.name}!</p>`)
    element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
  })
  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`<p>Hello, Filipenko Vladimir!</p>`)
  })
  it("update", () => {
    ctx.update({ family: "Guido", name: "van Rossum" })
    expect(element.innerHTML).toMatchStringHTML(html`<p>Hello, Guido van Rossum!</p>`)
  })
})
