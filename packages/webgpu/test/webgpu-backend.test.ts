import {describe, expect, test} from "bun:test"
import {
  CachedText,
  ImageMaterial,
  InstancedRoundedRect,
  Mesh,
  Object3D,
  PlaneGeometry,
  RoundedRectMaterial,
  ROUNDED_RECT_INSTANCE_OFFSETS,
  ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH,
  type BufferGeometry,
  type TrueTypeFont,
} from "@engine/core"
import {createDocument, type Node} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type DisplayItem,
  type RenderClip,
  type RenderFrame,
} from "@zavx0z/renderer"
import {RendererWebGpuBackend} from "../src/index.ts"

describe("RendererWebGpuBackend", () => {
  test("receives only canonical colors from the computed CSS pipeline", () => {
    const document = createDocument()
    const root = document.createElement("main")
    const canonical = document.createElement("div")
    const malformed = document.createElement("div")
    document.appendChild(root)
    root.append(canonical, malformed)
    root.setAttribute("style", "display:flex;width:40px;height:20px")
    canonical.setAttribute("style", "width:20px;height:20px;background:red")
    malformed.setAttribute(
      "style",
      "--surface:48 48 48;width:20px;height:20px;background:var(--surface)",
    )
    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 40, height: 20},
    }).flush()
    const rectangles = frame.displayList.filter((item) => item.kind === "rect")
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})

    expect(rectangles).toHaveLength(1)
    expect(rectangles[0]).toMatchObject({node: canonical, color: "#ff0000"})
    expect(() => backend.applyFrame(frame)).not.toThrow()
    expect(backend.root.children).toHaveLength(1)
  })

  test("maps a Rect into one stable Engine Mesh using top-left coordinates", () => {
    const fixture = renderFixture()
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {x: 10, y: 20, width: 80, height: 40, color: "#336699"}),
    ]))

    expect(backend.root).toBeInstanceOf(Object3D)
    expect(backend.root.renderLayer).toBe("ui")
    expect(backend.root.children).toHaveLength(1)
    const mesh = requireMesh(backend.root.children[0])
    expect(mesh.name).toBe("DIV:rect")
    expect(mesh.parent).toBe(backend.root)
    expect(mesh.position).toMatchObject({x: 50, y: -40, z: 0})
    const material = requireRoundedMaterial(mesh)
    expect(material.fill).toMatchObject({
      r: 0x33 / 255,
      g: 0x66 / 255,
      b: 0x99 / 255,
      a: 1,
    })
    expect(material.opacity).toBe(1)
    expect(material.borderWidth).toBe(0)
    expect(material.radii).toEqual([0, 0, 0, 0])
    expect(invalidated).toEqual([])
  })

  test("updates a retained Rect object, geometry and material in place", () => {
    const fixture = renderFixture()
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [rect(fixture.root)]))
    const mesh = requireMesh(backend.root.children[0])
    const geometry = mesh.geometry
    const material = requireRoundedMaterial(mesh)

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        x: 7,
        y: 8,
        width: 30,
        height: 12,
        color: "rgba(255, 0, 0, 0.25)",
        opacity: 0.6,
        border: uniformBorder(2, ["#0f0", "rgb(0, 255, 0)", "#00ff00", "rgba(0, 255, 0, 1)"], {
          topLeft: 4,
          topRight: 3,
          bottomRight: 2,
          bottomLeft: 1,
        }),
      }),
    ], 2))

    expect(backend.root.children[0]).toBe(mesh)
    expect(mesh.geometry).toBe(geometry)
    expect(requireRoundedMaterial(mesh)).toBe(material)
    expect(mesh.position).toMatchObject({x: 22, y: -14, z: 0})
    expect(geometry.attributes.position?.needsUpdate).toBeTrue()
    expect(Array.from(geometry.attributes.position?.array ?? [])).toEqual([
      -15, 6, 0,
      15, 6, 0,
      -15, -6, 0,
      15, -6, 0,
    ])
    expect(material.width).toBe(30)
    expect(material.height).toBe(12)
    expect(material.fill).toMatchObject({r: 1, g: 0, b: 0, a: 0.25})
    expect(material.border).toMatchObject({r: 0, g: 1, b: 0, a: 1})
    expect(material.borderWidth).toBe(2)
    expect(material.radii).toEqual([4, 3, 2, 1])
    expect(material.opacity).toBe(0.6)
    expect(invalidated).toEqual([])
  })

  test("accepts modern CSS Color 4 space and slash transport forms", () => {
    const fixture = renderFixture()
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        color: "rgb(29 29 29)",
        border: uniformBorder(2, "rgb(71 114 179 / 50%)"),
      }),
    ]))

    const material = requireRoundedMaterial(requireMesh(backend.root.children[0]))
    expect(material.fill).toMatchObject({r: 29 / 255, g: 29 / 255, b: 29 / 255, a: 1})
    expect(material.border).toMatchObject({r: 71 / 255, g: 114 / 255, b: 179 / 255, a: 0.5})
  })

  test("updates Rect transform on the same Engine owners without geometry work", () => {
    const fixture = renderFixture()
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [rect(fixture.root)]))
    const mesh = requireMesh(backend.root.children[0])
    const geometry = mesh.geometry
    const material = requireRoundedMaterial(mesh)

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        transform: {scaleX: 2, scaleY: 0.5, translateX: 10, translateY: 20},
      }),
    ], 2))

    expect(backend.root.children[0]).toBe(mesh)
    expect(mesh.geometry).toBe(geometry)
    expect(requireRoundedMaterial(mesh)).toBe(material)
    expect(mesh.position).toMatchObject({x: 20, y: -22.5, z: 0})
    expect(mesh.scale).toMatchObject({x: 2, y: 0.5, z: 1})
    expect(geometry.attributes.position?.needsUpdate).toBeFalse()
    expect(invalidated).toEqual([])
  })

  test("maps analytical shadow Rects onto one retained expanded RoundedRect owner", () => {
    const fixture = renderFixture()
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        key: "shadow",
        x: 10,
        y: 20,
        width: 80,
        height: 40,
        color: "rgba(0, 0, 0, 0.5)",
        opacity: 0.6,
        border: uniformBorder(0, "#000000", {
          topLeft: 8,
          topRight: 6,
          bottomRight: 4,
          bottomLeft: 2,
        }),
        shadow: {blurRadius: 8, spreadRadius: 2},
        transform: {scaleX: 2, scaleY: 0.5, translateX: 5, translateY: 7},
      }),
    ]))
    const mesh = requireMesh(backend.root.children[0])
    const geometry = mesh.geometry
    const material = requireRoundedMaterial(mesh)

    expect(mesh.name).toBe("DIV:shadow")
    expect(mesh.position).toMatchObject({x: 105, y: -27, z: 0})
    expect(mesh.scale).toMatchObject({x: 2, y: 0.5, z: 1})
    expect(Array.from(geometry.attributes.position?.array ?? [])).toEqual([
      -50, 30, 0,
      50, 30, 0,
      -50, -30, 0,
      50, -30, 0,
    ])
    expect(material.width).toBe(80)
    expect(material.height).toBe(40)
    expect(material.radii).toEqual([8, 6, 4, 2])
    expect(material.shadowBlur).toBe(8)
    expect(material.shadowSpread).toBe(2)
    expect(material.fill).toMatchObject({r: 0, g: 0, b: 0, a: 0.5})
    expect(material.opacity).toBe(0.6)

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        key: "shadow",
        x: 12,
        y: 18,
        width: 80,
        height: 40,
        color: "#123456",
        border: uniformBorder(0, "#000000", {topLeft: 8}),
        shadow: {blurRadius: 4, spreadRadius: 1},
      }),
    ], 2))
    expect(backend.root.children[0]).toBe(mesh)
    expect(mesh.geometry).toBe(geometry)
    expect(requireRoundedMaterial(mesh)).toBe(material)
    expect(material.shadowBlur).toBe(4)
    expect(material.shadowSpread).toBe(1)
    expect(Array.from(geometry.attributes.position?.array ?? [])).toEqual([
      -45, 25, 0,
      45, 25, 0,
      -45, -25, 0,
      45, -25, 0,
    ])
    expect(invalidated).toEqual([])
  })

  test("preserves retained identity while reordering and disposes stale geometry", () => {
    const fixture = renderFixture()
    const aNode = fixture.document.createElement("div")
    const bNode = fixture.document.createElement("div")
    const cNode = fixture.document.createElement("div")
    fixture.root.appendChild(aNode)
    fixture.root.appendChild(bNode)
    fixture.root.appendChild(cNode)
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [rect(aNode), rect(bNode)]))
    const a = requireMesh(backend.root.children[0])
    const b = requireMesh(backend.root.children[1])

    backend.applyFrame(frame(fixture.document, fixture.root, [rect(bNode, {x: 4}), rect(cNode)], 2))

    expect(backend.root.children).toHaveLength(2)
    expect(backend.root.children[0]).toBe(b)
    expect(backend.root.children[1]).not.toBe(a)
    expect(a.parent).toBeNull()
    expect(invalidated).toEqual([a.geometry])
  })

  test("keeps CachedText identity and material while rebuilding only changed text geometry", () => {
    const fixture = renderFixture()
    const textNode = fixture.document.createTextNode("One")
    fixture.root.appendChild(textNode)
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      font: fakeFont(),
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [text(textNode, "One", {fontSize: 12})]))
    const label = requireCachedText(backend.root.children[0])
    const material = label.material

    backend.applyFrame(frame(fixture.document, fixture.root, [
      text(textNode, "Two", {
        x: 5,
        y: 6,
        fontSize: 16,
        letterSpacing: 2,
        color: "#0f08",
        opacity: 0.4,
      }),
    ], 2))

    expect(backend.root.children[0]).toBe(label)
    expect(label.material).toBe(material)
    expect(label.text).toBe("Two")
    expect(label.fontSize).toBe(16)
    expect(label.letterSpacing).toBe(2)
    expect(label.position).toMatchObject({x: 5, y: -18.8, z: 0})
    expect(label.material.color).toMatchObject({r: 0, g: 1, b: 0, a: 0x88 / 255})
    expect(label.material.opacity).toBe(0.4)
    expect(invalidated).toEqual([])
  })

  test("positions the alphabetic baseline from the line box without rebuilding text geometry", () => {
    const fixture = renderFixture()
    const textNode = fixture.document.createTextNode("Baseline")
    fixture.root.appendChild(textNode)
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      font: fakeFont(),
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    expect(backend.textMeasurer?.measureTextAdvance("A A", 10, 2)).toBe(17)
    backend.applyFrame(frame(fixture.document, fixture.root, [
      Object.freeze({
        ...text(textNode, "Baseline", {x: 4, y: 6, fontSize: 10}),
        lineHeight: 10,
      }),
    ]))
    const label = requireCachedText(backend.root.children[0])
    const stencilGeometry = label.stencilGeometry
    const coverGeometry = label.coverGeometry
    const updateGeometry = label.updateGeometry.bind(label)
    let geometryUpdates = 0
    label.updateGeometry = () => {
      geometryUpdates += 1
      updateGeometry()
    }

    expect(label.position).toMatchObject({x: 4, y: -14, z: 0})

    backend.applyFrame(frame(fixture.document, fixture.root, [
      Object.freeze({
        ...text(textNode, "Baseline", {x: 4, y: 6, fontSize: 10}),
        lineHeight: 20,
      }),
    ], 2))

    expect(backend.root.children[0]).toBe(label)
    expect(label.stencilGeometry).toBe(stencilGeometry)
    expect(label.coverGeometry).toBe(coverGeometry)
    expect(label.position).toMatchObject({x: 4, y: -19, z: 0})
    expect(geometryUpdates).toBe(0)
    expect(invalidated).toEqual([])
  })

  test("caches repeated font advances by code point", () => {
    let mapCalls = 0
    let metricCalls = 0
    const font = {
      unitsPerEm: 1_000,
      ascent: 800,
      descent: 200,
      mapCharToGlyph(codePoint: number) {
        mapCalls += 1
        return codePoint
      },
      getHMetric() {
        metricCalls += 1
        return {advanceWidth: 500, lsb: 0}
      },
    } as unknown as TrueTypeFont
    const backend = new RendererWebGpuBackend({font, invalidateGeometry() {}})
    const measurer = backend.textMeasurer
    if (measurer === undefined) throw new Error("Expected font text measurer")

    let measured = 0
    for (let index = 0; index < 1_000; index += 1) {
      measured = measurer.measureTextAdvance("SVG", 10, 0)
    }

    expect(measured).toBe(15)
    expect(mapCalls).toBe(3)
    expect(metricCalls).toBe(3)
  })

  test("keeps Text and Image geometry/material identity for transform-only frames", () => {
    const fixture = renderFixture()
    const textNode = fixture.document.createTextNode("Stable")
    const imageNode = fixture.document.createElement("img")
    fixture.root.append(textNode, imageNode)
    const backend = new RendererWebGpuBackend({
      font: fakeFont(),
      invalidateGeometry() {},
      requestPresentation() {},
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [
      text(textNode, "Stable"),
      image(imageNode, "/assets/stable.png"),
    ]))
    const label = requireCachedText(backend.root.children[0])
    const labelMaterial = label.material
    const stencilGeometry = label.stencilGeometry
    const coverGeometry = label.coverGeometry
    const imageMesh = requireMesh(backend.root.children[1])
    const imageGeometry = imageMesh.geometry
    const imageMaterial = requireImageMaterial(imageMesh)

    backend.applyFrame(frame(fixture.document, fixture.root, [
      text(textNode, "Stable", {
        transform: {scaleX: 1.5, scaleY: 0.75, translateX: 8, translateY: 4},
      }),
      image(imageNode, "/assets/stable.png", {
        transform: {scaleX: 0.5, scaleY: 2, translateX: 20, translateY: 10},
      }),
    ], 2))

    expect(backend.root.children[0]).toBe(label)
    expect(label.material).toBe(labelMaterial)
    expect(label.stencilGeometry).toBe(stencilGeometry)
    expect(label.coverGeometry).toBe(coverGeometry)
    expect(label.scale).toMatchObject({x: 1.5, y: 0.75})
    expect(backend.root.children[1]).toBe(imageMesh)
    expect(imageMesh.geometry).toBe(imageGeometry)
    expect(requireImageMaterial(imageMesh)).toBe(imageMaterial)
    expect(imageMesh.scale).toMatchObject({x: 0.5, y: 2})
    expect(imageGeometry.attributes.position?.needsUpdate).toBeFalse()
  })

  test("updates one retained Image mesh, geometry and material in place", () => {
    const fixture = renderFixture()
    const imageNode = fixture.document.createElement("img")
    fixture.root.appendChild(imageNode)
    const invalidated: BufferGeometry[] = []
    let presentations = 0
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
      requestPresentation: () => { presentations += 1 },
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [
      image(imageNode, "/assets/first.png", {x: 10, y: 20, width: 80, height: 40}),
    ]))
    const mesh = requireMesh(backend.root.children[0])
    const geometry = mesh.geometry
    const material = requireImageMaterial(mesh)
    const firstTextureCallback = material.onTextureChange

    expect(mesh.name).toBe("IMG:image")
    expect(geometry).toBeInstanceOf(PlaneGeometry)
    expect(mesh.position).toMatchObject({x: 50, y: -40, z: 0})
    expect(material).toMatchObject({
      src: "/assets/first.png",
      fit: "cover",
      boxAspect: 2,
      opacity: 1,
    })
    firstTextureCallback?.()
    expect(presentations).toBe(1)

    backend.applyFrame(frame(fixture.document, fixture.root, [
      image(imageNode, "/assets/second.png", {
        x: 7,
        y: 8,
        width: 30,
        height: 60,
        fit: "contain",
        opacity: 0.4,
        clips: [renderClip({x: 5, y: 6, width: 20, height: 30})],
      }),
    ], 2))

    expect(backend.root.children[0]).toBe(mesh)
    expect(mesh.geometry).toBe(geometry)
    expect(requireImageMaterial(mesh)).toBe(material)
    expect(mesh.position).toMatchObject({x: 22, y: -38, z: 0})
    expect(Array.from(geometry.attributes.position?.array ?? [])).toEqual([
      -15, 30, 0,
      15, 30, 0,
      -15, -30, 0,
      15, -30, 0,
    ])
    expect(material).toMatchObject({
      src: "/assets/second.png",
      fit: "contain",
      boxAspect: 0.5,
      opacity: 0.4,
    })
    expect(mesh.presentationClips.map(clipGeometry)).toEqual([{
      kind: "rounded-rect",
      center: [15, -21],
      halfSize: [10, 15],
      radii: [0, 0, 0, 0],
    }])

    firstTextureCallback?.()
    expect(presentations).toBe(1)
    const secondTextureCallback = material.onTextureChange
    secondTextureCallback?.()
    expect(presentations).toBe(2)

    backend.applyFrame(frame(fixture.document, fixture.root, [], 3))
    expect(mesh.parent).toBeNull()
    expect(material.onTextureChange).toBeUndefined()
    expect(invalidated).toEqual([geometry])
    secondTextureCallback?.()
    expect(presentations).toBe(2)
  })

  test("rejects unpresentable Image items before retained mutation", () => {
    const fixture = renderFixture()
    const imageNode = fixture.document.createElement("img")
    const withoutPresentation = new RendererWebGpuBackend({invalidateGeometry() {}})
    withoutPresentation.applyFrame(frame(fixture.document, fixture.root, [rect(fixture.root)]))
    const stable = requireObject(withoutPresentation.root.children[0])
    expect(() => withoutPresentation.applyFrame(frame(fixture.document, fixture.root, [
      image(imageNode, "/assets/image.png"),
    ], 2))).toThrow("requires RendererWebGpuBackendOptions.requestPresentation")
    expect(withoutPresentation.root.children).toEqual([stable])

    const backend = new RendererWebGpuBackend({
      invalidateGeometry() {},
      requestPresentation() {},
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [rect(fixture.root)]))
    const retained = requireObject(backend.root.children[0])
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      image(imageNode, ""),
    ], 2))).toThrow("src must be a non-empty string")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      image(imageNode, "/assets/image.png", {width: 0}),
    ], 3))).toThrow("width must be positive")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      image(imageNode, "/assets/image.png", {fit: "fill" as "cover"}),
    ], 4))).toThrow("fit must be cover or contain")
    expect(backend.root.children).toEqual([retained])
  })

  test("maps full and partial logical clips into backend-root Engine shapes", () => {
    const fixture = renderFixture()
    const textNode = fixture.document.createTextNode("Clipped")
    fixture.root.appendChild(textNode)
    const backend = new RendererWebGpuBackend({font: fakeFont(), invalidateGeometry() {}})
    const full = renderClip({
      x: 10,
      y: 20,
      width: 40,
      height: 60,
      radii: clipRadii(8, 6, 4, 2),
    })
    const xOnly = renderClip({x: 12, y: 999, width: 20, height: 1, clipY: false})
    const yOnly = renderClip({x: 999, y: 30, width: 1, height: 40, clipX: false})

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {clips: [full, xOnly, yOnly]}),
      text(textNode, "Clipped", {clips: [full]}),
    ]))

    const mesh = requireMesh(backend.root.children[0])
    const label = requireCachedText(backend.root.children[1])
    expect(mesh.presentationClips.map(clipGeometry)).toEqual([
      {
        kind: "rounded-rect",
        center: [30, -50],
        halfSize: [20, 30],
        radii: [8, 6, 4, 2],
      },
      {
        kind: "rounded-rect",
        center: [22, -240],
        halfSize: [10, 240],
        radii: [0, 0, 0, 0],
      },
      {
        kind: "rounded-rect",
        center: [320, -50],
        halfSize: [320, 20],
        radii: [0, 0, 0, 0],
      },
    ])
    expect(label.presentationClips.map(clipGeometry)).toEqual(
      mesh.presentationClips.slice(0, 1).map(clipGeometry),
    )
    expect(mesh.presentationClips.every(({coordinateSpace}) =>
      coordinateSpace !== backend.root && coordinateSpace.name.endsWith(":clip-space")
    )).toBeTrue()
  })

  test("retains clip coordinate spaces while updating axis-aligned transform matrices", () => {
    const fixture = renderFixture()
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        clips: [renderClip({
          transform: {scaleX: 2, scaleY: 0.5, translateX: 10, translateY: 20},
        })],
      }),
    ]))
    const mesh = requireMesh(backend.root.children[0])
    const coordinateSpace = mesh.presentationClips[0]!.coordinateSpace
    backend.root.updateWorldMatrix()
    expect(Array.from(coordinateSpace.matrixWorld.elements)).toEqual([
      2, 0, 0, 0,
      0, 0.5, 0, 0,
      0, 0, 1, 0,
      10, -20, 0, 1,
    ])

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        clips: [renderClip({
          transform: {scaleX: -1, scaleY: 3, translateX: 40, translateY: -5},
        })],
      }),
    ], 2))
    expect(mesh.presentationClips[0]!.coordinateSpace).toBe(coordinateSpace)
    expect(Array.from(coordinateSpace.matrixWorld.elements)).toEqual([
      -1, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 1, 0,
      40, 5, 0, 1,
    ])
  })

  test("updates and clears clips without replacing retained objects or resources", () => {
    const fixture = renderFixture()
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {clips: [renderClip()]}),
    ]))
    const mesh = requireMesh(backend.root.children[0])
    const geometry = mesh.geometry
    const material = requireRoundedMaterial(mesh)
    const previousClips = mesh.presentationClips

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {color: "#ff0000", clips: []}),
    ], 2))

    expect(backend.root.children[0]).toBe(mesh)
    expect(mesh.geometry).toBe(geometry)
    expect(requireRoundedMaterial(mesh)).toBe(material)
    expect(mesh.presentationClips).toEqual([])
    expect(mesh.presentationClips).not.toBe(previousClips)
  })

  test("rejects unsupported or malformed clip chains before any retained mutation", () => {
    const fixture = renderFixture()
    const sibling = fixture.document.createElement("div")
    fixture.root.appendChild(sibling)
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root),
      rect(sibling),
    ]))
    const stable = requireMesh(backend.root.children[0])
    const stableMaterial = requireRoundedMaterial(stable)

    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {color: "#ff0000", clips: [renderClip({x: 5})]}),
      rect(sibling, {
        clips: [renderClip({radii: ellipticalClipRadii(8, 4)})],
      }),
    ], 2))).toThrow("elliptical")
    expect(backend.root.children[0]).toBe(stable)
    expect(stableMaterial.fill).toMatchObject({r: 1, g: 1, b: 1, a: 1})
    expect(stable.presentationClips).toEqual([])

    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {clips: [renderClip({clipX: false, clipY: false})]}),
    ], 3))).toThrow("must clip at least one axis")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        clips: [renderClip({clipY: false, radii: clipRadii(1, 0, 0, 0)})],
      }),
    ], 4))).toThrow("partial-axis clip")
    expect(backend.root.children).toHaveLength(2)
  })

  test("replaces an item when its kind changes and invalidates the old Rect", () => {
    const fixture = renderFixture()
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      font: fakeFont(),
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [rect(fixture.root)]))
    const old = requireMesh(backend.root.children[0])

    backend.applyFrame(frame(fixture.document, fixture.root, [text(fixture.root, "42")], 2))

    expect(backend.root.children).toHaveLength(1)
    expect(backend.root.children[0]).toBeInstanceOf(CachedText)
    expect(backend.root.children[0]).not.toBe(old)
    expect(old.parent).toBeNull()
    expect(invalidated).toEqual([old.geometry])
  })

  test("fails closed before mutating the tree when Text has no font", () => {
    const fixture = renderFixture()
    const textNode = fixture.document.createTextNode("Text")
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, [rect(fixture.root)]))
    const stable = requireObject(backend.root.children[0])

    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [text(textNode, "Text")], 2)))
      .toThrow("requires RendererWebGpuBackendOptions.font")
    expect(backend.root.children).toEqual([stable])
  })

  test("rejects duplicate semantic identity before retained updates", () => {
    const fixture = renderFixture()
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, [rect(fixture.root)]))
    const stable = requireObject(backend.root.children[0])

    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root),
      rect(fixture.root),
    ], 2))).toThrow("Duplicate display item identity at index 1")
    expect(backend.root.children).toEqual([stable])
  })

  test("retains non-uniform rectangular widths and rejects unsupported border combinations", () => {
    const fixture = renderFixture()
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, [rect(fixture.root)]))
    const stable = requireMesh(backend.root.children[0])
    const material = requireRoundedMaterial(stable)

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        border: {
          widths: {top: 1, right: 2, bottom: 1, left: 2},
          colors: {top: "#fff", right: "#fff", bottom: "#fff", left: "#fff"},
          radii: {topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0},
        },
      }),
    ], 2))
    expect(backend.root.children).toEqual([stable])
    expect(requireRoundedMaterial(stable)).toBe(material)
    expect(material.borderWidths).toEqual([1, 2, 1, 2])
    expect(Number.isNaN(material.borderWidth)).toBeTrue()

    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        border: {
          widths: {top: 1, right: 2, bottom: 1, left: 2},
          colors: {top: "#fff", right: "#fff", bottom: "#fff", left: "#fff"},
          radii: {topLeft: 1, topRight: 1, bottomRight: 1, bottomLeft: 1},
        },
      }),
    ], 3))).toThrow("non-uniform border widths with non-zero corner radii")
    expect(material.borderWidths).toEqual([1, 2, 1, 2])

    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        border: uniformBorder(1, ["#fff", "#000", "#fff", "#fff"]),
      }),
    ], 4))).toThrow("non-uniform border colors")
    expect(backend.root.children).toEqual([stable])
    expect(material.borderWidths).toEqual([1, 2, 1, 2])
  })

  test("rejects invalid effective opacity and border geometry before mutation", () => {
    const fixture = renderFixture()
    const backend = new RendererWebGpuBackend({font: fakeFont(), invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, [rect(fixture.root)]))
    const stable = requireObject(backend.root.children[0])

    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {opacity: 1.1}),
    ], 2))).toThrow("opacity must be between 0 and 1")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {border: uniformBorder(-1)}),
    ], 3))).toThrow("border.widths.top must be non-negative")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      text(fixture.root, "invalid", {opacity: Number.NaN}),
    ], 4))).toThrow("opacity must be finite")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      text(fixture.root, "invalid", {letterSpacing: Number.NaN}),
    ], 5))).toThrow("letterSpacing must be finite")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      text(fixture.root, "invalid", {lineHeight: -1}),
    ], 6))).toThrow("lineHeight must be non-negative")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      text(fixture.root, "invalid", {
        x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        fontSize: Number.MAX_VALUE,
        lineHeight: Number.MAX_VALUE,
      }),
    ], 7))).toThrow("baselineY must be finite")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        transform: {scaleX: Number.NaN, scaleY: 1, translateX: 0, translateY: 0},
      }),
    ], 8))).toThrow("transform.scaleX must be finite")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(fixture.root, {
        shadow: {blurRadius: -1, spreadRadius: 0},
      }),
    ], 9))).toThrow("shadow.blurRadius must be non-negative")
    expect(backend.root.children).toEqual([stable])
  })

  test("collapses 10k pairwise-disjoint Rects into one real retained draw owner", () => {
    const fixture = renderFixture()
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    const items = Array.from({length: 10_000}, (_, index) => {
      const node = fixture.document.createElement("div")
      return rect(node, {
        x: (index % 100) * 12,
        y: Math.floor(index / 100) * 12,
        width: 10,
        height: 10,
      })
    })

    backend.applyFrame(frame(fixture.document, fixture.root, items))

    expect(backend.root.children).toHaveLength(1)
    const batch = requireInstancedRoundedRect(backend.root.children[0])
    expect(batch).toMatchObject({firstInstance: 0, count: 10_000})
    expect(batch.layer.instances.count).toBe(10_000)
    expect(batch.layer.instances.capacity).toBe(16_384)
    expect(backend.diagnostics).toMatchObject({
      rectScalarDraws: 0,
      rectInstancedDraws: 1,
      rectInstancedInstances: 10_000,
      rectActiveSlots: 10_000,
      pendingRecordUploadBytes: 16_384 * ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH,
      pendingOrderUploadBytes: 16_384 * Uint32Array.BYTES_PER_ELEMENT,
    })

    backend.dispose()
    expect(invalidated).toEqual([batch.geometry])
  })

  test("reuses a validated batch plan and prepares only changed Rect references", () => {
    const fixture = renderFixture()
    const nodes = [0, 1, 2].map(() => fixture.document.createElement("div"))
    const initial = [
      rect(nodes[0]!, {x: 0, color: "#112233"}),
      rect(nodes[1]!, {x: 20, color: "#445566"}),
      rect(nodes[2]!, {x: 40, color: "#778899"}),
    ]
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, initial))
    const batch = requireInstancedRoundedRect(backend.root.children[0])
    const layer = batch.layer.instances
    const middleHandle = layer.handleAt(1)
    layer.recordAttribute.clearUpdateRanges()
    layer.orderAttribute.clearUpdateRanges()

    const changed = [...initial]
    changed[1] = rect(nodes[1]!, {
      x: 20,
      color: "rgba(10 20 30 / 50%)",
      opacity: 0.75,
      border: uniformBorder(2, "#abcdef", {
        topLeft: 4,
        topRight: 3,
        bottomRight: 2,
        bottomLeft: 1,
      }),
    })
    backend.applyFrame(frame(fixture.document, fixture.root, changed, 2))

    expect(backend.root.children).toEqual([batch])
    expect(layer.handleAt(1)).toBe(middleHandle)
    expect(backend.diagnostics).toMatchObject({
      revision: 2,
      rectPlanReused: true,
      rectPreparedItems: 1,
      pendingRecordUploadBytes: ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH,
      pendingOrderUploadBytes: 0,
    })

    const record = instanceRecord(layer.readRecord(middleHandle))
    const scalar = new RendererWebGpuBackend({
      rectInstancing: "disabled",
      invalidateGeometry() {},
    })
    scalar.applyFrame(frame(fixture.document, fixture.root, changed))
    const scalarMaterial = requireRoundedMaterial(requireMesh(scalar.root.children[1]))
    expect(Array.from(record.slice(
      ROUNDED_RECT_INSTANCE_OFFSETS.fill,
      ROUNDED_RECT_INSTANCE_OFFSETS.fill + 4,
    ))).toEqual([
      Math.fround(scalarMaterial.fill.r),
      Math.fround(scalarMaterial.fill.g),
      Math.fround(scalarMaterial.fill.b),
      Math.fround(scalarMaterial.fill.a),
    ])
    expect(Array.from(record.slice(
      ROUNDED_RECT_INSTANCE_OFFSETS.border,
      ROUNDED_RECT_INSTANCE_OFFSETS.border + 4,
    ))).toEqual([
      Math.fround(scalarMaterial.border.r),
      Math.fround(scalarMaterial.border.g),
      Math.fround(scalarMaterial.border.b),
      Math.fround(scalarMaterial.border.a),
    ])
    expect(Array.from(record.slice(
      ROUNDED_RECT_INSTANCE_OFFSETS.radii,
      ROUNDED_RECT_INSTANCE_OFFSETS.radii + 4,
    ))).toEqual(Array.from(scalarMaterial.radii))
    expect(Array.from(record.slice(
      ROUNDED_RECT_INSTANCE_OFFSETS.borderWidths,
      ROUNDED_RECT_INSTANCE_OFFSETS.borderWidths + 4,
    ))).toEqual(Array.from(scalarMaterial.borderWidths))
    expect(record[ROUNDED_RECT_INSTANCE_OFFSETS.params]).toBe(scalarMaterial.opacity)

    layer.recordAttribute.clearUpdateRanges()
    backend.applyFrame(frame(fixture.document, fixture.root, changed, 3))
    expect(backend.diagnostics).toMatchObject({
      rectPlanReused: true,
      rectPreparedItems: 0,
      pendingRecordUploadBytes: 0,
    })

    layer.recordAttribute.addUpdateRange(0, 1)
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, changed, 4)))
      .toThrow("instance storage changed outside")
  })

  test("falls back to full planning on reorder, geometry, clip, overlap and compatibility changes", () => {
    const cases = [
      {
        name: "reorder",
        change(items: readonly Extract<DisplayItem, {kind: "rect"}>[]) {
          return [items[2]!, items[0]!, items[1]!]
        },
      },
      {
        name: "geometry",
        change(items: readonly Extract<DisplayItem, {kind: "rect"}>[]) {
          return [items[0]!, rect(items[1]!.node, {x: 21}), items[2]!]
        },
      },
      {
        name: "clip",
        change(items: readonly Extract<DisplayItem, {kind: "rect"}>[]) {
          return [items[0]!, rect(items[1]!.node, {x: 20, clips: [renderClip({x: 20})]}), items[2]!]
        },
      },
      {
        name: "overlap",
        change(items: readonly Extract<DisplayItem, {kind: "rect"}>[]) {
          return [items[0]!, rect(items[1]!.node, {x: 5}), items[2]!]
        },
      },
      {
        name: "compatibility",
        change(items: readonly Extract<DisplayItem, {kind: "rect"}>[]) {
          return [
            items[0]!,
            rect(items[1]!.node, {
              x: 20,
              transform: {scaleX: 0, scaleY: 1, translateX: 0, translateY: 0},
            }),
            items[2]!,
          ]
        },
      },
    ] as const

    for (const scenario of cases) {
      const fixture = renderFixture()
      const nodes = [0, 1, 2].map(() => fixture.document.createElement("div"))
      const initial = [
        rect(nodes[0]!, {x: 0}),
        rect(nodes[1]!, {x: 20}),
        rect(nodes[2]!, {x: 40}),
      ]
      const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
      backend.applyFrame(frame(fixture.document, fixture.root, initial))

      backend.applyFrame(frame(
        fixture.document,
        fixture.root,
        scenario.change(initial),
        2,
      ))

      expect(backend.diagnostics.rectPlanReused, scenario.name).toBeFalse()
      expect(backend.diagnostics.rectPreparedItems, scenario.name).toBe(3)
    }
  })

  test("validates fast-path payloads and frame ownership before retained mutation", () => {
    const fixture = renderFixture()
    const nodes = [0, 1, 2].map(() => fixture.document.createElement("div"))
    const items = [
      rect(nodes[0]!, {x: 0}),
      rect(nodes[1]!, {x: 20}),
      rect(nodes[2]!, {x: 40}),
    ]
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, items))
    const batch = requireInstancedRoundedRect(backend.root.children[0])
    const layer = batch.layer.instances
    const middleHandle = layer.handleAt(1)
    const before = Array.from(layer.readRecord(middleHandle))
    layer.recordAttribute.clearUpdateRanges()

    const invalid = [...items]
    invalid[1] = rect(nodes[1]!, {x: 20, color: "not-a-color"})
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, invalid, 2)))
      .toThrow("Unsupported resolved display color")
    expect(backend.root.children).toEqual([batch])
    expect(Array.from(layer.readRecord(middleHandle))).toEqual(before)
    expect(layer.recordAttribute.needsUpdate).toBeFalse()
    expect(backend.diagnostics.revision).toBe(1)

    const other = renderFixture()
    expect(() => backend.applyFrame(frame(other.document, other.root, [], 2)))
      .toThrow("another Document")
    const otherRoot = fixture.document.createElement("section")
    fixture.root.appendChild(otherRoot)
    expect(() => backend.applyFrame(frame(fixture.document, otherRoot, [], 2)))
      .toThrow("another root")
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, items, 0)))
      .toThrow("precedes applied revision")
    expect(() => backend.applyFrame(Object.freeze({
      ...frame(fixture.document, fixture.root, items, 2),
      revision: 1.5,
    }))).toThrow("non-negative safe integer")

    const recovered = [...items]
    recovered[1] = rect(nodes[1]!, {x: 20, color: "#ff8000"})
    backend.applyFrame(frame(fixture.document, fixture.root, recovered, 3))
    expect(backend.diagnostics).toMatchObject({
      revision: 3,
      rectPlanReused: true,
      rectPreparedItems: 1,
      pendingRecordUploadBytes: ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH,
    })
  })

  test("keeps token slots stable through update, insert, delete and reorder", () => {
    const fixture = renderFixture()
    const nodes = [0, 1, 2, 3].map(() => fixture.document.createElement("div"))
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(nodes[0]!, {x: 0, color: "#ff0000"}),
      rect(nodes[1]!, {x: 20, color: "#00ff00"}),
      rect(nodes[2]!, {x: 40, color: "#0000ff"}),
    ]))
    const batch = requireInstancedRoundedRect(backend.root.children[0])
    const layer = batch.layer.instances
    const first = layer.handleAt(0)
    const second = layer.handleAt(1)
    const third = layer.handleAt(2)
    layer.recordAttribute.clearUpdateRanges()
    layer.orderAttribute.clearUpdateRanges()

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(nodes[2]!, {x: 40, color: "#0000ff"}),
      rect(nodes[0]!, {x: 0, color: "#ffffff"}),
      rect(nodes[1]!, {x: 20, color: "#00ff00"}),
    ], 2))

    expect(layer.handleAt(0)).toBe(third)
    expect(layer.handleAt(1)).toBe(first)
    expect(layer.handleAt(2)).toBe(second)
    expect(layer.recordAttribute.updateRanges).toEqual([{
      offset: first.slot * ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH,
      count: ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH,
    }])
    expect(layer.orderAttribute.updateRanges).toEqual([{offset: 0, count: 3}])
    expect(backend.diagnostics).toMatchObject({
      pendingRecordUploadBytes: ROUNDED_RECT_INSTANCE_RECORD_BYTE_LENGTH,
      pendingOrderUploadBytes: 3 * Uint32Array.BYTES_PER_ELEMENT,
    })

    layer.recordAttribute.clearUpdateRanges()
    layer.orderAttribute.clearUpdateRanges()
    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(nodes[2]!, {x: 40, color: "#0000ff"}),
      rect(nodes[3]!, {x: 60, color: "#ffff00"}),
      rect(nodes[0]!, {x: 0, color: "#ffffff"}),
    ], 3))

    expect(layer.handleAt(0)).toBe(third)
    expect(layer.handleAt(2)).toBe(first)
    expect(layer.has(second)).toBeFalse()
    expect(layer.handleAt(1).slot).toBe(second.slot)
    expect(layer.handleAt(1).generation).toBe(second.generation + 1)
  })

  test("breaks runs at text, clips and overlap while disabled mode stays scalar", () => {
    const fixture = renderFixture()
    const nodes = Array.from({length: 7}, () => fixture.document.createElement("div"))
    const textNode = fixture.document.createTextNode("barrier")
    const backend = new RendererWebGpuBackend({font: fakeFont(), invalidateGeometry() {}})
    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(nodes[0]!, {x: 0}),
      rect(nodes[1]!, {x: 20}),
      text(textNode, "barrier"),
      rect(nodes[2]!, {x: 40}),
      rect(nodes[3]!, {x: 60}),
      rect(nodes[4]!, {x: 80, clips: [renderClip({x: 80})]}),
      rect(nodes[5]!, {x: 100, width: 20}),
      rect(nodes[6]!, {x: 110, width: 20}),
    ]))

    expect(backend.root.children.map((child) => child.constructor.name)).toEqual([
      "InstancedRoundedRect",
      "CachedText",
      "InstancedRoundedRect",
      "Mesh",
      "Mesh",
      "Mesh",
    ])
    expect(backend.diagnostics).toMatchObject({
      rectScalarDraws: 3,
      rectInstancedDraws: 2,
      rectInstancedInstances: 4,
    })

    const disabled = new RendererWebGpuBackend({
      rectInstancing: "disabled",
      invalidateGeometry() {},
    })
    disabled.applyFrame(frame(fixture.document, fixture.root, [
      rect(nodes[0]!, {x: 0}),
      rect(nodes[1]!, {x: 20}),
    ]))
    expect(disabled.root.children.every((child) => child instanceof Mesh)).toBeTrue()
    expect(disabled.diagnostics).toMatchObject({
      rectScalarDraws: 2,
      rectInstancedDraws: 0,
      rectActiveSlots: 0,
    })
  })

  test("falls back at the explicit slot and spatial-index policy bounds", () => {
    const fixture = renderFixture()
    const nodes = Array.from({length: 4}, () => fixture.document.createElement("div"))
    const backend = new RendererWebGpuBackend({
      maxRectInstances: 2,
      invalidateGeometry() {},
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(nodes[0]!, {x: 0}),
      rect(nodes[1]!, {x: 20}),
      rect(nodes[2]!, {x: 40}),
    ]))
    expect(backend.root.children.map((child) => child.constructor.name)).toEqual([
      "InstancedRoundedRect",
      "Mesh",
    ])
    expect(backend.diagnostics).toMatchObject({rectActiveSlots: 2, rectScalarDraws: 1})

    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(nodes[0]!, {x: 0, width: 1_000_000, height: 1_000_000}),
      rect(nodes[3]!, {x: 2_000_000}),
    ], 2))
    expect(backend.root.children.every((child) => child instanceof Mesh)).toBeTrue()
    expect(backend.diagnostics.rectInstancedDraws).toBe(0)
  })

  test("packs shadows and negative transforms in DPR-independent logical values", () => {
    const fixture = renderFixture()
    const nodes = [fixture.document.createElement("div"), fixture.document.createElement("div")]
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    const items = [
      rect(nodes[0]!, {
        x: 100,
        y: 40,
        width: 20,
        height: 10,
        color: "rgba(10 20 30 / 50%)",
        shadow: {blurRadius: 3, spreadRadius: 2},
        transform: {scaleX: -2, scaleY: 0.5, translateX: 400, translateY: 7},
      }),
      rect(nodes[1]!, {x: 300, y: 100}),
    ]
    backend.applyFrame(frame(fixture.document, fixture.root, items))
    const batch = requireInstancedRoundedRect(backend.root.children[0])
    const first = batch.layer.instances.handleAt(0)
    const bytes = batch.layer.instances.readRecord(first)
    const record = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)

    expect(Array.from(record.slice(
      ROUNDED_RECT_INSTANCE_OFFSETS.rect,
      ROUNDED_RECT_INSTANCE_OFFSETS.rect + 4,
    ))).toEqual([100, 40, 20, 10])
    expect(Array.from(record.slice(
      ROUNDED_RECT_INSTANCE_OFFSETS.transform,
      ROUNDED_RECT_INSTANCE_OFFSETS.transform + 4,
    ))).toEqual([-2, 0.5, 400, 7])
    expect(Array.from(record.slice(
      ROUNDED_RECT_INSTANCE_OFFSETS.params,
      ROUNDED_RECT_INSTANCE_OFFSETS.params + 4,
    ))).toEqual([1, 3, 2, 0])

    batch.layer.instances.recordAttribute.clearUpdateRanges()
    batch.layer.instances.orderAttribute.clearUpdateRanges()
    const highDensityFrame = Object.freeze({
      ...frame(fixture.document, fixture.root, items, 2),
      viewport: Object.freeze({width: 1280, height: 960}),
    })
    backend.applyFrame(highDensityFrame)
    expect(batch.layer.instances.recordAttribute.needsUpdate).toBeFalse()
    expect(batch.layer.instances.orderAttribute.needsUpdate).toBeFalse()
  })

  test("disposes owned resources exactly once and rejects later frames", () => {
    const fixture = renderFixture()
    const aNode = fixture.document.createElement("div")
    const bNode = fixture.document.createElement("div")
    const imageNode = fixture.document.createElement("img")
    const invalidated: BufferGeometry[] = []
    let presentations = 0
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
      requestPresentation: () => { presentations += 1 },
    })
    backend.applyFrame(frame(fixture.document, fixture.root, [
      rect(aNode, {clips: [renderClip()]}),
      rect(bNode),
      image(imageNode, "/assets/disposed.png"),
    ]))
    const meshes = backend.root.children.map((child) => requireMesh(child))
    const geometries = meshes.map(({geometry}) => geometry)
    const textureCallback = requireImageMaterial(meshes[2]!).onTextureChange

    backend.dispose()
    backend.dispose()

    expect(backend.root.children).toEqual([])
    expect(geometries).toHaveLength(3)
    expect(meshes.every(({presentationClips}) => presentationClips.length === 0)).toBeTrue()
    expect(invalidated).toEqual(geometries)
    textureCallback?.()
    expect(presentations).toBe(0)
    expect(() => backend.applyFrame(frame(fixture.document, fixture.root, [])))
      .toThrow("RendererWebGpuBackend is disposed")
  })

  test("bulk-detaches dense retained children without per-entry root removal", () => {
    const fixture = renderFixture()
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    const items = Array.from({length: 512}, (_, index) => {
      const node = fixture.document.createElement("div")
      return rect(node, {x: index % 2, y: index % 2, width: 20, height: 20})
    })
    backend.applyFrame(frame(fixture.document, fixture.root, items))
    const retained = [...backend.root.children]
    expect(retained).toHaveLength(512)
    let removeCalls = 0
    const remove = backend.root.remove.bind(backend.root)
    backend.root.remove = (child) => {
      removeCalls += 1
      remove(child)
    }

    backend.dispose()

    expect(removeCalls).toBe(0)
    expect(backend.root.children).toEqual([])
    expect(retained.every(child => child.parent === null)).toBeTrue()
  })
})

