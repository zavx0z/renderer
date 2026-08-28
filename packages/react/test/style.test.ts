import {describe, expect, test} from "bun:test"
import {defineStyles, isStyleToken, resolveStyleValue} from "../src/style.ts"

describe("class-free compiled component styles", () => {
  test("emits stable attribute-scoped rules without author classes", () => {
    const first = defineStyles("@ui/button", {
      root: {
        display: "flex",
        gap: 4,
        opacity: 0.75,
        ":hover": {background: "rgb(101 101 101)"},
        ":active": {background: "rgb(71 114 179)"}
      },
      label: {color: "rgb(230 230 230)"}
    })
    const second = defineStyles("@ui/button", {
      root: {
        display: "flex",
        gap: 4,
        opacity: 0.75,
        ":hover": {background: "rgb(101 101 101)"},
        ":active": {background: "rgb(71 114 179)"}
      },
      label: {color: "rgb(230 230 230)"}
    })

    expect(first.root.attributeName).toBe(second.root.attributeName)
    expect(first.root.cssText).toContain(`[${first.root.attributeName}]{display:flex;gap:4px;opacity:0.75}`)
    expect(first.root.cssText).toContain(`[${first.root.attributeName}]:hover{background:rgb(101 101 101)}`)
    expect(first.cssText).not.toContain("class")
    expect(first.tokens).toEqual([first.root, first.label])
    expect(isStyleToken(first.root)).toBe(true)
  })

  test("fails closed for unsupported pseudos and nested declarations", () => {
    expect(() => defineStyles("bad", {
      root: {":visited": {color: "red"}}
    } as never)).toThrow("unsupported pseudo")
    expect(() => defineStyles("bad", {
      root: {":hover": {":active": {color: "red"}}}
    } as never)).toThrow("cannot nest")
  })

  test("changes the marker when an owner rule changes", () => {
    const first = defineStyles("@ui/button", {root: {height: 20}})
    const second = defineStyles("@ui/button", {root: {height: 21}})
    expect(first.root.attributeName).not.toBe(second.root.attributeName)
  })

  test("flattens tokens and caller declarations in explicit precedence order", () => {
    const styles = defineStyles("@ui/button", {root: {height: 20}})
    const resolved = resolveStyleValue([
      styles.root,
      false,
      styles.root,
      {height: 24, opacity: 0.5},
      "color: white;"
    ])
    expect(resolved.attributes).toEqual([styles.root.attributeName])
    expect(resolved.cssText).toBe("height: 24px; opacity: 0.5; color: white")
    expect(() => resolveStyleValue({":hover": {color: "red"}} as never)).toThrow(
      "defineStyles token"
    )
  })

  test("keeps supported unitless numbers and custom-property tokens unitless", () => {
    expect(resolveStyleValue({
      flex: 1,
      flexGrow: 2,
      lineHeight: 1.2,
      "--density": 3,
      gap: 4
    }).cssText).toBe(
      "flex: 1; flex-grow: 2; line-height: 1.2; --density: 3; gap: 4px",
    )
  })
})
