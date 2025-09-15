import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "../../index"
import { Context } from "@zavx0z/context"

const html = String.raw

describe("map", () => {
  let element: HTMLElement
  const ctx = new Context((t) => ({
    ids: t.array.required([1, 2, 3])({ title: "ids" }),
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
          ${context.ids.map((id) => html`<li>${id}</li>`)}
        </ul>
      `,
    })
  })
  it("рендер", () => {
    expect(element.innerHTML).toMatchStringHTML(html`
      <ul>
        <li>1</li>
        <li>2</li>
        <li>3</li>
      </ul>
    `)
  })
})
