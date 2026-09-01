import {describe, expect, test} from "bun:test"
import {
  InstancedStrokedPath,
  Mesh,
  MeshBasicMaterial,
  RoundedRectMaterial,
  STROKED_PATH_SEGMENT_RECORD_BYTE_LENGTH,
  STROKED_PATH_STYLE_RECORD_BYTE_LENGTH,
  type BufferGeometry,
} from "@engine/core"
import {createDocument} from "@zavx0z/dom"
import {createDocumentRenderer, type PathDisplayItem, type RenderFrame} from "@zavx0z/renderer"
import {RendererWebGpuBackend} from "../src/index.ts"

describe("RendererWebGpuBackend retained vector paths", () => {
  test("collapses 10k semantic paths into one retained draw and updates one shared transform", () => {
    const count = 10_000
    const fixture = pathFixture(count)
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    const initialFrame = fixture.renderer.flush()
    backend.applyFrame(initialFrame)

    expect(backend.root.children).toHaveLength(1)
    const run = requirePathRun(backend.root.children[0])
    expect(run).toMatchObject({firstInstance: 0, count})
    expect(backend.diagnostics).toMatchObject({
      pathPreparedItems: count,
      pathDraws: 1,
      pathInstancedDraws: 1,
      pathScalarDraws: 0,
      pathStyles: count,
      pathSegments: count,
      pathStyleCapacity: 16_384,
      pathSegmentCapacity: 16_384,
      pathRetainedRecordBytes:
        16_384 * STROKED_PATH_STYLE_RECORD_BYTE_LENGTH +
        16_384 * STROKED_PATH_SEGMENT_RECORD_BYTE_LENGTH +
        16_384 * Uint32Array.BYTES_PER_ELEMENT,
      pathUnitGeometryBytes: 60,
      pendingPathStyleUploadBytes: 16_384 * STROKED_PATH_STYLE_RECORD_BYTE_LENGTH,
      pendingPathSegmentUploadBytes: 16_384 * STROKED_PATH_SEGMENT_RECORD_BYTE_LENGTH,
      pendingPathOrderUploadBytes: 16_384 * Uint32Array.BYTES_PER_ELEMENT,
    })
    run.layer.styles.recordAttribute.clearUpdateRanges()
    run.layer.segments.recordAttribute.clearUpdateRanges()
    run.layer.segments.orderAttribute.clearUpdateRanges()

    const initialItems = [...initialFrame.displayList]
    fixture.root.setAttribute(
      "style",
      "position:relative;width:1000px;height:1000px;transform:translate(12px,18px) scale(1.5);transform-origin:0 0",
    )
    const transformedFrame = fixture.renderer.flush()
    expect(transformedFrame.displayList.every((item, index) => item === initialItems[index])).toBeTrue()
    backend.applyFrame(transformedFrame)

    expect(backend.root.children).toEqual([run])
    expect(run.position).toMatchObject({x: 12, y: -18, z: 0})
    expect(run.scale).toMatchObject({x: 1.5, y: -1.5, z: 1})
    expect(backend.diagnostics).toMatchObject({
      pathPreparedItems: 0,
      pathDraws: 1,
      pendingPathStyleUploadBytes: 0,
      pendingPathSegmentUploadBytes: 0,
      pendingPathOrderUploadBytes: 0,
      pathStyleWriteBytes: 0,
      pathSegmentWriteBytes: 0,
      pathOrderWriteBytes: 0,
    })

    backend.dispose()
    expect(invalidated).toEqual([run.geometry])
  })

  test("uploads only one style or one changed sampled segment", () => {
    const fixture = pathFixture(3)
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(fixture.renderer.flush())
    const run = requirePathRun(backend.root.children[0])
    clearPathUploads(run)

    fixture.paths[1]!.setAttribute(
      "style",
      "stroke:#336699;stroke-width:3.4px;pointer-hit-width:16px;z-index:1",
    )
    backend.applyFrame(fixture.renderer.flush())
    expect(backend.root.children).toEqual([run])
    expect(backend.diagnostics).toMatchObject({
      pendingPathStyleUploadBytes: Float32Array.BYTES_PER_ELEMENT,
      pendingPathSegmentUploadBytes: 0,
      pendingPathOrderUploadBytes: 0,
      pathStyleWriteBytes: Float32Array.BYTES_PER_ELEMENT,
      pathSegmentWriteBytes: 0,
      pathOrderWriteBytes: 0,
    })
    clearPathUploads(run)

    fixture.paths[1]!.d = "M 0 1 L 120 1"
    backend.applyFrame(fixture.renderer.flush())
    expect(backend.root.children).toEqual([run])
    expect(backend.diagnostics).toMatchObject({
      pendingPathStyleUploadBytes: 0,
      pendingPathSegmentUploadBytes: 16,
      pendingPathOrderUploadBytes: 0,
      pathStyleWriteBytes: 0,
      pathSegmentWriteBytes: 16,
      pathOrderWriteBytes: 0,
    })
    clearPathUploads(run)

    const current = fixture.renderer.flush()
    const shifted = current.displayList.map((item) => item.node === fixture.paths[1]
      ? Object.freeze({...item, x: item.x + 25})
      : item
    )
    backend.applyFrame(Object.freeze({
      ...current,
      revision: current.revision + 1,
      displayList: Object.freeze(shifted),
    }))
    expect(backend.diagnostics).toMatchObject({
      pathStyleWriteBytes: 0,
      pathSegmentWriteBytes: 16,
      pathOrderWriteBytes: 0,
    })
  })

  test("keeps Path buffers clean while ordinary mixed-subtree owners update", () => {
    const fixture = pathFixture(1_000)
    const node = fixture.document.createElement("div")
    node.setAttribute(
      "style",
      "position:absolute;left:40px;top:30px;width:80px;height:40px;background:#ff8000;z-index:3",
    )
    fixture.root.appendChild(node)
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(fixture.renderer.flush())
    const run = requirePathRun(backend.root.children[0])
    const mesh = backend.root.children[1]
    clearPathUploads(run)

    fixture.root.setAttribute(
      "style",
      "position:relative;width:1000px;height:1000px;transform:translate(8px,12px) scale(1.25);transform-origin:0 0",
    )
    backend.applyFrame(fixture.renderer.flush())

    expect(backend.root.children[0]).toBe(run)
    expect(backend.root.children[1]).toBe(mesh)
    expect(backend.diagnostics).toMatchObject({
      pathDraws: 1,
      pathStyles: 1_000,
      pendingPathStyleUploadBytes: 0,
      pendingPathSegmentUploadBytes: 0,
      pendingPathOrderUploadBytes: 0,
      pathStyleWriteBytes: 0,
      pathSegmentWriteBytes: 0,
      pathOrderWriteBytes: 0,
    })
  })

  test("reorders 2k selected-last segments with one bounded order range", () => {
    const count = 2_000
    const middle = count / 2
    const fixture = pathFixture(count)
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(fixture.renderer.flush())
    const run = requirePathRun(backend.root.children[0])
    clearPathUploads(run)

    fixture.paths[middle]!.setAttribute(
      "style",
      "stroke:#336699;stroke-width:3.4px;pointer-hit-width:16px;z-index:2",
    )
    backend.applyFrame(fixture.renderer.flush())

    expect(backend.root.children).toEqual([run])
    expect(backend.diagnostics).toMatchObject({
      pendingPathStyleUploadBytes: Float32Array.BYTES_PER_ELEMENT,
      pendingPathSegmentUploadBytes: 0,
      pendingPathOrderUploadBytes: (count - middle) * Uint32Array.BYTES_PER_ELEMENT,
      pathStyleWriteBytes: Float32Array.BYTES_PER_ELEMENT,
      pathSegmentWriteBytes: 0,
      pathOrderWriteBytes: (count - middle) * Uint32Array.BYTES_PER_ELEMENT,
    })
    expect(run.layer.segments.orderAttribute.updateRanges).toEqual([{
      offset: middle,
      count: count - middle,
    }])
  })

  test("switches two selected Paths with variable segment counts in either mutation order", () => {
    const fixture = pathFixture(4)
    fixture.paths[0]!.d = "M 0 0 L 10 0"
    fixture.paths[1]!.d = "M 0 10 L 10 10 L 20 10"
    fixture.paths[2]!.d = "M 0 20 C 10 0 20 40 30 20"
    fixture.paths[3]!.d = "M 0 30 Q 15 0 30 30"
    fixture.paths[0]!.setAttribute(
      "style",
      "stroke:#336699;stroke-width:3.4px;pointer-hit-width:16px;z-index:2",
    )
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(fixture.renderer.flush())
    const run = requirePathRun(backend.root.children[0])
    clearPathUploads(run)

    fixture.paths[0]!.setAttribute(
      "style",
      "stroke:#336699;stroke-width:2.2px;pointer-hit-width:16px;z-index:1",
    )
    fixture.paths[1]!.setAttribute(
      "style",
      "stroke:#336699;stroke-width:3.4px;pointer-hit-width:16px;z-index:2",
    )
    const selectedSecond = fixture.renderer.flush()
    backend.applyFrame(selectedSecond)

    expect(selectedSecond.displayList.filter(({kind}) => kind === "path").map(({node}) => node))
      .toEqual([fixture.paths[0]!, fixture.paths[2]!, fixture.paths[3]!, fixture.paths[1]!])
    expect(backend.root.children).toEqual([run])
    expect(backend.diagnostics).toMatchObject({
      pathPreparedItems: 2,
      pathStyleWriteBytes: 2 * Float32Array.BYTES_PER_ELEMENT,
      pathSegmentWriteBytes: 0,
      pathOrderWriteBytes: 15 * Uint32Array.BYTES_PER_ELEMENT,
    })

    clearPathUploads(run)
    fixture.paths[2]!.setAttribute(
      "style",
      "stroke:#336699;stroke-width:3.4px;pointer-hit-width:16px;z-index:2",
    )
    fixture.paths[1]!.setAttribute(
      "style",
      "stroke:#336699;stroke-width:2.2px;pointer-hit-width:16px;z-index:1",
    )
    const selectedThird = fixture.renderer.flush()
    backend.applyFrame(selectedThird)

    expect(selectedThird.displayList.filter(({kind}) => kind === "path").map(({node}) => node))
      .toEqual([fixture.paths[0]!, fixture.paths[1]!, fixture.paths[3]!, fixture.paths[2]!])
    expect(backend.root.children).toEqual([run])
    expect(backend.diagnostics).toMatchObject({
      pathPreparedItems: 2,
      pathStyleWriteBytes: 2 * Float32Array.BYTES_PER_ELEMENT,
      pathSegmentWriteBytes: 0,
    })
    expect(backend.diagnostics.pathOrderWriteBytes)
      .toBeLessThanOrEqual(15 * Uint32Array.BYTES_PER_ELEMENT)
  })

  test("packs style slot generation after physical-slot reuse", () => {
    const fixture = pathFixture(2)
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(fixture.renderer.flush())
    const run = requirePathRun(backend.root.children[0])
    const released = run.layer.styles.handleAt(0)

    fixture.paths[0]!.remove()
    const replacement = fixture.document.createElement("vector-path")
    replacement.d = "M 0 40 L 100 40"
    replacement.setAttribute("style", "stroke:#336699;stroke-width:2.2px;pointer-hit-width:16px;z-index:1")
    fixture.root.appendChild(replacement)
    backend.applyFrame(fixture.renderer.flush())

    const replacementStyle = run.layer.styles.handleAt(1)
    const replacementSegment = run.layer.segments.handleAt(1)
    const bytes = run.layer.segments.readRecord(replacementSegment)
    const words = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
    expect(run.layer.styles.has(released)).toBeFalse()
    expect(replacementStyle.slot).toBe(released.slot)
    expect(replacementStyle.generation).toBe(released.generation + 1)
    expect(words[4]).toBe(replacementStyle.slot)
    expect(words[5]).toBe(replacementStyle.generation)
    expect(() => run.layer.validatePackedRecords()).not.toThrow()
  })

  test("keeps clip and paint barriers as separate retained run views", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = document.createElement("vector-path")
    const barrier = document.createElement("div")
    const second = document.createElement("vector-path")
    document.appendChild(root)
    root.append(first, barrier, second)
    root.setAttribute("style", "position:relative;width:100px;height:100px;overflow:clip")
    first.d = "M 0 10 L 80 10"
    second.d = "M 0 20 L 80 20"
    first.setAttribute("style", "stroke:#fff;stroke-width:2px")
    second.setAttribute("style", "stroke:#fff;stroke-width:2px")
    barrier.setAttribute("style", "position:absolute;width:5px;height:5px;background:#f00")
    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 100},
    }).flush()
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})

    backend.applyFrame(frame)

    expect(backend.root.children.map((child) => child.constructor.name)).toEqual([
      "InstancedStrokedPath",
      "Mesh",
      "InstancedStrokedPath",
    ])
    expect(backend.diagnostics).toMatchObject({pathDraws: 2, pathStyles: 2, pathSegments: 2})
    expect(requirePathRun(backend.root.children[0]).presentationClips).toHaveLength(1)
    expect(requirePathRun(backend.root.children[2]).presentationClips).toHaveLength(1)
  })

  test("keeps semitransparent paths on one continuous retained scalar fallback", () => {
    const fixture = pathFixture(1)
    fixture.paths[0]!.setAttribute(
      "style",
      "stroke:rgba(51 102 153 / 50%);stroke-width:3px;pointer-hit-width:16px;opacity:0.5",
    )
    const invalidated: BufferGeometry[] = []
    const backend = new RendererWebGpuBackend({
      invalidateGeometry: (geometry) => invalidated.push(geometry),
    })
    backend.applyFrame(fixture.renderer.flush())
    const mesh = backend.root.children[0]
    if (!(mesh instanceof Mesh) || Array.isArray(mesh.material)) throw new Error("Expected scalar Path Mesh")
    if (!(mesh.material instanceof MeshBasicMaterial)) throw new Error("Expected scalar Path material")
    const geometry = mesh.geometry
    const material = mesh.material
    const initialPositions = geometry.attributes.position!.array
    expect(backend.diagnostics).toMatchObject({
      pathDraws: 1,
      pathInstancedDraws: 0,
      pathScalarDraws: 1,
      pathPreparedItems: 1,
      pathStyles: 0,
      pathSegments: 0,
    })
    expect(material.color.a).toBe(0.25)

    fixture.root.setAttribute(
      "style",
      "position:relative;width:1000px;height:1000px;transform:translate(7px,11px) scale(1.5);transform-origin:0 0",
    )
    backend.applyFrame(fixture.renderer.flush())
    expect(backend.root.children[0]).toBe(mesh)
    expect(mesh.geometry).toBe(geometry)
    expect(mesh.material).toBe(material)
    expect(geometry.attributes.position!.array).toBe(initialPositions)
    expect(mesh.position).toMatchObject({x: 7, y: -11, z: 0})
    expect(invalidated).toEqual([])

    fixture.paths[0]!.d = "M 0 0 Q 20 0 20 20 L 40 20"
    backend.applyFrame(fixture.renderer.flush())
    expect(backend.root.children[0]).toBe(mesh)
    expect(mesh.geometry).toBe(geometry)
    expect(mesh.material).toBe(material)
    expect(geometry.attributes.position!.array).not.toBe(initialPositions)
    expect(geometry.attributes.position!.needsUpdate).toBeTrue()
    expect(invalidated).toEqual([])

    backend.dispose()
    expect(invalidated).toEqual([geometry])
  })

  test("validates malformed external path frames before retained mutation", () => {
    const fixture = pathFixture(1)
    const initial = fixture.renderer.flush()
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    backend.applyFrame(initial)
    const run = requirePathRun(backend.root.children[0])
    const item = initial.displayList[0] as PathDisplayItem
    const invalid = Object.freeze({
      ...item,
      geometry: Object.freeze({...item.geometry, segments: Object.freeze([])}),
    })

    expect(() => backend.applyFrame(externalFrame(initial, [invalid], initial.revision + 1)))
      .toThrow("geometry.segments must be a non-empty array")
    expect(backend.root.children).toEqual([run])
    expect(backend.diagnostics.revision).toBe(initial.revision)
  })

  test("preflights Path capacity before changing retained Rect or Path state", () => {
    const fixture = pathFixture(1)
    const backend = new RendererWebGpuBackend({
      maxPathStyles: 1,
      maxPathSegments: 1,
      invalidateGeometry() {},
    })
    const initial = fixture.renderer.flush()
    backend.applyFrame(initial)
    const run = requirePathRun(backend.root.children[0])
    const before = backend.diagnostics
    const second = fixture.document.createElement("vector-path")
    second.d = "M 0 20 L 100 20"
    second.setAttribute("style", "stroke:#336699;stroke-width:2.2px;z-index:1")
    fixture.root.appendChild(second)
    fixture.root.setAttribute(
      "style",
      "position:relative;width:1000px;height:1000px;background:#f00;transform:translate(0px,0px) scale(1);transform-origin:0 0",
    )

    expect(() => backend.applyFrame(fixture.renderer.flush())).toThrow("capacity exceeded")
    expect(backend.root.children).toEqual([run])
    expect(run.layer.styles.count).toBe(1)
    expect(run.layer.segments.count).toBe(1)
    expect(backend.diagnostics).toEqual(before)
  })

  test("rejects finite JS values that overflow packed float32 before mutation", () => {
    const fixture = pathFixture(1)
    const backend = new RendererWebGpuBackend({invalidateGeometry() {}})
    const initial = fixture.renderer.flush()
    backend.applyFrame(initial)
    const run = requirePathRun(backend.root.children[0])
    const before = backend.diagnostics
    const item = initial.displayList[0] as PathDisplayItem

    expect(() => backend.applyFrame(externalFrame(initial, [Object.freeze({
      ...item,
      strokeWidth: Number.MAX_VALUE,
    })], initial.revision + 1))).toThrow("finite float32")
    expect(backend.root.children).toEqual([run])
    expect(backend.diagnostics).toEqual(before)
  })

  test("rejects a sparse delta whose canonical predecessor belongs to another renderer", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = document.createElement("div")
    const second = document.createElement("div")
    first.id = "first"
    second.id = "second"
    document.appendChild(root)
    root.append(first, second)
    root.setAttribute("style", "display:flex;width:20px;height:10px")
    const red = createDocumentRenderer({
      document,
      root,
      viewport: {width: 20, height: 10},
      styleSheets: ["#first,#second{width:10px;height:10px;background:#f00}"],
    })
    const blue = createDocumentRenderer({
      document,
      root,
      viewport: {width: 20, height: 10},
      styleSheets: ["#first,#second{width:10px;height:10px;background:#00f}"],
    })
    const redFirst = red.flush()
    blue.flush()
    const backend = new RendererWebGpuBackend({
      rectInstancing: "disabled",
      invalidateGeometry() {},
    })
    backend.applyFrame(redFirst)

    first.setAttribute("style", "transform:translate(1px,0px);transform-origin:0 0")
    const blueSecond = blue.flush()
    backend.applyFrame(blueSecond)

    const mesh = backend.root.children[1]
    if (!(mesh instanceof Mesh) || Array.isArray(mesh.material)) throw new Error("Expected scalar Rect")
    if (!(mesh.material instanceof RoundedRectMaterial)) throw new Error("Expected RoundedRectMaterial")
    expect(mesh.material.fill).toMatchObject({r: 0, g: 0, b: 1, a: 1})
  })
})

