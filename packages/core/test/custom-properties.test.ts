import {describe, expect, test} from "bun:test"
import {
  acquireDocumentCompiledStyleSheets,
  createDocument,
  readDocumentCompiledStyleSheets
} from "@zavx0z/dom"
import {
  createDocumentInteractionState,
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame,
  type TextDisplayItem
} from "../src/index.ts"
import {computeStyle, parseStyleSheets} from "../src/css.ts"
import {documentStyleRuleCacheStats} from "../src/stylesheet-cache.ts"

describe("bounded CSS custom properties and var()", () => {
  test("shares one pseudo sheet across instances and updates an inline variable while hovered", () => {
    const document = createDocument()
    const root = document.createElement("main")
    const first = dynamicButton(document, "#112233")
    const second = dynamicButton(document, "#445566")
    document.appendChild(root)
    root.setAttribute("style", "display:flex; width:80px; height:20px")
    root.append(first.button, second.button)
    const lease = acquireDocumentCompiledStyleSheets(document, [{
      id: "dynamic-hover",
      cssText: [
        "[data-dynamic-button]{display:block;width:40px;height:20px;background:#000000;--hover-color:#999999}",
        "[data-dynamic-button]:hover{background:var(--hover-color)}",
        "[data-dynamic-label]{color:var(--hover-color)}"
      ].join("\n")
    }])
    const interactionState = createDocumentInteractionState(document)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 80, height: 20},
      interactionState,
      styleSheets: []
    })

    const initial = renderer.flush()
    expect(background(initial, first.button).color).toBe("#000000")
    expect(background(initial, second.button).color).toBe("#000000")
    expect(text(initial, first.label).color).toBe("#112233")
    expect(text(initial, second.label).color).toBe("#445566")

    interactionState.setHoveredElement(first.button)
    expect(background(renderer.flush(), first.button).color).toBe("#112233")
    first.button.setAttribute("style", "--hover-color:#778899")
    const updated = renderer.flush()
    expect(background(updated, first.button).color).toBe("#778899")
    expect(text(updated, first.label).color).toBe("#778899")

    interactionState.setHoveredElement(second.button)
    expect(background(renderer.flush(), second.button).color).toBe("#445566")
    second.button.setAttribute("style", "--hover-color:#445566; background:#abcdef")
    expect(background(renderer.flush(), second.button).color).toBe("#abcdef")
    expect(readDocumentCompiledStyleSheets(document).styleSheets).toHaveLength(1)

    renderer.dispose()
    lease.release()
  })

  test("inherits case-sensitive values and resolves nested fallbacks and cycles", () => {
    const document = createDocument()
    const root = document.createElement("main")
    const inherited = document.createElement("div")
    const caseSensitive = document.createElement("div")
    const nestedFallback = document.createElement("div")
    const cycle = document.createElement("div")
    const cycleFallback = document.createElement("div")
    const declarationScope = document.createElement("div")
    const pseudo = document.createElement("div")
    document.appendChild(root)
    root.setAttribute("style", [
      "display:flex",
      "width:120px",
      "height:20px",
      "--Tone:#123456",
      "--fallback:#345678",
      "--Alias:var(--Tone)",
      "--a:var(--b)",
      "--b:var(--a)"
    ].join(";"))
    inherited.setAttribute("data-inherited", "")
    caseSensitive.setAttribute("data-case", "")
    nestedFallback.setAttribute("data-nested", "")
    cycle.className = "cycle-base"
    cycle.id = "cycle"
    cycleFallback.setAttribute("data-cycle-fallback", "")
    declarationScope.setAttribute("data-declaration-scope", "")
    declarationScope.setAttribute("style", "--Tone:#ffffff")
    pseudo.setAttribute("data-pseudo-variable", "")
    root.append(
      inherited,
      caseSensitive,
      nestedFallback,
      cycle,
      cycleFallback,
      declarationScope,
      pseudo,
    )
    const interactionState = createDocumentInteractionState(document)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 20},
      interactionState,
      styleSheets: [String.raw`
        main > div { display:block; width:20px; height:20px; }
        [data-inherited] { background:var(--Tone); }
        [data-case] { background:var(--tone, #234567); }
        [data-nested] { background:var(--missing, var(--fallback, #000000)); }
        .cycle-base { background:#111111; }
        #cycle { background:var(--a); }
        [data-cycle-fallback] { background:var(--a, #456789); }
        [data-declaration-scope] { background:var(--Alias); }
        [data-pseudo-variable] { --State:#56789a; background:var(--State); }
        [data-pseudo-variable]:hover { --State:#6789ab; }
      `]
    })

    const initial = renderer.flush()
    expect(background(initial, inherited).color).toBe("#123456")
    expect(background(initial, caseSensitive).color).toBe("#234567")
    expect(background(initial, nestedFallback).color).toBe("#345678")
    expect(hasBackground(initial, cycle)).toBeFalse()
    expect(background(initial, cycleFallback).color).toBe("#456789")
    expect(background(initial, declarationScope).color).toBe("#123456")
    expect(background(initial, pseudo).color).toBe("#56789a")
    interactionState.setHoveredElement(pseudo)
    expect(background(renderer.flush(), pseudo).color).toBe("#6789ab")

    renderer.dispose()
  })

  test("reuses inherited environments and isolates sparse own declarations", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const inherited = document.createElement("span")
    const inheritedAgain = document.createElement("span")
    const owner = document.createElement("span")
    root.setAttribute("style", "--Root:#123456")
    owner.setAttribute("style", "--Local:#abcdef")
    root.append(inherited, inheritedAgain, owner)
    document.appendChild(root)
    const rules = parseStyleSheets([])
    const rootStyle = computeStyle(root, null, rules)
    const inheritedStyle = computeStyle(inherited, rootStyle, rules)
    const inheritedAgainStyle = computeStyle(inheritedAgain, rootStyle, rules)
    const ownerStyle = computeStyle(owner, rootStyle, rules)

    expect(inheritedStyle.customProperties).toBe(rootStyle.customProperties)
    expect(inheritedAgainStyle.customProperties).toBe(rootStyle.customProperties)
    expect(ownerStyle.customProperties).not.toBe(rootStyle.customProperties)
    expect(ownerStyle.customProperties.parent).toBe(rootStyle.customProperties)
    expect(ownerStyle.customProperties.own).toEqual({"--Local": "#abcdef"})
    expect(Object.isFrozen(ownerStyle.customProperties.own)).toBeTrue()
  })

  test("substitutes admitted sizing and transform longhands before value parsing", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.appendChild(element)
    element.setAttribute("style", [
      "--size:20px",
      "--offset:translateX(7px)",
      "--origin:0% 0%",
      "display:block",
      "width:var(--size)",
      "height:var(--size)",
      "transform:var(--offset)",
      "transform-origin:var(--origin)"
    ].join(";"))
    const frame = createDocumentRenderer({
      document,
      root: element,
      viewport: {width: 40, height: 40},
      styleSheets: []
    }).flush()
    const box = frame.boxByNode.get(element)

    expect(box).toMatchObject({width: 20, height: 20})
    expect(box?.transform).toMatchObject({translateX: 7, translateY: 0, scaleX: 1, scaleY: 1})
  })

  test("substitutes the admitted single border and box-shadow forms", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.appendChild(element)
    element.setAttribute("style", [
      "--outline:#123456",
      "--border-width:1px",
      "--emboss:0 1px 0 #234567",
      "display:block",
      "box-sizing:border-box",
      "width:20px",
      "height:20px",
      "background:#ffffff",
      "border:var(--border-width) solid var(--outline)",
      "box-shadow:var(--emboss)"
    ].join(";"))
    const frame = createDocumentRenderer({
      document,
      root: element,
      viewport: {width: 30, height: 30},
      styleSheets: []
    }).flush()
    const backgroundItem = background(frame, element)
    const shadowItem = frame.displayList.find((candidate): candidate is RectDisplayItem =>
      candidate.kind === "rect" && candidate.node === element && candidate.key === "shadow"
    )

    expect(backgroundItem.border).toMatchObject({
      widths: {top: 1, right: 1, bottom: 1, left: 1},
      colors: {top: "#123456", right: "#123456", bottom: "#123456", left: "#123456"}
    })
    expect(shadowItem).toMatchObject({
      x: 0,
      y: 1,
      color: "#234567",
      shadow: {blurRadius: 0, spreadRadius: 0}
    })
  })

  test("does not reveal a lower border when the winning variable shorthand is invalid", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.appendChild(element)
    element.setAttribute("data-invalid-border", "")
    const renderer = createDocumentRenderer({
      document,
      root: element,
      viewport: {width: 20, height: 20},
      styleSheets: [
        "[data-invalid-border]{display:block;width:20px;height:20px;background:#ffffff;border:2px solid #123456}",
        "[data-invalid-border]{border:var(--missing-outline)}"
      ]
    })

    expect(background(renderer.flush(), element).border.widths).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    })
    renderer.dispose()
  })

  test("resolves foundation aliases into rgb alpha, calc dimensions and focused borders", () => {
    const document = createDocument()
    const root = document.createElement("main")
    const component = document.createElement("button")
    document.appendChild(root)
    root.appendChild(component)
    root.setAttribute("style", [
      "--foundation-triplet:113 168 255",
      "--foundation-alpha:.4",
      "--foundation-unit:8px",
      "--semantic-focus:rgb(var(--foundation-triplet))",
      "--semantic-surface:rgb(var(--foundation-triplet) / var(--foundation-alpha))",
      "--semantic-control-size:calc(var(--foundation-unit) * 2)"
    ].join(";"))
    component.setAttribute("data-foundation-control", "")
    component.setAttribute("style", [
      "--component-focus:var(--semantic-focus)",
      "--component-surface:var(--semantic-surface)",
      "--component-size:var(--semantic-control-size)"
    ].join(";"))
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 40, height: 40},
      styleSheets: [String.raw`
        [data-foundation-control] {
          display:block;
          box-sizing:border-box;
          width:var(--component-size);
          height:calc(var(--foundation-unit) / 2);
          gap:calc(var(--foundation-unit) * .5);
          font-size:calc(1em * .875);
          line-height:calc(1em * 1.5);
          background:var(--component-surface);
          border:var(--foundation-unit) solid transparent;
        }
        [data-foundation-control]:focus { border-color:var(--component-focus); }
      `]
    })

    const initial = renderer.flush()
    expect(background(initial, component).color).toBe("rgb(113 168 255 / .4)")
    expect(initial.boxByNode.get(component)).toMatchObject({width: 16, height: 4})
    const rules = parseStyleSheets([String.raw`
      [data-foundation-control] {
        gap:calc(var(--foundation-unit) * .5);
        font-size:calc(1em * .875);
        line-height:calc(1em * 1.5);
      }
    `])
    const rootStyle = computeStyle(root, null, rules)
    const componentStyle = computeStyle(component, rootStyle, rules)
    expect(componentStyle.rowGap).toBe(4)
    expect(componentStyle.columnGap).toBe(4)
    expect(componentStyle.fontSize).toBe(14)
    expect(componentStyle.lineHeight).toEqual({kind: "length", value: 21})

    component.focus()
    expect(background(renderer.flush(), component).border.colors).toEqual({
      top: "rgb(113 168 255)",
      right: "rgb(113 168 255)",
      bottom: "rgb(113 168 255)",
      left: "rgb(113 168 255)"
    })
    renderer.dispose()
  })

  test("does not silently admit min max clamp or mixed-unit calc", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.appendChild(element)
    element.setAttribute("style", [
      "width:min(10px, 20px)",
      "height:max(10px, 20px)",
      "min-width:clamp(10px, 20px, 30px)",
      "max-width:calc(100% - 4px)"
    ].join(";"))
    const style = computeStyle(element, null, parseStyleSheets([]))

    expect(style.width).toBeNull()
    expect(style.height).toBeNull()
    expect(style.minWidth).toBeNull()
    expect(style.maxWidth).toBeNull()
  })

  test("keeps one parsed sheet for one thousand instance environments", () => {
    const document = createDocument()
    const root = document.createElement("main")
    document.appendChild(root)
    root.setAttribute("style", "display:block; width:10px")
    const lease = acquireDocumentCompiledStyleSheets(document, [{
      id: "thousand-custom-properties",
      cssText: "[data-instance]{display:block;width:1px;height:1px;background:var(--instance-color)}"
    }])
    const instances: import("@zavx0z/dom").HTMLElement[] = []
    document.transaction(() => {
      for (let index = 0; index < 1_000; index += 1) {
        const instance = document.createElement("div")
        instance.setAttribute("data-instance", "")
        instance.setAttribute("style", `--instance-color:${index % 2 === 0 ? "#111111" : "#222222"}`)
        instances.push(instance)
        root.appendChild(instance)
      }
    })
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 10, height: 1_000},
      styleSheets: []
    })

    const frame = renderer.flush()
    expect(background(frame, instances[0]!).color).toBe("#111111")
    expect(background(frame, instances[999]!).color).toBe("#222222")
    expect(documentStyleRuleCacheStats(document)).toEqual({entries: 1, parses: 1})
    expect(renderer.flush()).toBe(frame)

    renderer.dispose()
    lease.release()
  })

  test("fails other var-bearing multi-value shorthands closed in the bounded slice", () => {
    const document = createDocument()
    const element = document.createElement("div")
    document.appendChild(element)
    element.setAttribute("style", "--space:10px; margin:var(--space); padding:var(--space)")
    const frame = createDocumentRenderer({
      document,
      root: element,
      viewport: {width: 20, height: 20},
      styleSheets: []
    }).flush()

    expect(frame.boxByNode.get(element)?.margin).toEqual({top: 0, right: 0, bottom: 0, left: 0})
    expect(frame.boxByNode.get(element)?.padding).toEqual({top: 0, right: 0, bottom: 0, left: 0})
  })
})

function dynamicButton(document: ReturnType<typeof createDocument>, color: string) {
  const button = document.createElement("button")
  const label = document.createElement("span")
  button.setAttribute("data-dynamic-button", "")
  button.setAttribute("style", `--hover-color:${color}`)
  label.setAttribute("data-dynamic-label", "")
  label.append("Label")
  button.appendChild(label)
  return {button, label}
}

function background(frame: RenderFrame, node: import("@zavx0z/dom").Element): RectDisplayItem {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "background"
  )
  if (!item) throw new Error("Expected a background display item")
  return item
}

function hasBackground(frame: RenderFrame, node: import("@zavx0z/dom").Element): boolean {
  return frame.displayList.some(candidate =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "background"
  )
}

function text(frame: RenderFrame, owner: import("@zavx0z/dom").Element): TextDisplayItem {
  const item = frame.displayList.find((candidate): candidate is TextDisplayItem =>
    candidate.kind === "text" && candidate.node.parentNode === owner
  )
  if (!item) throw new Error("Expected a text display item")
  return item
}
