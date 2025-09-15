import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "../../index"
import { Context } from "@zavx0z/context"

const html = String.raw

describe("map", () => {
  // https://zavx0z.github.io/template/interfaces/NodeMap.html#%D0%B8%D1%82%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D1%8F-%D0%BE%D0%B4%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D0%BD%D0%BE%D0%B3%D0%BE-%D0%BC%D0%B0%D1%81%D1%81%D0%B8%D0%B2%D0%B0
  let element: HTMLElement
  
  const ctx = new Context((t) => ({
    list: t.array.required(["one", "two"]),
  }))

  const st = {
    state: "",
    states: [],
  }

  beforeAll(() => {
    element = render({
      el: document.createElement("div"),
      ctx,
      st,
      core: {},
      tpl: ({ html, context }) => html`
        <ul>
          ${context.list.map((name) => html`<li>${name}</li>`)}
        </ul>
      `,
    })
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
