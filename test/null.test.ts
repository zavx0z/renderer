import { describe, it, expect } from "bun:test"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { Renderer } from "../index"

const html = String.raw

describe("текстовые узлы — null не рендерится", () => {
  const { context, update } = new Context((t) => ({
    cups: t.number.required(0)(),
    last: t.string.optional()(), // по умолчанию null
  }))

  const core = {}
  type State = "open" | "closed"
  let state: State = "open"

  const nodes = parse<typeof context, typeof core, State>(
    ({ html, context, state }) => html`
      <p>Status: ${state === "open" ? "Open" : "Closed"} Orders: ${context.cups}${context.last}</p>
    `
  )

  it("не вставляет 'null' в текст", () => {
    const root = document.createElement("div")
    new Renderer(root, nodes, context, update, state, core)
    expect(root.innerHTML).toMatchStringHTML(
      html`<p>Status: Open Orders: 0</p>` // ← без 'null' в конце
    )
  })
})
