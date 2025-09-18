import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw
describe("class атрибуты в data.ts", () => {
  describe("простые случаи", () => {
    describe("class в элементе с одним статическим значением", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html }) => html`<div class="div-active"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active"></div>`)
      })
    })

    describe("class в элементе с одним статическим значением без кавычек", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html }) => html`<div class="div-active"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active"></div>`)
      })
    })

    describe("class в элементе с несколькими статическими значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="div-active div-inactive"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-inactive"></div>`)
      })
    })
  })

  describe("динамические значения", () => {
    describe("class в элементе с одним динамическим значением", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="${core.active ? "active" : "inactive"}"></div>`,
        })
      })

      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active"></div>`)
      })
    })

    describe("class в элементе с несколькими статическими значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="div-active div-inactive"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-inactive"></div>`)
      })
    })
    describe("class в элементе с несколькими статическими значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="div-active div-inactive"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-inactive"></div>`)
      })
    })
  })

  describe("динамические значения", () => {
    describe("class в элементе с одним динамическим значением", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="${core.active ? "active" : "inactive"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active"></div>`)
      })
    })

    describe("class в элементе с одним динамическим значением без кавычек", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class=${core.active ? "active" : "inactive"}></div>`,
        })
      })
      it("ren der", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active"></div>`)
      })
    })

    describe("class в элементе с несколькими динамическими значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html }) => html`<div class="div-active div-inactive"></div> `,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-inactive"></div>`)
      })
    })

    describe("class в элементе с несколькими динамическими значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`
            <div class="${core.active ? "active" : "inactive"} ${core.active ? "active" : "inactive"}"></div>
          `,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active active"></div>`)
      })
    })

    describe("class в элементе с операторами сравнения", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { count: 6 },
          tpl: ({ html, core }) => html`<div class="${core.count > 5 ? "large" : "small"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="large"></div>`)
      })
    })

    describe("class в элементе с операторами равенства", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { status: "loading" },
          tpl: ({ html, core }) => html`<div class="${core.status === "loading" ? "loading" : "ready"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="loading"></div>`)
      })
    })

    describe("class в элементе с логическими операторами", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true, visible: true },
          tpl: ({ html, core }) => html`<div class="${core.active && core.visible ? "show" : "hide"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="show"></div>`)
      })
    })

    describe("class в элементе с оператором ИЛИ", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { error: true, warning: false },
          tpl: ({ html, core }) => html`<div class="${core.error || core.warning ? "alert" : "normal"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="alert"></div>`)
      })
    })

    describe("class в элементе с оператором НЕ", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { disabled: true },
          tpl: ({ html, core }) => html`<div class="${!core.disabled ? "enabled" : "disabled"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="disabled"></div>`)
      })
    })

    describe("class в элементе с оператором НЕ", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { disabled: true },
          tpl: ({ html, core }) => html`<div class="${!core.disabled ? "enabled" : "disabled"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="disabled"></div>`)
      })
    })
    describe("class в элементе с оператором И &&", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="${core.active && "active"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active"></div>`)
      })
    })
  })

  describe("смешанные значения", () => {
    describe("class в элементе с одним смешанным значением", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="div-${core.active ? "active" : "inactive"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active"></div>`)
      })
    })

    describe("class в элементе с одним смешанным значением без кавычек", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="div-${core.active ? "active" : "inactive"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active"></div>`)
      })
    })

    describe("class в элементе с несколькими смешанными значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) =>
            html`<div
              class="div-${core.active ? "active" : "inactive"} div-${core.active ? "active" : "inactive"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-active"></div>`)
      })
    })
  })

  describe("различные варианты", () => {
    describe("class в элементе с смешанным и статическим значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="div-${core.active ? "active" : "inactive"} visible"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active visible"></div>`)
      })
    })

    describe("class в элементе с динамическим и статическим значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="${core.active ? "active" : "inactive"} visible"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active visible"></div>`)
      })
    })

    describe("class в элементе с тремя различными типами значений", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true, type: "type" },
          tpl: ({ html, core }) =>
            html`<div class="static-value ${core.active ? "active" : "inactive"} mixed-${core.type}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="static-value active mixed-type"></div>`)
      })
    })

    describe("class в элементе с несколькими смешанными значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { variant: "variant", size: "size", theme: "theme" },
          tpl: ({ html, core }) => html`<div class="btn-${core.variant} text-${core.size} bg-${core.theme}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="btn-variant text-size bg-theme"></div>`)
      })
    })

    describe("class в элементе с условными классами", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true, disabled: false },
          tpl: ({ html, core }) =>
            html`<div
              class="base-class ${core.active ? "active" : "inactive"} ${core.disabled ? "disabled" : ""}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="base-class active"></div>`)
      })
    })

    describe("class в элементе с вложенными выражениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { nested: true },
          tpl: ({ html, core }) => html`<div class="container ${core.nested ? "nested" : "default"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="container nested"></div>`)
      })
    })

    describe("class в элементе с пустыми значениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { hidden: true, active: true },
          tpl: ({ html, core }) =>
            html`<div class="visible ${core.hidden ? "" : "show"} ${core.active ? "active" : ""}"></div>`,
        })
      })
      it("render", () => {
        console.log(element.innerHTML)
        expect(element.innerHTML).toMatchStringHTML(html`<div class="visible active"></div>`)
      })
    })

    describe("class в элементе с атрибутом без кавычек", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { active: true },
          tpl: ({ html, core }) => html`<div class="static-value-${core.active ? "active" : "inactive"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="static-value-active"></div>`)
      })
    })

    describe("class в элементе со сложной строкой с несколькими переменными", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { user: { id: "id", role: "role" }, theme: "theme" },
          tpl: ({ html, core }) => html`<div class="user-${core.user.id}-${core.user.role}-${core.theme}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="user-id-role-theme"></div>`)
      })
    })

    describe("class в элементе со сложной строкой с условными выражениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { user: { id: "id", role: "role" }, theme: "theme", isActive: true },
          tpl: ({ html, core }) =>
            html`<div
              class="user-${core.user.id}-${core.user.role}-${core.theme}-${core.isActive
                ? "active"
                : "inactive"}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="user-id-role-theme-active"></div>`)
      })
    })

    describe("class в элементе с массивом классов со сложной строкой", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { user: { id: "id", role: "role" }, theme: "theme" },
          tpl: ({ html, core }) =>
            html`<div class="base user-${core.user.id}-${core.user.role} theme-${core.theme}"></div>`,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="base user-id-role theme-theme"></div>`)
      })
    })

    describe("class в элементе с массивом классов и сложными условными выражениями", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))

      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { user: { id: "id", role: "role" }, theme: "theme", isActive: true, isAdmin: true },
          tpl: ({ html, core }) => html`
            <div
              class="
              base 
              user-${core.user.id} 
              ${core.isActive ? "active" : "inactive"} 
              ${core.isAdmin ? "admin" : "user"} 
              theme-${core.theme}
              "></div>
          `,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="base user-id active admin theme-theme"></div>`)
      })
    })
  })
  describe("постфикс с условием и статическими значениями", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))

    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { status: true },
        tpl: ({ html, core }) => html`<div class="${core.status ? "active" : "inactive"}-status">Status</div>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div class="active-status">Status</div>`)
    })
  })
})
