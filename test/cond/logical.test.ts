import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "../../index"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw
describe("логические операторы в условиях", () => {
  describe("логический оператор с вложенными элементами в условии", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      showDetails: t.boolean.required(true),
    }))
    beforeAll(() => {
      const nodes = parse(
        ({ html, context, core }) => html`
          <div>
            ${core.user && context.showDetails
              ? html`
                  <div class="user-profile">
                    <h2>${core.user.name}</h2>
                    ${core.user.isVerified && html` <span class="verified-badge">VERIFIED</span> `}
                    <p>User details</p>
                  </div>
                `
              : html`
                  <div class="no-profile">
                    <p>No profile available</p>
                  </div>
                `}
          </div>
        `
      )
      element = render({
        el: document.createElement("div"),
        ctx,
        st,
        core: { user: { name: "John Doe", isVerified: true } },
        nodes,
      })
    })

    it("render - showDetails=true", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="user-profile">
            <h2>John Doe</h2>
            <span class="verified-badge">VERIFIED</span>
            <p>User details</p>
          </div>
        </div>
      `)
    })
    it("update - showDetails=false", () => {
      ctx.update({ showDetails: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="no-profile">
            <p>No profile available</p>
          </div>
        </div>
      `)
    })
  })

  describe("сложный логический оператор в условии", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      isAdmin: t.boolean.required(true),
    }))
    beforeAll(() => {
      const nodes = parse(
        ({ html, context, core }) => html`
          <div>
            ${core.user && core.user.role === "admin" && context.isAdmin
              ? html`
                  <div class="admin-dashboard">
                    <h1>Admin Dashboard</h1>
                    ${core.user.isActive &&
                    html`
                      <div class="active-admin">
                        <span class="status">Active</span>
                        <button>Manage Users</button>
                      </div>
                    `}
                  </div>
                `
              : html`
                  <div class="user-dashboard">
                    <h1>User Dashboard</h1>
                    <p>Welcome, user!</p>
                  </div>
                `}
          </div>
        `
      )
      element = render({
        el: document.createElement("div"),
        ctx,
        st,
        core: { user: { role: "admin", isActive: true } },
        nodes,
      })
    })

    it("render - isAdmin=true", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="admin-dashboard">
            <h1>Admin Dashboard</h1>
            <div class="active-admin">
              <span class="status">Active</span>
              <button>Manage Users</button>
            </div>
          </div>
        </div>
      `)
    })
    it("update - isAdmin=false", () => {
      ctx.update({ isAdmin: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="user-dashboard">
            <h1>User Dashboard</h1>
            <p>Welcome, user!</p>
          </div>
        </div>
      `)
    })
  })
})
