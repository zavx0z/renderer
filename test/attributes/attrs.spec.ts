import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw
describe("атрибуты", () => {
  describe("namespace", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html }) => html`<svg:use xlink:href="#id"></svg:use>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<svg:use xlink:href="#id"></svg:use>`)
    })
  })
  describe("пустые значения", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html }) => html`<div class="" id="">Content</div>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div>Content</div>`)
    })
  })
  describe("двойные/одинарные кавычки", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html }) => html`<a href="https://e.co" target="_blank">x</a>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<a href="https://e.co" target="_blank">x</a>`)
    })
  })

  describe("угловые скобки внутри значения", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html }) => html`<div title="a > b, c < d"></div>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div title="a > b, c < d"></div>`)
    })
  })

  describe("условие в атрибуте", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      flag: t.boolean(true),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`<div title="${context.flag ? "a > b" : "c < d"}"></div>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div title="a > b"></div>`)
    })
  })

  describe("условие в аттрибуте без кавычек", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      flag: t.boolean(true),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`<div title=${context.flag ? "a > b" : "c < d"}></div>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div title="a > b"></div>`)
    })
  })

  describe("условие в аттрибуте с одинарными кавычками", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      flag: t.boolean(true),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`<div title="${context.flag ? "a > b" : "c < d"}"></div>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div title="a > b"></div>`)
    })
  })
  describe("булевы атрибуты", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      flag: t.boolean(true),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("button"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`<button ${context.flag && "disabled"}></button>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<button disabled></button>`)
    })
  })
  describe("класс в map", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("ul"),
        ctx,
        st: { state: "state", states: [] },
        core: {
          items: [
            { type: "1", name: "item 1" },
            { type: "2", name: "item 2" },
          ],
        },
        tpl: ({ html, core }) => html`
          <ul>
            ${core.items.map((item) => html`<li class="item-${item.type}" title="${item.name}">${item.name}</li>`)}
          </ul>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li class="item-1" title="item 1">item 1</li>
          <li class="item-2" title="item 2">item 2</li>
        </ul>
      `)
    })
  })

  describe("сложные условные атрибуты class", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { active: true },
        tpl: ({ html, core }) => html`<div class="div-${core.active ? "active" : "inactive"}">Content</div>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active">Content</div>`)
    })
  })
})
