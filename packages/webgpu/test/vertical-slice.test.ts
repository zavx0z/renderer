import {describe, expect, test} from "bun:test"
import {
  CachedText,
  ImageMaterial,
  Mesh,
  RoundedRectMaterial,
  type BufferGeometry,
  type TrueTypeFont,
} from "@engine/core"
import {createDocument} from "@zavx0z/dom"
import {
  createDocumentInteractionController,
  createDocumentRenderer,
} from "@zavx0z/renderer"
import {RendererWebGpuBackend} from "../src/index.ts"

describe("document to retained WebGPU vertical slice", () => {
  test("projects CSS box-shadow through one analytical retained RoundedRect", () => {
    const document = createDocument()
    const card = document.createElement("div")
    document.appendChild(card)
    const base = "box-sizing:border-box; width:80px; height:40px; border-radius:8px; background:#ffffff"
    card.setAttribute(
      "style",
      `${base}; box-shadow:4px 6px 8px 2px rgba(0,0,0,.5); transform:translateX(10px) scale(1.5); transform-origin:0 0`,
    )
    const renderer = createDocumentRenderer({
      document,
      root: card,
      viewport: {width: 180, height: 100},
    })
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})

    backend.applyFrame(renderer.flush())
    const shadow = requireChild(backend, "DIV:shadow", Mesh)
    const background = requireChild(backend, "DIV:background", Mesh)
    const geometry = shadow.geometry
    const material = requireRoundedMaterial(shadow)
    expect(backend.root.children).toEqual([shadow, background])
    expect(material).toMatchObject({
      width: 80,
      height: 40,
      shadowBlur: 8,
      shadowSpread: 2,
      opacity: 1,
    })
    expect(shadow.scale).toMatchObject({x: 1.5, y: 1.5})

    card.setAttribute(
      "style",
      `${base}; box-shadow:2px 3px 4px 1px #123456; transform:translateX(20px) scale(.75); transform-origin:0 0`,
    )
    backend.applyFrame(renderer.flush())
    expect(requireChild(backend, "DIV:shadow", Mesh)).toBe(shadow)
    expect(shadow.geometry).toBe(geometry)
    expect(requireRoundedMaterial(shadow)).toBe(material)
    expect(material.shadowBlur).toBe(4)
    expect(material.shadowSpread).toBe(1)
    expect(shadow.scale).toMatchObject({x: 0.75, y: 0.75})

    backend.dispose()
    renderer.dispose()
  })

  test("projects one semantic img into one retained Engine ImageMaterial", () => {
    const document = createDocument()
    const image = document.createElement("img")
    document.appendChild(image)
    image.src = "metafor:image-first"
    image.width = 96
    image.height = 48
    image.setAttribute("style", "object-fit: contain; opacity: 0.5")
    const renderer = createDocumentRenderer({
      document,
      root: image,
      viewport: {width: 160, height: 90},
    })
    let presentations = 0
    const backend = new RendererWebGpuBackend({
      invalidateGeometry() {},
      requestPresentation: () => { presentations += 1 },
    })

    backend.applyFrame(renderer.flush())
    const mesh = requireChild(backend, "IMG:image", Mesh)
    const material = requireImageMaterial(mesh)
    expect(material).toMatchObject({
      src: "metafor:image-first",
      fit: "contain",
      boxAspect: 2,
      opacity: 0.5,
    })
    material.onTextureChange?.()
    expect(presentations).toBe(1)

    image.src = "metafor:image-second"
    image.width = 120
    image.setAttribute("style", "object-fit: cover; opacity: 0.75")
    backend.applyFrame(renderer.flush())
    expect(requireChild(backend, "IMG:image", Mesh)).toBe(mesh)
    expect(requireImageMaterial(mesh)).toBe(material)
    expect(material).toMatchObject({
      src: "metafor:image-second",
      fit: "cover",
      boxAspect: 2.5,
      opacity: 0.75,
    })

    backend.dispose()
    renderer.dispose()
  })

  test("transports resolved CSS opacity, border and corner radii into exact Engine owners", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("button")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute(
      "style",
      "width: 100px; height: 50px; overflow: hidden; background: rgba(32, 64, 96, 0.8); opacity: 0.5; border: 2px solid #00ff00; border-radius: 8px 6px 4px 2px",
    )
    child.setAttribute(
      "style",
      "width: 20px; height: 10px; background: #ff0000; opacity: 0.5",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 100},
    })
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})

    const frame = renderer.flush()
    backend.applyFrame(frame)
    const rootMesh = requireChild(backend, "DIV:background", Mesh)
    const rootMaterial = requireRoundedMaterial(rootMesh)
    const childMesh = requireChild(backend, "BUTTON:background", Mesh)
    const childMaterial = requireRoundedMaterial(childMesh)

    expect(rootMaterial.fill).toMatchObject({
      r: 32 / 255,
      g: 64 / 255,
      b: 96 / 255,
      a: 0.8,
    })
    expect(rootMaterial.opacity).toBe(0.5)
    expect(rootMaterial.borderWidth).toBe(2)
    expect(rootMaterial.border).toMatchObject({r: 0, g: 1, b: 0, a: 1})
    expect(rootMaterial.radii).toEqual([8, 6, 4, 2])
    expect(childMaterial.opacity).toBe(0.25)
    expect(childMesh.presentationClips.map(clipGeometry)).toEqual([{
      kind: "rounded-rect",
      center: [52, -27],
      halfSize: [50, 25],
      radii: [6, 4, 2, 0],
    }])

    backend.dispose()
    renderer.dispose()
  })

  test("preserves the nested Core overflow chain as ordered Engine clip intersections", () => {
    const document = createDocument()
    const outer = document.createElement("div")
    const inner = document.createElement("div")
    const child = document.createElement("div")
    document.appendChild(outer)
    outer.appendChild(inner)
    inner.appendChild(child)
    outer.setAttribute(
      "style",
      "width: 100px; height: 100px; overflow: hidden; background: #111111",
    )
    inner.setAttribute(
      "style",
      "width: 60px; height: 60px; margin-left: 20px; overflow: hidden; background: #222222",
    )
    child.setAttribute("style", "width: 120px; height: 20px; background: #333333")
    const renderer = createDocumentRenderer({
      document,
      root: outer,
      viewport: {width: 160, height: 120},
    })
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})

    const frame = renderer.flush()
    backend.applyFrame(frame)
    const childMesh = requireChild(backend, "DIV:background", Mesh, 2)

    expect(childMesh.presentationClips.map(clipGeometry)).toEqual([
      {
        kind: "rounded-rect",
        center: [50, -50],
        halfSize: [50, 50],
        radii: [0, 0, 0, 0],
      },
      {
        kind: "rounded-rect",
        center: [50, -30],
        halfSize: [30, 30],
        radii: [0, 0, 0, 0],
      },
    ])

    backend.dispose()
    renderer.dispose()
  })

  test("preserves semantic and Engine identity across addressed DOM mutations", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    const label = document.createTextNode("Output")
    document.appendChild(root)
    root.appendChild(button)
    button.appendChild(label)
    button.title = "Show output"
    root.setAttribute(
      "style",
      "display: flex; width: 240px; height: 48px; padding: 8px; background: #111827",
    )
    button.setAttribute(
      "style",
      "width: 96px; height: 24px; background: #1f2937; color: #f9fafb",
    )

    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 320, height: 180},
    })
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      font: fakeFont(),
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })

    const firstFrame = renderer.flush()
    backend.applyFrame(firstFrame)
    const rootMesh = requireChild(backend, "DIV:background", Mesh)
    const buttonMesh = requireChild(backend, "BUTTON:background", Mesh)
    const textObject = requireChild(backend, "#text:text", CachedText)

    expect(firstFrame.hits.get(button)).toMatchObject({
      node: button,
      interactive: true,
      role: "button",
    })
    expect(button.title).toBe("Show output")
    expect(renderer.flush()).toBe(firstFrame)

    const interaction = createDocumentInteractionController({
      document,
      tooltipDelayMs: 0,
    })
    interaction.pointerMove(firstFrame, {clientX: 10, clientY: 10, timeStamp: 0})
    const titledFrame = interaction.composeFrame(firstFrame, 0)
    backend.applyFrame(titledFrame)
    const tooltipMesh = requireChild(backend, "BUTTON:ua:title-background", Mesh)
    const tooltipText = requireChild(backend, "BUTTON:ua:title-text:0", CachedText)
    expect(requireChild(backend, "BUTTON:background", Mesh)).toBe(buttonMesh)
    expect(interaction.composeFrame(firstFrame, 1)).toBe(titledFrame)

    document.transaction(() => {
      label.data = "Result"
      button.setAttribute(
        "style",
        "width: 120px; height: 24px; background: #2563eb; color: #ffffff",
      )
    })
    const secondFrame = renderer.flush()
    backend.applyFrame(interaction.composeFrame(secondFrame, 2))

    expect(secondFrame.revision).toBe(firstFrame.revision + 1)
    expect(secondFrame.boxByNode.get(button)?.width).toBe(132)
    expect(requireChild(backend, "DIV:background", Mesh)).toBe(rootMesh)
    expect(requireChild(backend, "BUTTON:background", Mesh)).toBe(buttonMesh)
    expect(requireChild(backend, "#text:text", CachedText)).toBe(textObject)
    expect(requireChild(backend, "BUTTON:ua:title-background", Mesh)).toBe(tooltipMesh)
    expect(requireChild(backend, "BUTTON:ua:title-text:0", CachedText)).toBe(tooltipText)
    expect(textObject.text).toBe("Result")
    expect(invalidated).toEqual([])

    root.removeChild(button)
    backend.applyFrame(renderer.flush())

    expect(backend.root.children).toEqual([rootMesh])
    expect(invalidated).toContain(buttonMesh.geometry)
    expect(invalidated).toContain(tooltipMesh.geometry)
    interaction.dispose()
    renderer.dispose()
    backend.dispose()
  })
})

