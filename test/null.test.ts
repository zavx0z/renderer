import { describe, it, expect, beforeAll } from "bun:test"
import { Context } from "@zavx0z/context"

import { render } from "../index"

const html = String.raw

describe("текстовые узлы — null не рендерится", () => {
  const ctx = new Context((t) => ({
    cups: t.number.required(0)(),
    last: t.string.optional()(), // по умолчанию null
  }))

  const st = {
    state: "open",
    states: ["open", "closed"],
  }

  const core = {}

  let element: HTMLElement
  beforeAll(() => {
    element = render({
      el: document.createElement("div"),
      ctx,
      st,
      core,
      tpl: ({ html, context, state }) => html`
        <p>Status: ${state === "open" ? "Open" : "Closed"} Orders: ${context.cups}${context.last}</p>
      `,
    })
  })
  it("не вставляет 'null' в текст", () => {
    expect(element.innerHTML).toMatchStringHTML(
      html`<p>Status: Open Orders: 0</p>` // ← без 'null' в конце
    )
  })
})
