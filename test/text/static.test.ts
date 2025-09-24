import { describe, it, expect, beforeAll } from "bun:test"
import { contextSchema, contextFromSchema } from "@zavx0z/context"
import { render } from "@zavx0z/renderer"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw

describe("статические значения", () => {
  // https://zavx0z.github.io/template/interfaces/NodeText.html#статический
  const schema = contextSchema((t) => ({}))
  const ctx = contextFromSchema(schema)
  let element: HTMLElement
  beforeAll(() => {
    const nodes = parse(({ html }) => html`Static text`)
    element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
  })
  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`Static text`)
  })
})
