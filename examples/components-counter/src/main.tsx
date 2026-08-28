import {loadSharedFont} from "@engine/core/default-font"
import defaultFontUrl from "@engine/core/fonts/jetbrains-mono-bold.ttf"
import {createDocument} from "@zavx0z/dom"
import {createRoot} from "@zavx0z/dom-components"
import {createDocumentCanvasRuntime} from "@zavx0z/renderer-browser"
import {Counter} from "./counter.tsx"

const canvas = document.querySelector("#host-canvas")
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing host canvas")

const semanticDocument = createDocument()
const semanticRoot = semanticDocument.createElement("div")
semanticRoot.setAttribute("style", "display:flex; width:320px; height:180px; padding:20px")
semanticDocument.appendChild(semanticRoot)

createRoot(semanticRoot).render(<Counter initial={0} label="Clicks" step={1} />)

const runtime = await createDocumentCanvasRuntime({
  canvas,
  document: semanticDocument,
  root: semanticRoot,
  styleSheets: [],
  font: await loadSharedFont(defaultFontUrl, document.baseURI),
  pixelRatio: 1,
})

runtime.subscribe(frame => {
  canvas.dataset.ready = "true"
  canvas.dataset.semanticText = semanticRoot.textContent ?? ""
  canvas.dataset.renderedText = frame.displayList
    .filter(item => item.kind === "text")
    .map(item => item.text)
    .join("")
})
