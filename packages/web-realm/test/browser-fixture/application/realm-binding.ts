// @zavx0z/web-realm no-transform
import {createDocument} from "@zavx0z/dom"
import {createDocumentRenderer} from "@zavx0z/renderer"
import {createWebRealm} from "../../../src/index.ts"

export const nativeWindow = window
export const nativeDocument = document
export const nativeHTMLElement = HTMLElement
export const semanticDocument = createDocument()
export const semanticRoot = semanticDocument.createElement("div")
semanticRoot.setAttribute("style", "width:240px; height:80px")
semanticDocument.appendChild(semanticRoot)

export const renderer = createDocumentRenderer({
  document: semanticDocument,
  root: semanticRoot,
  viewport: {width: 320, height: 180},
})
export const webRealm = createWebRealm({
  document: semanticDocument,
  platformWindow: nativeWindow,
})

webRealm.attachRenderer({
  getRenderer: () => renderer,
  flush: () => renderer.flush(),
})
