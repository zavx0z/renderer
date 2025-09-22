import { describe, it, expect, beforeAll } from "bun:test"
import { Context } from "@zavx0z/context"
import { render } from "@zavx0z/renderer"
import { parse } from "@zavx0z/template"

const html = String.raw

describe("статические значения", () => {
  // https://zavx0z.github.io/template/interfaces/NodeText.html#статический
  const ctx = new Context((t) => ({}))
  let element: HTMLElement
  beforeAll(() => {
    const nodes = parse(({ html }) => html`Static text`)
    element = render({
      el: document.createElement("div"),
      ctx,
      st: { state: "", states: [] },
      core: {},
      nodes,
    })
  })
  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`Static text`)
  })
})
