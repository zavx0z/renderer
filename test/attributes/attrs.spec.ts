import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"

const html = String.raw
describe("атрибуты", () => {
  describe("namespace", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      const nodes = parse(({ html }) => html`<svg:use xlink:href="#id"></svg:use>`)
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        nodes,
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
      const nodes = parse(({ html }) => html`<div class="" id="">Content</div>`)
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        nodes,
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
      const nodes = parse(({ html }) => html`<a href="https://e.co" target="_blank">x</a>`)
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        nodes,
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
      const nodes = parse(({ html }) => html`<div title="a > b, c < d"></div>`)
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        nodes,
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
      const nodes = parse(({ html, context }) => html`<div title="${context.flag ? "a > b" : "c < d"}"></div>`)
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        nodes,
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
      const nodes = parse(({ html, context }) => html`<div title=${context.flag ? "a > b" : "c < d"}></div>`)
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        nodes,
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
      const nodes = parse(({ html, context }) => html`<div title="${context.flag ? "a > b" : "c < d"}"></div>`)
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        nodes,
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
      const nodes = parse(({ html, context }) => html`<button ${context.flag && "disabled"}></button>`)
      element = render({
        el: document.createElement("button"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        nodes,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<button disabled></button>`)
    })
  })
  describe("класс в map", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    const core = {
      items: [
        { type: "1", name: "item 1" },
        { type: "2", name: "item 2" },
      ],
    }
    beforeAll(() => {
      const nodes = parse<any, typeof core>(
        ({ html, core }) =>
          html`<ul>
            ${core.items.map((item) => html`<li class="item-${item.type}" title="${item.name}">${item.name}</li>`)}
          </ul>`
      )
      element = render({
        el: document.createElement("ul"),
        ctx,
        st: { state: "state", states: [] },
        core,
        nodes,
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
      const nodes = parse(
        ({ html, core }) => html`<div class="div-${core.active ? "active" : "inactive"}">Content</div>`
      )
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { active: true },
        nodes,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active">Content</div>`)
    })
  })
})
