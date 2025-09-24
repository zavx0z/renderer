import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { contextSchema, contextFromSchema } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw

describe("map", () => {
  // https://zavx0z.github.io/template/interfaces/NodeMap.html#%D0%B8%D1%82%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F-%D0%BE%D0%B4%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D0%BD%D0%BE%D0%B3%D0%BE-%D0%BC%D0%B0%D1%81%D1%81%D0%B8%D0%B2%D0%B0
  let element: HTMLElement

  const schema = contextSchema((t) => ({
    list: t.array.required(["one", "two"]),
  }))
  const ctx = contextFromSchema(schema)

  beforeAll(() => {
    const nodes = parse<typeof ctx.context>(
      ({ html, context }) => html`
        <ul>
          ${context.list.map((name) => html`<li>${name}</li>`)}
        </ul>
      `
    )
    element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
  })
  it("рендер", () => {
    expect(element.innerHTML).toMatchStringHTML(html`
      <ul>
        <li>one</li>
        <li>two</li>
      </ul>
    `)
  })
})
