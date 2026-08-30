/** Renderer-owned external Storybook story support. */
import {describe, expect, test} from "bun:test"
import {
  HTMLImageElement,
  createDocument,
} from "@zavx0z/dom"
import {
  IMAGE_DOM_STORY_ARTWORK_SRC,
  createImageDomStory,
  isImageDomStoryRoute,
} from "./image-dom-story.ts"
import {IMAGE_DOM_STORY_ROUTES} from "./dom-routes.ts"

describe("exact DOM image stories", () => {
  test("covers the two renderer-owned routes with one exact HTMLImageElement realm", async () => {
    expect(IMAGE_DOM_STORY_ROUTES).toEqual([
      "elements/primitives/img/fit/cover",
      "elements/primitives/img/fit/contain",
    ])
    for (const route of IMAGE_DOM_STORY_ROUTES) {
      const story = createImageDomStory(createDocument(), route)
      expect(isImageDomStoryRoute(route), route).toBeTrue()
      expect(story.element.localName, route).toBe("section")
      expect(story.refs.image, route).toBeInstanceOf(HTMLImageElement)
      expect(story.source.html, route).toContain("<img")
      expect(story.source.html, route).not.toContain("</img>")
      expect(story.source.typescript, route).toContain('from "@zavx0z/dom"')
      expect(story.source.typescript, route).toContain('document.createElement("img")')
      expect(story.source.typescript, route).toContain(story.refs.image.src)
      expect(Object.isFrozen(story.source), route).toBeTrue()
      expect(Object.isFrozen(story.refs), route).toBeTrue()
      expect(story.componentRoot.readStyleSheets().styleSheets.every(sheet =>
        sheet.source?.kind === "authored-css"), route).toBeTrue()
    }
    expect(isImageDomStoryRoute("elements/primitives/img/fit/stretch")).toBeFalse()

    const source = await Bun.file(new URL("./image-dom-story.ts", import.meta.url)).text()
    for (const forbidden of [
      "@layout/core",
      "@ui/elements",
      "@zavx0z/renderer",
      "UiSurface",
      "RenderHost",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("uses explicit CSS boxes and object-fit for cover and contain", () => {
    const cover = createImageDomStory(
      createDocument(),
      "elements/primitives/img/fit/cover",
    )
    const contain = createImageDomStory(
      createDocument(),
      "elements/primitives/img/fit/contain",
    )

    for (const story of [cover, contain]) {
      expect(story.refs.image.src).toBe(IMAGE_DOM_STORY_ARTWORK_SRC)
      expect(story.refs.image.alt).toBe("Абстрактная сцена")
      expect(story.refs.image.width).toBe(320)
      expect(story.refs.image.height).toBe(180)
      expect(story.source.html).toContain('width="320"')
      expect(story.source.html).toContain('height="180"')
      expect(story.source.html).toContain('alt="Абстрактная сцена"')
    }
    expect(cover.refs.image.getAttribute("data-image-fit")).toBe("cover")
    expect(contain.refs.image.getAttribute("data-image-fit")).toBe("contain")
    expect(cover.componentRoot.readStyleSheets().styleSheets.some(sheet =>
      /object-fit:\s*cover/u.test(sheet.cssText))).toBeTrue()
    expect(contain.componentRoot.readStyleSheets().styleSheets.some(sheet =>
      /object-fit:\s*contain/u.test(sheet.cssText))).toBeTrue()
  })

  test("embeds the artwork source without network or package asset ownership", () => {
    for (const source of [IMAGE_DOM_STORY_ARTWORK_SRC]) {
      expect(source).toStartWith("data:image/svg+xml;charset=utf-8,")
      expect(source).not.toContain("http://")
      expect(source).not.toContain("https://")
      const svg = decodeURIComponent(source.slice(source.indexOf(",") + 1))
      expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg"')
      expect(svg).toEndWith("</svg>")
      expect(svg).not.toContain("<image")
      expect(svg).not.toContain("href=")
    }
  })
})
