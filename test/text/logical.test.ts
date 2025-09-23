import { describe, it, expect, beforeAll } from "bun:test"
import { Context } from "@zavx0z/context"
import { render } from "@zavx0z/renderer"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw

describe("логические значения", () => {
  // https://zavx0z.github.io/template/interfaces/NodeText.html#%D0%BB%D0%BE%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B9-%D0%BB%D0%B8%D1%82%D0%B5%D1%80%D0%B0%D0%BB
  const ctx = new Context((t) => ({ last: t.string.optional("Latte") }))
  let element: HTMLElement
  beforeAll(() => {
    const nodes = parse(({ html, context }) => html` <p>${context.last && `last: ${context.last}`}</p>`)
    element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
  })
  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`<p>last: Latte</p>`)
  })
  it("update", () => {
    ctx.update({ last: "Espresso" })
    expect(element.innerHTML).toMatchStringHTML(html`<p>last: Espresso</p>`)
  })
})
