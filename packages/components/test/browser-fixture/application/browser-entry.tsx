import {loadDocumentDefaultFont} from "@engine/core/default-font"
import {
  HTMLButtonElement as SemanticHTMLButtonElement,
  Node as SemanticNode,
  createDocument,
} from "@zavx0z/dom"
import {createRoot} from "@zavx0z/dom-components"
import {createDocumentCanvasRuntime} from "@zavx0z/renderer-browser"
import {Counter} from "../../fixture/counter.tsx"

const nativeWindow = window
const nativeDocument = document
const canvasNode = nativeDocument.querySelector("#host-canvas")

if (!(canvasNode instanceof HTMLCanvasElement)) throw new Error("Missing host canvas")
const canvas = canvasNode

void run().catch(error => {
  canvas.dataset.proofStatus = "fail"
  canvas.dataset.proofError = error instanceof Error ? error.stack ?? error.message : String(error)
})

async function run(): Promise<void> {
  const semanticDocument = createDocument()
  const semanticRoot = semanticDocument.createElement("div")
  semanticRoot.setAttribute("style", "display:flex; width:320px; height:180px; padding:20px")
  semanticDocument.appendChild(semanticRoot)

  const componentRoot = createRoot(semanticRoot)
  componentRoot.render(<Counter initial={2} label="Clicks" step={3} />)
  const button = semanticRoot.querySelector("button")
  if (!(button instanceof SemanticHTMLButtonElement)) throw new Error("Counter did not create a button")

  const runtime = await createDocumentCanvasRuntime({
    canvas,
    document: semanticDocument,
    root: semanticRoot,
    styleSheets: [],
    font: await loadDocumentDefaultFont(nativeDocument),
    pixelRatio: 1,
  })
  runtime.subscribe(frame => {
    const semanticText = button.textContent ?? ""
    const renderedText = frame.displayList
      .filter(item => item.kind === "text")
      .map(item => item.text)
      .join("")
    canvas.dataset.semanticText = semanticText
    canvas.dataset.renderedText = renderedText
  })
  const firstFrame = runtime.currentFrame
  const dynamicText = button.lastChild
  if (!dynamicText || dynamicText.nodeType !== SemanticNode.TEXT_NODE) {
    throw new Error("Counter did not create its dynamic Text")
  }
  const initialText = button.textContent
  const mutationBatches: number[] = []
  const unsubscribe = semanticDocument.subscribeMutations(batch => {
    mutationBatches.push(batch.records.length)
  })

  button.click()
  const secondFrame = runtime.render()
  const hit = secondFrame.hits.get(button)
  if (!hit) throw new Error("Renderer did not publish the button hit region")
  canvas.dataset.semanticHit = JSON.stringify({
    x: hit.x,
    y: hit.y,
    width: hit.width,
    height: hit.height,
  })
  canvas.dataset.viewport = JSON.stringify(runtime.viewport)
  const checks = {
    actualCanvasPresentation: canvas.width > 0 && canvas.height > 0,
    exactDynamicTextPreserved: button.lastChild === dynamicText,
    mutationReachedRenderer:
      secondFrame.revision === firstFrame.revision + 1 &&
      secondFrame.displayList.some(item =>
        item.kind === "text" && item.node === dynamicText && item.text === "5"
      ),
    oneSemanticMutationBatch: mutationBatches.length === 1,
    propsPassed: initialText === "Clicks: 2" && button.textContent === "Clicks: 5",
    standardEventUpdatedState: button.textContent === "Clicks: 5",
    nativeGlobalsUnchanged: window === nativeWindow && document === nativeDocument,
  }
  const passed = Object.values(checks).every(Boolean)

  unsubscribe()
  canvas.dataset.proofStatus = passed ? "pass" : "fail"
  canvas.dataset.proofChecks = JSON.stringify(checks)
}