const IDENTITY_TRANSFORM = Object.freeze({
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
})

function renderFixture() {
  const document = createDocument()
  const root = document.createElement("div")
  document.appendChild(root)
  return {document, root}
}

function frame(
  document: RenderFrame["document"],
  root: Node,
  displayList: readonly DisplayItem[],
  revision = 1,
): RenderFrame {
  return Object.freeze({
    revision,
    document,
    root,
    viewport: Object.freeze({width: 640, height: 480}),
    boxes: Object.freeze([]),
    boxByNode: new Map(),
    displayList: Object.freeze([...displayList]),
    hits: new Map(),
    scrolls: new Map(),
  })
}

function rect(
  node: Extract<DisplayItem, {kind: "rect"}>["node"],
  values: Partial<Omit<Extract<DisplayItem, {kind: "rect"}>, "node" | "kind">> = {},
): Extract<DisplayItem, {kind: "rect"}> {
  return Object.freeze({
    node,
    kind: "rect",
    key: "rect",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    color: "#ffffff",
    opacity: 1,
    border: uniformBorder(),
    clips: Object.freeze([]),
    ...values,
    shadow: values.shadow ?? null,
    transform: values.transform ?? IDENTITY_TRANSFORM,
  })
}

function text(
  node: Extract<DisplayItem, {kind: "text"}>["node"],
  value: string,
  values: Partial<Omit<Extract<DisplayItem, {kind: "text"}>, "node" | "kind" | "text">> = {},
): Extract<DisplayItem, {kind: "text"}> {
  return Object.freeze({
    node,
    kind: "text",
    key: "text",
    x: 0,
    y: 0,
    color: "#ffffff",
    text: value,
    fontSize: 14,
    lineHeight: values.lineHeight ?? values.fontSize ?? 14,
    opacity: 1,
    clips: Object.freeze([]),
    ...values,
    letterSpacing: values.letterSpacing ?? 0,
    transform: values.transform ?? IDENTITY_TRANSFORM,
  })
}

