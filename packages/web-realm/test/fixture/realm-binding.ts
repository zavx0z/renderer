// @zavx0z/web-realm no-transform
import {type TrueTypeFont} from "@engine/core"
import {createDocument} from "@zavx0z/dom"
import {createDocumentRenderer} from "@zavx0z/renderer"
import {RendererWebGpuBackend} from "@zavx0z/renderer-webgpu"
import {createWebRealm} from "../../src/index.ts"

export const semanticDocument = createDocument()
export const semanticRoot = semanticDocument.createElement("div")
semanticRoot.setAttribute("style", "width:240px; height:80px")
semanticDocument.appendChild(semanticRoot)

export const renderer = createDocumentRenderer({
  document: semanticDocument,
  root: semanticRoot,
  viewport: {width: 320, height: 180},
})
export const backend = new RendererWebGpuBackend({
  font: fakeFont(),
  invalidateGeometry() {},
})
export const webRealm = createWebRealm({
  document: semanticDocument,
  platformWindow: globalThis,
})

export const flushPipeline = () => {
  const frame = renderer.flush()
  backend.applyFrame(frame)
  return frame
}

webRealm.attachRenderer({
  getRenderer: () => renderer,
  flush: flushPipeline,
})

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
