import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "../../index"
import { Context } from "@zavx0z/context"

const html = String.raw

describe("вложенные условия", () => {
  describe("if else if", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({ flag1: t.boolean.required(true), flag2: t.boolean.required(false) }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`
          ${context.flag1
            ? html`<div class="flag1"></div>`
            : context.flag2
              ? html`<div class="flag2"></div>`
              : html`<div class="flag3"></div>`}
        `,
      })
    })
    it("render - flag1=true flag2=false", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div class="flag1"></div>`)
    })
    it("update - flag1=false flag2=true", () => {
      ctx.update({ flag1: false, flag2: true })
      expect(element.innerHTML).toMatchStringHTML(html`<div class="flag2"></div>`)
    })
    it("update - flag1=false flag2=false", () => {
      ctx.update({ flag1: false, flag2: false })
      expect(element.innerHTML).toMatchStringHTML(html`<div class="flag3"></div>`)
    })
    it("update - flag1=true flag2=true", () => {
      ctx.update({ flag1: true, flag2: true })
      expect(element.innerHTML).toMatchStringHTML(html`<div class="flag1"></div>`)
    })
  })
  describe("if if", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      hasPermission: t.boolean.required(true),
      isAdmin: t.boolean.required(false),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`
          <div>
            ${context.hasPermission
              ? context.isAdmin
                ? html`
                    <div>
                      <button class="admin">Admin Action</button>
                    </div>
                  `
                : html`
                    <div>
                      <button class="user">User Action</button>
                    </div>
                  `
              : html`<div class="no-access">Access Denied</div>`}
          </div>
        `,
      })
    })
    it("render - hasPermission=true isAdmin=false", () =>
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div>
            <button class="user">User Action</button>
          </div>
        </div>
      `))
    it("update - hasPermission=false isAdmin=false", () => {
      ctx.update({ hasPermission: false, isAdmin: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="no-access">Access Denied</div>
        </div>
      `)
    })
    it("update - hasPermission=false isAdmin=true", () => {
      ctx.update({ hasPermission: false, isAdmin: true })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="no-access">Access Denied</div>
        </div>
      `)
    })
    it("update - hasPermission=true isAdmin=true", () => {
      ctx.update({ hasPermission: true, isAdmin: true })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div>
            <button class="admin">Admin Action</button>
          </div>
        </div>
      `)
    })
  })

  describe("if if if", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      hasPermission: t.boolean.required(true),
      isAdmin: t.boolean.required(false),
      isSuperAdmin: t.boolean.required(false),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`
          <div>
            ${context.hasPermission
              ? context.isAdmin
                ? context.isSuperAdmin
                  ? html`<div class="super-admin">Super Admin Panel</div>`
                  : html`<div class="admin">Admin Panel</div>`
                : html`<div class="user">User Panel</div>`
              : html`<div class="no-access">Access Denied</div>`}
          </div>
        `,
      })
    })
    it("render - hasPermission=true isAdmin=false isSuperAdmin=false", () =>
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="user">User Panel</div>
        </div>
      `))
    it("update - hasPermission=false isAdmin=false isSuperAdmin=false", () => {
      ctx.update({ hasPermission: false, isAdmin: false, isSuperAdmin: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="no-access">Access Denied</div>
        </div>
      `)
    })
    it("update - hasPermission=true isAdmin=false isSuperAdmin=true", () => {
      ctx.update({ hasPermission: true, isAdmin: false, isSuperAdmin: true })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="user">User Panel</div>
        </div>
      `)
    })
    it("update - hasPermission=true isAdmin=true isSuperAdmin=false", () => {
      ctx.update({ hasPermission: true, isAdmin: true, isSuperAdmin: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="admin">Admin Panel</div>
        </div>
      `)
    })
    it("update - hasPermission=true isAdmin=true isSuperAdmin=true", () => {
      ctx.update({ hasPermission: true, isAdmin: true, isSuperAdmin: true })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="super-admin">Super Admin Panel</div>
        </div>
      `)
    })
  })
})