function image(
  node: Extract<DisplayItem, {kind: "image"}>["node"],
  src: string,
  values: Partial<Omit<Extract<DisplayItem, {kind: "image"}>, "node" | "kind" | "src">> = {},
): Extract<DisplayItem, {kind: "image"}> {
  return Object.freeze({
    node,
    kind: "image",
    key: "image",
    src,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    fit: "cover",
    opacity: 1,
    clips: Object.freeze([]),
    ...values,
    transform: values.transform ?? IDENTITY_TRANSFORM,
  })
}

function requireMesh(value: Object3D | undefined): Mesh {
  if (!(value instanceof Mesh)) throw new Error("Expected Engine Mesh")
  return value
}

function requireObject(value: Object3D | undefined): Object3D {
  if (value === undefined) throw new Error("Expected Engine Object3D")
  return value
}

function requireCachedText(value: Object3D | undefined): CachedText {
  if (!(value instanceof CachedText)) throw new Error("Expected Engine CachedText")
  return value
}

function requireInstancedRoundedRect(value: Object3D | undefined): InstancedRoundedRect {
  if (!(value instanceof InstancedRoundedRect)) throw new Error("Expected InstancedRoundedRect")
  return value
}

function instanceRecord(bytes: Uint8Array): Float32Array {
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Float32Array.BYTES_PER_ELEMENT)
}

