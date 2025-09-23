import { describe, expect, it, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw
class MetaHash extends HTMLElement {}
customElements.define("meta-hash", MetaHash)

if (!customElements.get("meta-for"))
  customElements.define(
    "meta-for",
    class extends HTMLElement {
      __core = {}
      constructor() {
        super()
      }
      connectedCallback() {
        console.log("connected")
      }
    }
  )

describe("meta", () => {
  describe("актор web-component", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      const nodes = parse(({ html }) => html`<meta-hash></meta-hash>`)
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })
    it("render", () => {
      expect(element.innerHTML).toBe(html`<meta-hash></meta-hash>`)
    })
  })

  describe("актор web-component с самозакрывающимся тегом", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      const nodes = parse(({ html }) => html`<meta-hash />`)
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })
    it("render", () => {
      expect(element.innerHTML).toBe(html`<meta-hash></meta-hash>`)
    })
  })

  describe("статические атрибуты", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      const nodes = parse(({ html }) => html`<meta-hash data-type="component" class="meta-element" />`)
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })

    it("render", () => {
      expect(element.innerHTML).toBe(html`<meta-hash data-type="component" class="meta-element"></meta-hash>`)
    })
  })
  describe("core", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    const core = {
      obj: { data: "any" },
    }
    beforeAll(() => {
      const nodes = parse(({ html, core }) => html`<meta-for core=${{ obj: core.obj }} />`)
      element = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })
    it("render", () => {
      expect(customElements.get("meta-for")).toBeDefined()
      expect(element.innerHTML).toBe(html`<meta-for></meta-for>`)
    })
    it("core", () => {
      const metaElement = element.getElementsByTagName("meta-for")[0] as HTMLElement & { __core: Record<string, any> }
      expect(metaElement.__core).toEqual(core)
    })
    it("update src value", () => {
      const metaElement = element.getElementsByTagName("meta-for")[0] as HTMLElement & { __core: Record<string, any> }
      const newValue = "other"
      core.obj.data = newValue
      expect(metaElement.__core.obj.data).toBe(newValue)
    })
    it("update meta element value", () => {
      const metaElement = element.getElementsByTagName("meta-for")[0] as HTMLElement & { __core: Record<string, any> }
      const newValue = "meta"
      metaElement.__core.obj.data = newValue
      expect(core.obj.data).toBe(newValue)
    })
  })
})
