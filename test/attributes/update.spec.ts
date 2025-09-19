import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw
describe("update", () => {
  describe("функция обновления контекста в функции рендера", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      name: t.string(),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("button"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, update }) => html` <button onclick=${() => update({ name: "Jane Doe" })}>OK</button> `,
      })
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
      element = render({
        el: document.createElement("button"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, update }) => html`
          <button onclick=${() => update({ name: "John", age: 25, active: true })}>Update</button>
        `,
      })
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
      element = render({
        el: document.createElement("button"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, update, context }) => html`
          <button onclick=${() => update({ count: context.count + 1 })}>OK</button>
        `,
      })
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
      element = render({
        el: document.createElement("button"),
        ctx,
        st: { state: "state", states: [] },
        core: { count: 1 },
        tpl: ({ html, update, core, context }) => html`
          <button onclick=${() => update({ count: core.count + context.count, iteration: context.iteration + 1 })}>
            OK
          </button>
        `,
      })
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
    beforeAll(() => {
      element = render({
        el: document.createElement("button"),
        ctx,
        st: { state: "state", states: [] },
        core: {
          items: [{ count: 1, iteration: 1 }],
          count: 3,
        },
        tpl: ({ html, update, core }) => html`
          ${core.items.map(
            (item) => html`
              <button onclick=${() => update({ count: core.count + item.count, iteration: item.iteration + 1 })}>
                OK
              </button>
            `
          )}
        `,
      })
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
