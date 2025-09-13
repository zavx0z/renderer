import { describe, it, expect } from "bun:test"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { Renderer } from "../index"

const html = String.raw

describe("простой HTML элемент", () => {
  const { context, update, onUpdate } = new Context((t) => ({
    cups: t.number.required(0)({ title: "orders" }),
    last: t.string.optional()({ title: "last ordered drink" }),
  }))

  const core = {
    menu: [
      { label: "Espresso", size: "30ml" },
      { label: "Cappuccino", size: "200ml" },
      { label: "Latte", size: "250ml" },
    ],
  }

  let state = "open"

  const nodes = parse<typeof context, typeof core, "open" | "closed">(
    ({ html, context, update, core, state }) => html`
      <h1>Quick Coffee Order</h1>

      <p>
        Status: ${state === "open" ? "Open" : "Closed"} Orders:
        ${context.cups}${context.last && ` last: ${context.last}`}
      </p>

      ${state === "open" &&
      html`
        <ul>
          ${core.menu.map(
            (product) =>
              html`<li>
                ${product.label} (${product.size})
                <button onclick=${() => update({ cups: context.cups + 1, last: product.label })}>Add</button>
              </li>`
          )}
        </ul>
      `}
      ${state === "closed" && html`<p>Come back later — we’ll brew something tasty</p>`}
    `
  )

  let prevState = state
  it("парсинг", () => {
    expect(nodes).toEqual([
      {
        tag: "h1",
        type: "el",
        child: [
          {
            type: "text",
            value: "Quick Coffee Order",
          },
        ],
      },
      {
        tag: "p",
        type: "el",
        child: [
          {
            type: "text",
            data: ["/context/cups", "/context/last", "/state"],
            expr: 'Status: ${_[2] === "open" ? "Open" : "Closed"} Orders: ${_[0]}${_[1] && ` last: ${_[1]}`}',
          },
        ],
      },
      {
        type: "log",
        data: "/state",
        expr: '_[0] === "open"',
        child: [
          {
            tag: "ul",
            type: "el",
            child: [
              {
                type: "map",
                data: "/core/menu",
                child: [
                  {
                    tag: "li",
                    type: "el",
                    child: [
                      {
                        type: "text",
                        data: ["[item]/label", "[item]/size"],
                        expr: "${_[0]} (${_[1]})",
                      },
                      {
                        tag: "button",
                        type: "el",
                        child: [
                          {
                            type: "text",
                            value: "Add",
                          },
                        ],
                        event: {
                          onclick: {
                            expr: "() => update({ cups: _[0] + 1, last: _[1] })",
                            upd: ["cups", "last"],
                            data: ["[item]/context/cups", "[item]/label"],
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "log",
        data: "/state",
        expr: '_[0] === "closed"',
        child: [
          {
            tag: "p",
            type: "el",
            child: [
              {
                type: "text",
                value: "Come back later \\u2014 we\\u2019ll brew something tasty",
              },
            ],
          },
        ],
      },
    ])
  })

  it("рендер", () => {
    const element = document.createElement("div")

    const renderer = new Renderer(element, nodes, context, update, state, core)
    onUpdate((updated) => {
      renderer.update({ context: updated, ...(state !== prevState && { state }) })
      prevState = state
    })
    expect(element.innerHTML).toMatchStringHTML(html`
      <h1>Quick Coffee Order</h1>
      <p>Status: Open Orders: 0</p>
      <ul>
        <li>
          Espresso (30ml)
          <button>Add</button>
        </li>
        <li>
          Cappuccino (200ml)
          <button>Add</button>
        </li>
        <li>
          Latte (250ml)
          <button>Add</button>
        </li>
      </ul>
    `)
  })
})
