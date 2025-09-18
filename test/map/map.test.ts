import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw

describe("map вложенный в map", () => {
  let element: HTMLElement
  const ctx = new Context((t) => ({}))

  const st = {
    state: "",
    states: [],
  }

  const core = {
    list: [
      { title: "one", nested: ["one", "two"] },
      { title: "two", nested: ["one", "two"] },
    ],
  }

  beforeAll(() => {
    element = render({
      el: document.createElement("div"),
      ctx,
      st,
      core,
      tpl: ({ html, core }) => html`
        <ul>
          ${core.list.map(
            ({ title, nested }) => html`
              <li>
                <p>${title}</p>
                ${nested.map((n) => html`<em>${n}</em>`)}
              </li>
            `
          )}
        </ul>
      `,
    })
  })
  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`
      <ul>
        <li>
          <p>one</p>
          <em>one</em>
          <em>two</em>
        </li>
        <li>
          <p>two</p>
          <em>one</em>
          <em>two</em>
        </li>
      </ul>
    `)
  })
})
