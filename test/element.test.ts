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
      <h1>☕ Quick Coffee Order</h1>

      <p>
        Status: ${state === "open" ? "🟢 Open" : "🔴 Closed"} · Orders:
        ${context.cups}${context.last && ` · last: ${context.last}`}
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
      ${state === "closed" && html`<p>Come back later — we’ll brew something tasty ☺️</p>`}
    `
  )

  let prevState = state
  console.log(nodes)
  it("парсинг", () => {
    expect(nodes).toEqual([
      {
        tag: "h1",
        type: "el",
        child: [
          {
            type: "text",
            value: "\\u2615 Quick Coffee Order",
          },
        ],
      },
      {
        tag: "p",
        type: "el",
        child: [
          {
            type: "text",
            data: ["/state", "/context/cups", "/context/last", "/xB7", "/last"],
            expr: 'Status: ${[0] === "open" ? "\\uD83D\\uDFE2 Open" : "\\uD83D\\uDD34 Closed"} \\u00B7 Orders: ${[1]}${[2] && ` \\[3] [4]: ${[2]}`}',
          },
        ],
      },
      {
        type: "log",
        data: ["/state", "/open"],
        expr: '${[0]} === "${[1]}"',
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
                        expr: "${[0]} (${[1]})",
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
                            expr: "() => update({ cups: ${[0]} + 1, last: ${[1]} })",
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
        data: ["/state", "/closed"],
        expr: '${[0]} === "${[1]}"',
        child: [
          {
            tag: "p",
            type: "el",
            child: [
              {
                type: "text",
                value: "Come back later \\u2014 we\\u2019ll brew something tasty \\u263A\\uFE0F",
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
    expect(element.innerHTML).toBeDefined()
  })
})
