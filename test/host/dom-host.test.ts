import { describe, expect, it } from "bun:test"
import { contextFromSchema, contextSchema } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { render } from "../../dom"
import { st } from "../../fixture/params"

describe("DOM host", () => {
  it("preserves the exact ShadowRoot passed to render", () => {
    const ctx = contextFromSchema(contextSchema((t) => ({})))
    const root = document.createElement("div").attachShadow({ mode: "open" })
    const nodes = parse(({ html }) => html`<span>ready</span>`)

    const rendered: ShadowRoot = render({ el: root, ctx, st, core: {}, nodes })

    expect(rendered).toBe(root)
    expect(root.innerHTML).toBe("<span>ready</span>")
  })
})