function pathFixture(count: number) {
  const document = createDocument()
  const root = document.createElement("div")
  document.appendChild(root)
  root.setAttribute(
    "style",
    "position:relative;width:1000px;height:1000px;transform:translate(0px,0px) scale(1);transform-origin:0 0",
  )
  const paths = Array.from({length: count}, (_, index) => {
    const path = document.createElement("vector-path")
    path.d = `M 0 ${index % 1000} L 100 ${index % 1000}`
    path.setAttribute("style", "stroke:#336699;stroke-width:2.2px;pointer-hit-width:16px;z-index:1")
    root.appendChild(path)
    return path
  })
  return {
    document,
    root,
    paths,
    renderer: createDocumentRenderer({
      document,
      root,
      viewport: {width: 1200, height: 1200},
    }),
  }
}

function requirePathRun(value: unknown): InstancedStrokedPath {
  if (!(value instanceof InstancedStrokedPath)) throw new Error("Expected InstancedStrokedPath")
  return value
}

function clearPathUploads(run: InstancedStrokedPath): void {
  run.layer.styles.recordAttribute.clearUpdateRanges()
  run.layer.segments.recordAttribute.clearUpdateRanges()
  run.layer.segments.orderAttribute.clearUpdateRanges()
}

function externalFrame(
  source: RenderFrame,
  displayList: readonly PathDisplayItem[],
  revision: number,
): RenderFrame {
  return Object.freeze({...source, revision, displayList: Object.freeze([...displayList])})
}
