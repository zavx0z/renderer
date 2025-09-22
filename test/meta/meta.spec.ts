import { describe, expect, it, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"

const html = String.raw
class MetaHash extends HTMLElement {}
customElements.define("meta-hash", MetaHash)

describe.skip("meta", () => {
  describe("теги", () => {
    describe("актор web-component", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(({ html }) => html`<meta-hash></meta-hash>`)
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: {},
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toBe("<meta-hash></meta-hash>")
      })
    })

    describe("актор web-component с самозакрывающимся тегом", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(({ html }) => html`<meta-hash />`)
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: {},
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toBe("<meta-hash></meta-hash>")
      })
    })

    describe("хеш-тег из core в самозакрывающемся теге", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(({ html }) => html`<meta-child />`)
        customElements.define("meta-child", class extends HTMLElement {})
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { actors: { child: "child" } },
          nodes,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toBe("<meta-child></meta-child>")
      })
    })

    describe("хеш-тег из core", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<meta-${core.actors.child}></meta-${core.actors.child}>`)
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { actors: { child: "child" } },
          nodes,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toBe("<meta-child></meta-child>")
      })
    })

    describe("meta-тег в простом элементе", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div><meta-${core.tag} /></div>`)
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child" },
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toBe("<div><meta-child></meta-child></div>")
      })
    })

    describe("meta-тег в meta-теге", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<meta-hash><meta-${core.tag} /></meta-hash>`)
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child" },
          nodes,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toBe("<meta-hash><meta-child></meta-child></meta-hash>")
      })
    })

    describe("meta-тег в map", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      const core = { items: [{ tag: "child" }] }
      beforeAll(() => {
        const nodes = parse<typeof ctx.context, typeof core>(
          ({ html, core }) => html`${core.items.map((item) => html`<meta-${item.tag} />`)}`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core,
          nodes,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toBe("<meta-child></meta-child>")
      })
    })

    describe("meta-тег в тренарном операторе", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`${core.items.length > 0 ? html`<meta-${core.tag} />` : html`<meta-${core.tag} />`}`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", items: [{ tag: "child" }] },
          nodes,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toBe("<meta-child></meta-child>")
      })
    })
  })

  describe("атрибуты", () => {
    describe("статические атрибуты", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(({ html }) => html`<meta-hash data-type="component" class="meta-element" />`)
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: {},
          nodes,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toBe('<meta-hash data-type="component" class="meta-element"></meta-hash>')
      })
    })

    describe("динамические атрибуты", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<meta-${core.tag} data-id="${core.id}" class="meta-${core.type}" />`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", id: "1", type: "component" },
          nodes,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toBe('<meta-child data-id="1" class="meta-component"></meta-child>')
      })
    })

    describe("условные атрибуты", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) =>
            html`<meta-${core.tag} ${core.active && "data-active"} class="${core.active ? "active" : "inactive"}" />`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", active: true },
          nodes,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toBe('<meta-child data-active class="active"></meta-child>')
      })
    })

    describe("события", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({
        value: t.string(""),
        selected: t.string(""),
      }))
      beforeAll(() => {
        const nodes = parse(
          ({ html, core, update }) => html`
            <meta-${core.tag}
              onclick=${() => update({ selected: core.id })}
              onchange=${(e: Event) => update({ value: (e.target as HTMLInputElement).value })} />
          `
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", id: "1" },
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toBe("<meta-child></meta-child>")
      })
    })

    describe("функция update", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({ selected: t.string("") }))
      beforeAll(() => {
        const nodes = parse(
          ({ html, core, update }) => html`<meta-${core.tag} onclick=${() => update({ selected: core.id })} />`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", id: "1" },
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toBe("<meta-child></meta-child>")
      })
    })

    describe("смешанные атрибуты", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      const core = { items: [{ tag: "child", id: "1", active: true, handleClick: () => {} }] }
      beforeAll(() => {
        const nodes = parse<typeof ctx.context, typeof core>(
          ({ html, core, update }) => html`
            ${core.items.map(
              (item) => html`
                <meta-${item.tag}
                  data-id="${item.id}"
                  ${item.active && "data-active"}
                  class="meta-${item.active ? "active" : "inactive"}"
                  onclick=${() => update({ selected: item.id })} />
              `
            )}
          `
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core,
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toBe('<meta-child data-id="1" class="meta-active"></meta-child>')
      })
    })
  })
})
