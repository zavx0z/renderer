import { describe, expect, it, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw
class MetaHash extends HTMLElement {}
customElements.define("meta-hash", MetaHash)

describe("meta", () => {
  describe("теги", () => {
    describe("актор web-component", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: {},
          tpl: ({ html }) => html`<meta-hash></meta-hash>`,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: {},
          tpl: ({ html }) => html`<meta-hash />`,
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
        customElements.define("meta-child", class extends HTMLElement {})
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { actors: { child: "child" } },
          tpl: ({ html, core }) => html`<meta-${core.actors.child} />`,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { actors: { child: "child" } },
          tpl: ({ html, core }) => html`<meta-${core.actors.child}></meta-${core.actors.child}>`,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child" },
          tpl: ({ html, core }) => html`<div><meta-${core.tag} /></div>`,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child" },
          tpl: ({ html, core }) => html`<meta-hash><meta-${core.tag} /></meta-hash>`,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toBe("<meta-hash><meta-child></meta-child></meta-hash>")
      })
    })

    describe("meta-тег в map", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { items: [{ tag: "child" }] },
          tpl: ({ html, core }) => html`${core.items.map((item) => html`<meta-${item.tag} />`)}`,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", items: [{ tag: "child" }] },
          tpl: ({ html, core }) =>
            html`${core.items.length > 0 ? html`<meta-${core.tag} />` : html`<meta-${core.tag} />`}`,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: {},
          tpl: ({ html }) => html`<meta-hash data-type="component" class="meta-element" />`,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", id: "1", type: "component" },
          tpl: ({ html, core }) => html`<meta-${core.tag} data-id="${core.id}" class="meta-${core.type}" />`,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", active: true },
          tpl: ({ html, core }) =>
            html`<meta-${core.tag} ${core.active && "data-active"} class="${core.active ? "active" : "inactive"}" />`,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", id: "1" },
          tpl: ({ html, core, update }) => html`
            <meta-${core.tag}
              onclick=${() => update({ selected: core.id })}
              onchange=${(e: Event) => update({ value: (e.target as HTMLInputElement).value })} />
          `,
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
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { tag: "child", id: "1" },
          tpl: ({ html, core, update }) => html`<meta-${core.tag} onclick=${() => update({ selected: core.id })} />`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toBe("<meta-child></meta-child>")
      })
    })

    describe("смешанные атрибуты", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "", states: [] },
          core: { items: [{ tag: "child", id: "1", active: true, handleClick: () => {} }] },
          tpl: ({ html, core, update }) => html`
            ${core.items.map(
              (item) => html`
                <meta-${item.tag}
                  data-id="${item.id}"
                  ${item.active && "data-active"}
                  class="meta-${item.active ? "active" : "inactive"}"
                  onclick=${() => update({ selected: item.id })} />
              `
            )}
          `,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toBe('<meta-child data-id="1" class="meta-active"></meta-child>')
      })
    })
  })
})
