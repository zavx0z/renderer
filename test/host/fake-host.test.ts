import { describe, expect, it } from "bun:test"
import type { Node as TemplateNode } from "@zavx0z/template"
import {
  commit,
  compile,
  type RenderHost,
  type ResolvedElement,
} from "../../program"

type FakeNode = {
  readonly kind: "text" | "element"
  readonly value?: string
  readonly source?: ResolvedElement
  children: FakeNode[]
}

describe("target-neutral render program", () => {
  it("evaluates and commits without a DOM host", () => {
    const updates: unknown[] = []
    const eventData = ["[item]/id"]
    const syntax = [
      {
        type: "map",
        data: "/mass/items",
        child: [
          {
            type: "el",
            tag: "button",
            string: {
              "data-count": { data: "/fields/count" },
              "data-visible": { data: "/fields/visible" },
            },
            style: {
              display: "flex",
              width: { data: "[item]/width" },
              "&:hover": {
                color: { data: "/fields/hoverColor" },
                "& .icon": {
                  opacity: {
                    data: "/fields/enabled",
                    expr: "${_[0] ? 1 : 0.5}",
                  },
                  transform: {
                    data: "/fields/offset",
                    expr: "`translateX(${_[0]}px)`",
                  },
                },
              },
              "@media (min-width: 800px)": { flexDirection: "row" },
            },
            event: {
              onclick: {
                data: eventData,
                expr: "() => update({ selected: _[0] })",
              },
            },
            child: [{ type: "text", data: "[item]/label" }],
          },
        ],
      },
    ] as any[]

    const program = compile(syntax as TemplateNode[])
    eventData[0] = "/fields/hoverColor"
    syntax[0].child[0].style["&:hover"].color.data = "/fields/missing"
    syntax[0].child[0].child[0].data = "/fields/missing"
    const tree = program.evaluate({
      bindings: {
        fields: {
          hoverColor: "orange",
          enabled: true,
          offset: 12,
          count: 0,
          visible: false,
        },
        mass: { items: [{ id: "save", label: "Save", width: "8rem" }] },
      },
      update: (value) => updates.push(value),
    })

    const created: ResolvedElement[] = []
    const root = { children: [] as FakeNode[] }
    const host: RenderHost<FakeNode, typeof root> = {
      createText: (node) => ({ kind: "text", value: node.value, children: [] }),
      createElement: (node) => {
        created.push(node)
        return { kind: "element", source: node, children: [] }
      },
      appendChild: (parent, child) => parent.children.push(child),
      replaceChildren: (target, children) => {
        target.children = [...children]
      },
    }

    commit(host, root, tree)

    expect(root.children[0]?.children[0]?.value).toBe("Save")
    expect(created[0]?.attributes.string).toEqual({
      "data-count": "0",
      "data-visible": "false",
    })
    expect(created[0]?.attributes.style).toEqual({
      display: "flex",
      width: "8rem",
      "&:hover": {
        color: "orange",
        "& .icon": { opacity: "1", transform: "translateX(12px)" },
      },
      "@media (min-width: 800px)": { flexDirection: "row" },
    })
    expect(Object.isFrozen(tree)).toBe(true)
    expect(Object.isFrozen(created[0])).toBe(true)
    expect(Object.isFrozen(created[0]?.attributes.style?.["&:hover"])).toBe(
      true,
    )

    created[0]?.attributes.event.click?.()
    expect(updates).toEqual([{ selected: "save" }])
  })
})
