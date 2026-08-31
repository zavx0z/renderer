import {describe, expect, test} from "bun:test"
import {createDocument, type Element} from "@zavx0z/dom"
import {runtime, type RendererStoryDescriptor} from "../runtime.ts"
import type {FlexStoryPresetId} from "./contract.ts"
import {isFlexStoryChannel} from "./store.ts"
import * as flexStories from "./story.ts"

type StoryCase = Readonly<{
  exportName: keyof typeof flexStories
  route: string
  presetId: FlexStoryPresetId
  descriptor: RendererStoryDescriptor
}>

const STORY_CASES: readonly StoryCase[] = Object.freeze([{
  exportName: "packing",
  route: "css/flex/packing",
  presetId: "packing",
  descriptor: flexStories.packing,
}, {
  exportName: "column",
  route: "css/flex/column",
  presetId: "column",
  descriptor: flexStories.column,
}, {
  exportName: "wrapReverse",
  route: "css/flex/wrap-reverse",
  presetId: "reverse",
  descriptor: flexStories.wrapReverse,
}, {
  exportName: "alignment",
  route: "css/flex/alignment",
  presetId: "alignment",
  descriptor: flexStories.alignment,
}, {
  exportName: "sizing",
  route: "css/flex/sizing",
  presetId: "sizing",
  descriptor: flexStories.sizing,
}, {
  exportName: "shrink",
  route: "css/flex/shrink",
  presetId: "shrink",
  descriptor: flexStories.shrink,
}])

describe("Renderer CSS Flex owner stories", () => {
  test("exports six exact preset descriptors", () => {
    expect(Object.keys(flexStories).sort()).toEqual(STORY_CASES.map(value => value.exportName).sort())
    for (const {descriptor, route} of STORY_CASES) expect(descriptor.route).toBe(route)
  })

  for (const {descriptor, presetId, route} of STORY_CASES) {
    test(`${route} presents one exact-realm compiled root initialized from ${presetId}`, async () => {
      const document = createDocument()
      type Presentation = Parameters<Parameters<typeof runtime.create>[0]["present"]>[0]
      const presentations: Presentation[] = []
      const session = runtime.create({
        document,
        signal: new AbortController().signal,
        present(value) {
          presentations.push(value)
          document.appendChild(value.node)
        },
        reportDiagnostic(value) {
          throw new Error(`Unexpected Flex story diagnostic: ${String(value)}`)
        },
      })

      const operationAbort = new AbortController()
      await session.mount({
        route: descriptor.route,
        story: descriptor,
        signal: operationAbort.signal,
      })

      expect(presentations).toHaveLength(1)
      const presentation = presentations[0]!
      expect(presentation.protocol).toBe("story-presentation/1")
      expect(presentation.node.ownerDocument).toBe(document)
      const preview = presentation.node as Element
      expect(preview.matches("[data-flex-story-preview]")).toBeTrue()
      expect(preview.querySelector("[data-flex-story-controls]")).toBeNull()
      for (const control of ["button", "input", "select", "textarea"]) {
        expect(preview.querySelector(control), `preview contains ${control}`).toBeNull()
      }
      expect(Object.keys(presentation.values)).toEqual(["flex-controls"])
      const channel = presentation.values["flex-controls"]
      expect(isFlexStoryChannel(channel)).toBeTrue()
      if (!isFlexStoryChannel(channel)) throw new Error("Missing Flex story channel")
      expect(channel.getSnapshot().presetId).toBe(presetId)

      expect(Object.keys(presentation.source).sort()).toEqual(["html", "typescript"])
      expect(presentation.source.html).toContain('data-flex-story-preview=""')
      expect(presentation.source.html).toContain('data-flex-story-container=""')
      expect(presentation.source.typescript).toContain(
        `createFlexStoryChannel("${presetId}")`,
      )
      expect(presentation.source.typescript).toContain("<FlexStoryPreview")
      expect(Object.hasOwn(presentation.source, "css")).toBeFalse()

      const styleSnapshot = presentation.componentRoot.readStyleSheets() as Readonly<{
        revision: number
        styleSheets: readonly Readonly<{
          source?: Readonly<{
            kind: string
            moduleId: string
            componentName: string
            cssText: string
          }>
        }>[]
      }>
      expect(styleSnapshot.revision).toBeGreaterThan(0)
      expect(styleSnapshot.styleSheets.length).toBeGreaterThan(0)
      for (const styleSheet of styleSnapshot.styleSheets) {
        expect(styleSheet.source).toMatchObject({kind: "authored-css"})
        expect(styleSheet.source?.moduleId.startsWith("@zavx0z/renderer")).toBeTrue()
        expect(styleSheet.source?.componentName.length).toBeGreaterThan(0)
        expect(styleSheet.source?.cssText).not.toContain("data-z-")
      }

      const container = preview.querySelector("[data-flex-story-container]")
      const initialDirection = channel.getSnapshot().container.direction
      const nextDirection = initialDirection === "row" ? "column" : "row"
      expect(container?.getAttribute("data-direction")).toBe(initialDirection)
      channel.dispatch({type: "set-direction", value: nextDirection})
      expect(container?.getAttribute("data-direction")).toBe(nextDirection)
      expect(presentations).toHaveLength(1)

      operationAbort.abort()
      expect(document.childNodes).toHaveLength(0)
      expect(channel.getSnapshot().presetId).toBe("custom")
      expect(() => channel.dispatch({type: "set-wrap", value: "nowrap"})).toThrow("disposed")
      await session.unmount()
      await session.dispose()
      await session.dispose()
    })
  }

  test("fails an aborted story operation without mounting or presenting", async () => {
    const document = createDocument()
    let presents = 0
    const session = runtime.create({
      document,
      signal: new AbortController().signal,
      present() { presents += 1 },
      reportDiagnostic() {},
    })
    const abort = new AbortController()
    abort.abort()
    await expect(session.mount({
      route: flexStories.packing.route,
      story: flexStories.packing,
      signal: abort.signal,
    })).rejects.toMatchObject({name: "AbortError"})
    expect(presents).toBe(0)
    expect(document.childNodes).toHaveLength(0)
    await session.dispose()
  })
})
