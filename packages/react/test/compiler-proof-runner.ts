import type {TrueTypeFont} from "@engine/core"
import {createDocumentRenderer} from "@zavx0z/renderer"
import {RendererWebGpuBackend} from "@zavx0z/renderer-webgpu"
import {pathToFileURL} from "node:url"

const outputPath = process.argv[2]
if (!outputPath) throw new Error("Compiler proof runner requires one bundle path")
const application = await import(`${pathToFileURL(outputPath).href}?proof=${Date.now()}`) as Proof
const rowsBefore = rowMap(application.semanticRoot)
const button = application.semanticRoot.querySelector("button") as import("@zavx0z/dom").HTMLButtonElement
const buttonText = button.firstChild
const renderer = createDocumentRenderer({
  document: application.semanticDocument,
  root: application.semanticRoot,
  viewport: {width: 320, height: 180},
})
const backend = new RendererWebGpuBackend({font: fakeFont(), invalidateGeometry() {}})
backend.applyFrame(renderer.flush())
const retained = backend.root.children.find((child) => "text" in child && child.text === "Count: 2")
const initial = button.textContent

application.increment()
backend.applyFrame(renderer.flush())
const updated = button.textContent
const retainedText = button.firstChild === buttonText && backend.root.children.some((child) => child === retained)

application.setItems((items) => [items[1]!, items[0]!])
const rowsAfter = rowMap(application.semanticRoot)
const retainedRows = rowsAfter.get("a") === rowsBefore.get("a") && rowsAfter.get("b") === rowsBefore.get("b")

application.root.unmount()
renderer.dispose()
backend.dispose()
console.log(JSON.stringify({initial, updated, retainedText, retainedRows}))

type Proof = Readonly<{
  increment(): void
  root: {unmount(): void}
  semanticDocument: import("@zavx0z/dom").Document
  semanticRoot: import("@zavx0z/dom").HTMLElement
  setItems(action: (items: readonly Readonly<{id: string; label: string}>[]) => readonly Readonly<{id: string; label: string}>[]): void
}>

function rowMap(root: import("@zavx0z/dom").HTMLElement): Map<string, import("@zavx0z/dom").Element> {
  return new Map([...root.querySelectorAll("li")].map((row) => [row.getAttribute("data-id")!, row]))
}

function fakeFont(): TrueTypeFont {
  return {
    unitsPerEm: 1_000,
    mapCharToGlyph: () => 0,
    getGlyphOutline: () => ({
      points: new Float32Array(),
      onCurve: new Uint8Array(),
      contours: new Uint16Array(),
    }),
    getHMetric: () => ({advanceWidth: 500, lsb: 0}),
  } as unknown as TrueTypeFont
}