function requireRoundedMaterial(mesh: Mesh): RoundedRectMaterial {
  if (Array.isArray(mesh.material)) throw new Error("Expected one Engine material")
  if (!(mesh.material instanceof RoundedRectMaterial)) throw new Error("Expected RoundedRectMaterial")
  return mesh.material
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

function uniformBorder(
  width = 0,
  colors: string | readonly [string, string, string, string] = "#000000",
  radii: Partial<Readonly<{
    topLeft: number
    topRight: number
    bottomRight: number
    bottomLeft: number
  }>> = {},
): Extract<DisplayItem, {kind: "rect"}>["border"] {
  const [top, right, bottom, left] = typeof colors === "string"
    ? [colors, colors, colors, colors]
    : colors
  return Object.freeze({
    widths: Object.freeze({top: width, right: width, bottom: width, left: width}),
    colors: Object.freeze({top, right, bottom, left}),
    radii: Object.freeze({
      topLeft: radii.topLeft ?? 0,
      topRight: radii.topRight ?? 0,
      bottomRight: radii.bottomRight ?? 0,
      bottomLeft: radii.bottomLeft ?? 0,
    }),
  })
}

function renderClip(values: Partial<RenderClip> = {}): RenderClip {
  return Object.freeze({
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    radii: clipRadii(),
    clipX: true,
    clipY: true,
    ...values,
    transform: values.transform ?? IDENTITY_TRANSFORM,
  })
}

function clipRadii(
  topLeft = 0,
  topRight = topLeft,
  bottomRight = topLeft,
  bottomLeft = topRight,
): RenderClip["radii"] {
  const radius = (value: number) => Object.freeze({x: value, y: value})
  return Object.freeze({
    topLeft: radius(topLeft),
    topRight: radius(topRight),
    bottomRight: radius(bottomRight),
    bottomLeft: radius(bottomLeft),
  })
}

function ellipticalClipRadii(x: number, y: number): RenderClip["radii"] {
  const radius = Object.freeze({x, y})
  return Object.freeze({
    topLeft: radius,
    topRight: radius,
    bottomRight: radius,
    bottomLeft: radius,
  })
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
