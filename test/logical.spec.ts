import { describe, it, expect, beforeAll } from "bun:test"
import { parse, type Node } from "@zavx0z/template"
import { Renderer } from "../index"
import { Context } from "@zavx0z/context"

const html = String.raw

describe("логические операторы с условиями", () => {
  describe("&& &&", () => {
    // https://zavx0z.github.io/template/interfaces/NodeLogical.html#%D1%81%D0%BB%D0%BE%D0%B6%D0%BD%D0%BE%D0%B5-%D0%BB%D0%BE%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%BE%D0%B5-%D1%83%D1%81%D0%BB%D0%BE%D0%B2%D0%B8%D0%B5
    type Context = { isAdmin: boolean }
    type Core = { user: { role: string } }
    let elements: Node[]
    const { context, update } = new Context((t) => ({
      isAdmin: t.boolean.required(true),
    }))
    const core = {
      user: { role: "admin" },
    }
    let state = "open"
    let renderer: Renderer
    const element = document.createElement("div")

    beforeAll(() => {
      elements = parse<Context, Core>(
        ({ html, context, core }) => html`
          <div>${core.user && context.isAdmin && html`<div class="admin">Admin Panel</div>`}</div>
        `
      )
    })

    it("render", () => {
      renderer = new Renderer(element, elements, context, update, state, core)
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="admin">Admin Panel</div>
        </div>
      `)
    })
    
    it("update", () => {
      const updated = update({ isAdmin: false })
      renderer.update({ context: updated })
      expect(element.innerHTML).toMatchStringHTML(html`<div></div>`)
    })
  })
})