function requireChild<T extends typeof Mesh | typeof CachedText>(
  backend: RendererWebGpuBackend,
  name: string,
  type: T,
  occurrence = 0,
): InstanceType<T> {
  const child = backend.root.children.filter((candidate) => candidate.name === name)[occurrence]
  if (!(child instanceof type)) throw new Error(`Expected ${name}`)
  return child as InstanceType<T>
}

function requireImageMaterial(mesh: Mesh): ImageMaterial {
  if (Array.isArray(mesh.material)) throw new Error("Expected one Engine material")
  if (!(mesh.material instanceof ImageMaterial)) throw new Error("Expected ImageMaterial")
  return mesh.material
}

function clipGeometry(shape: import("@engine/core").PresentationClipShape) {
  return {
    kind: shape.kind,
    center: shape.center,
    halfSize: shape.halfSize,
    radii: shape.radii,
  }
}

function requireRoundedMaterial(mesh: Mesh): RoundedRectMaterial {
  if (Array.isArray(mesh.material) || !(mesh.material instanceof RoundedRectMaterial)) {
    throw new Error("Expected RoundedRectMaterial")
  }
  return mesh.material
}

function fakeFont(): TrueTypeFont {
  return {
    unitsPerEm: 1000,
    ascent: 800,
    descent: 200,
    mapCharToGlyph: () => 0,
    getGlyphOutline: () => ({
      points: new Float32Array(),
      onCurve: new Uint8Array(),
      contours: new Uint16Array(),
    }),
    getHMetric: () => ({advanceWidth: 500, lsb: 0}),
  } as unknown as TrueTypeFont
}
