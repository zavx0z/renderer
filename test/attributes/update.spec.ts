import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw
describe("update", () => {
  describe("функция обновления контекста в функции рендера", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      name: t.string.optional(),
    }))
    beforeAll(() => {
      const nodes = parse(
        ({ html, update }) => html` <button onclick=${() => update({ name: "Jane Doe" })}>OK</button> `
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html` <button>OK</button> `)
    })
    it("event", () => {
      const button = element.getElementsByTagName("button")[0]!
      button.click()
      expect(ctx.context.name).toBe("Jane Doe")
    })
  })

  describe("функция обновления нескольких ключей контекста", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      name: t.string.required(""),
      age: t.number.required(0),
      active: t.boolean.required(false),
    }))
    beforeAll(() => {
      const nodes = parse(
        ({ html, update }) => html`
          <button onclick=${() => update({ name: "John", age: 25, active: true })}>Update</button>
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html` <button>Update</button> `)
    })
    it("event", () => {
      const button = element.getElementsByTagName("button")[0]!
      button.click()
      expect(ctx.context.name).toBe("John")
      expect(ctx.context.age).toBe(25)
      expect(ctx.context.active).toBe(true)
    })
  })

  describe("функция обновления контекста данными из контекста", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      count: t.number.required(4),
    }))
    beforeAll(() => {
      const nodes = parse<typeof ctx.context>(
        ({ html, update, context }) => html` <button onclick=${() => update({ count: context.count + 1 })}>OK</button> `
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html` <button>OK</button> `)
    })
    it("event", () => {
      const button = element.getElementsByTagName("button")[0]!
      button.click()
      expect(ctx.context.count).toBe(5)
    })
  })

  describe("функция обновления контекста данными из core и context", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      count: t.number.required(0),
      iteration: t.number.required(0),
    }))
    beforeAll(() => {
      const nodes = parse<typeof ctx.context>(
        ({ html, update, core, context }) => html`
          <button onclick=${() => update({ count: core.count + context.count, iteration: context.iteration + 1 })}>
            OK
          </button>
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core: { count: 1, iteration: 1 }, nodes })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html` <button>OK</button> `)
    })
    it("event", () => {
      const button = element.getElementsByTagName("button")[0]!
      button.click()
      expect(ctx.context.count).toBe(1)
      expect(ctx.context.iteration).toBe(1)
    })
  })

  describe("функция обновления контекста данными из core и context внутри массива вложенного в массив", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      count: t.number.required(0),
      iteration: t.number.required(0),
    }))
    const core = {
      items: [{ count: 1, iteration: 1 }],
      count: 3,
    }
    beforeAll(() => {
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, update, core }) => html`
          ${core.items.map(
            (item) => html`
              <button onclick=${() => update({ count: core.count + item.count, iteration: item.iteration + 1 })}>
                OK
              </button>
            `
          )}
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html` <button>OK</button> `)
    })
    it("event", () => {
      const button = element.getElementsByTagName("button")[0]!
      button.click()
      expect(ctx.context.count).toBe(4)
      expect(ctx.context.iteration).toBe(2)
    })
  })
})
