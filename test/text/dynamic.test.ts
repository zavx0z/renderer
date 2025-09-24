import { describe, it, expect, beforeAll } from "bun:test"
import { contextSchema, contextFromSchema } from "@zavx0z/context"
import { render } from "@zavx0z/renderer"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw

describe("динамические значения", () => {
  // https://zavx0z.github.io/template/interfaces/NodeText.html#динамический
  const schema = contextSchema((t) => ({ dynamic: t.string.required("Dynamic text") }))
  const ctx = contextFromSchema(schema)
  let element: HTMLElement
  beforeAll(() => {
    const nodes = parse(({ html, context }) => html`<p>${context.dynamic}</p>`)
    element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
  })
  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`<p>Dynamic text</p>`)
  })
  it("update", () => {
    ctx.update({ dynamic: "Updated text" })
    expect(element.innerHTML).toMatchStringHTML(html`<p>Updated text</p>`)
  })
})
