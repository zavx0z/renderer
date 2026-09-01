import {describe, expect, test} from "bun:test"
import {createDocument} from "@zavx0z/dom"
import * as FrameChanges from "@zavx0z/renderer/frame-changes"
import {
  createDocumentRenderer,
  hitTest,
  type PathDisplayItem,
} from "@zavx0z/renderer"

describe("bounded semantic vector paths", () => {
  test("exposes only the read side of canonical frame deltas", () => {
    expect(typeof FrameChanges.readCanonicalRenderFrameChanges).toBe("function")
    expect("recordCanonicalRenderFrameChanges" in FrameChanges).toBeFalse()
  })

  test("does not strongly retain the canonical predecessor frame chain", async () => {
    const buildChain = () => {
      const document = createDocument()
      const root = document.createElement("div")
      const path = document.createElement("vector-path")
      document.appendChild(root)
      root.appendChild(path)
      root.setAttribute(
        "style",
        "position:relative;width:100px;height:100px;transform:translate(0px,0px);transform-origin:0 0",
      )
      path.d = "M 0 0 L 100 0"
      path.setAttribute("style", "stroke:#fff;stroke-width:2px")
      const renderer = createDocumentRenderer({
        document,
        root,
        viewport: {width: 120, height: 120},
      })
      const initial = renderer.flush()
      const reference = new WeakRef(initial)
      let latest = initial
      for (let index = 0; index < 256; index += 1) {
        root.setAttribute(
          "style",
          `position:relative;width:100px;height:100px;transform:translate(${index + 1}px,0px);transform-origin:0 0`,
        )
        latest = renderer.flush()
      }
      return {reference, renderer, latest}
    }
    const {reference, renderer, latest} = buildChain()
    await new Promise((resolve) => setTimeout(resolve, 0))
    for (let index = 0; index < 4; index += 1) {
      Bun.gc(true)
      new Uint8Array(1_048_576)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(reference.deref()).toBeUndefined()
    expect(FrameChanges.readCanonicalRenderFrameChanges(latest)).toBeNull()
    renderer.dispose()
  })
  test("normalizes absolute M/L/Q/C into one retained path item", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const path = document.createElement("vector-path")
    document.appendChild(root)
    root.appendChild(path)
    root.setAttribute(
      "style",
      "position:relative;width:200px;height:100px;transform:translate(10px,20px) scale(2);transform-origin:0 0",
    )
    path.d = "M 0 0 L 20 0 Q 30 0 30 10 C 30 20 40 20 40 30"
    path.setAttribute(
      "style",
      "stroke:#336699;stroke-width:2.2px;pointer-hit-width:16px",
    )
    path.setAttribute("role", "option")
    path.tabIndex = 0

    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 400, height: 240},
    }).flush()
    const item = frame.displayList.find((entry): entry is PathDisplayItem => entry.kind === "path")

    expect(item).toBeDefined()
    expect(item).toMatchObject({
      key: "path",
      node: path,
      x: 0,
      y: 0,
      stroke: "#336699",
      strokeWidth: 2.2,
      opacity: 1,
      presentationOwner: root,
      transform: {scaleX: 1, scaleY: 1, translateX: 0, translateY: 0},
    })
    expect(item!.geometry.cubics).toHaveLength(3)
    expect(item!.geometry.segments).toHaveLength(13)
    expect(Object.isFrozen(item!.geometry)).toBeTrue()
    expect(Object.isFrozen(item!.geometry.cubics)).toBeTrue()
    expect(Object.isFrozen(item!.geometry.segments)).toBeTrue()
    expect(frame.presentationTransforms?.get(root)).toEqual({
      scaleX: 2,
      scaleY: 2,
      translateX: 10,
      translateY: 20,
    })
    expect(frame.boxByNode.has(path)).toBeFalse()
    expect(frame.hits.get(path)).toMatchObject({
      node: path,
      interactive: true,
      role: "option",
      path: {
        geometry: item!.geometry,
        strokeWidth: 2.2,
        pointerHitWidth: 16,
        presentationOwner: root,
      },
    })
  })

  test("uses the same sampled path for transformed screen-minimum hit testing and clips", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const path = document.createElement("vector-path")
    document.appendChild(root)
    root.appendChild(path)
    root.setAttribute(
      "style",
      "position:relative;width:60px;height:30px;overflow:clip;transform:translate(20px,30px) scale(0.5);transform-origin:0 0",
    )
    path.d = "M 0 20 L 100 20"
    path.setAttribute("style", "stroke:#fff;stroke-width:2px;pointer-hit-width:16px")
    path.tabIndex = 0
    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 100},
    }).flush()

    expect(hitTest(frame, 35, 44)?.node).toBe(path)
    expect(hitTest(frame, 35, 46)?.node).not.toBe(path)
    expect(hitTest(frame, 49, 40)?.node).toBe(path)
    expect(hitTest(frame, 51, 40)?.node).not.toBe(path)

    root.setAttribute(
      "style",
      "position:relative;width:60px;height:30px;overflow:clip;transform:translate(20px,30px) scale(2);transform-origin:0 0",
    )
    const zoomed = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 140},
    }).flush()
    expect(hitTest(zoomed, 50, 85)?.node).toBe(path)
    expect(hitTest(zoomed, 50, 87)?.node).not.toBe(path)
  })

  test("centers the published Path hit envelope on a hittable sampled segment", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const path = document.createElement("vector-path")
    document.appendChild(root)
    root.appendChild(path)
    root.setAttribute("style", "position:relative;width:200px;height:140px")
    path.d = "M 0 0 L 100 0 L 100 60"
    path.setAttribute("style", "stroke:#fff;stroke-width:2px;pointer-hit-width:16px")
    path.tabIndex = 0
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 180},
    })
    const initial = renderer.flush()
    const initialHit = initial.hits.get(path)!
    const initialCenter = {
      x: initialHit.x + initialHit.width / 2,
      y: initialHit.y + initialHit.height / 2,
    }

    expect(hitTest(initial, 50, 30)?.node).not.toBe(path)
    expect(initialCenter).toEqual({x: 50, y: 0})
    expect(hitTest(initial, initialCenter.x, initialCenter.y)?.node).toBe(path)
    expect(initialHit.x).toBeLessThanOrEqual(-8)
    expect(initialHit.x + initialHit.width).toBeGreaterThanOrEqual(108)
    expect(initialHit.y).toBeLessThanOrEqual(-8)
    expect(initialHit.y + initialHit.height).toBeGreaterThanOrEqual(68)

    path.d = "M 0 0 L 80 0 L 80 100"
    const updated = renderer.flush()
    const updatedHit = updated.hits.get(path)!
    const updatedCenter = {
      x: updatedHit.x + updatedHit.width / 2,
      y: updatedHit.y + updatedHit.height / 2,
    }
    expect(updatedHit).not.toBe(initialHit)
    expect(updatedCenter).toEqual({x: 80, y: 50})
    expect(hitTest(updated, updatedCenter.x, updatedCenter.y)?.node).toBe(path)
  })

  test("fails closed for malformed, relative, closed and multi-subpath data", () => {
    for (const d of [
      "",
      "M 0 0",
      "M 0 0 L 0 0",
      "m 0 0 l 10 10",
      "M 0 0 L nope 10",
      "M 0 0 L 1e999 10",
      "M -1e308 0 L 1e308 0",
      "M 0 0 L 10 10 Z",
      "M 0 0 L 10 10 M 20 20 L 30 30",
      `M 0 0 ${Array.from({length: 257}, (_, index) => `L ${index + 1} 0`).join(" ")}`,
      `M 0 0 ${"L 0 0 ".repeat(20_000)}`,
    ]) {
      const document = createDocument()
      const path = document.createElement("vector-path")
      document.appendChild(path)
      path.d = d
      path.setAttribute("style", "stroke-width:2px;pointer-hit-width:16px")
      const frame = createDocumentRenderer({
        document,
        root: path,
        viewport: {width: 100, height: 100},
      }).flush()
      expect(frame.displayList.filter((item) => item.kind === "path"), d).toEqual([])
      expect(frame.hits.has(path), d).toBeFalse()
    }
  })

  test("keeps visible same-endpoint Quadratic and Cubic loops", () => {
    const document = createDocument()
    const path = document.createElement("vector-path")
    document.appendChild(path)
    path.d = "M 20 20 Q 40 0 20 20 C 0 40 40 40 20 20"
    path.setAttribute("style", "stroke:#fff;stroke-width:2px;pointer-hit-width:16px")
    const frame = createDocumentRenderer({
      document,
      root: path,
      viewport: {width: 60, height: 60},
    }).flush()
    const item = frame.displayList.find((entry): entry is PathDisplayItem => entry.kind === "path")

    expect(item?.geometry.cubics).toHaveLength(2)
    expect(item?.geometry.segments).toHaveLength(12)
    expect(item?.geometry.bounds.width).toBeGreaterThan(0)
    expect(item?.geometry.bounds.height).toBeGreaterThan(0)
    expect(hitTest(frame, 30, 10)?.node).toBe(path)
  })

  test("resolves Path paint and hit properties through inherited custom values", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const path = document.createElement("vector-path")
    document.appendChild(root)
    root.appendChild(path)
    root.setAttribute("style", "--edge:#336699;--width:3.4px;--hit:16px")
    path.d = "M 0 0 L 20 0"
    path.setAttribute(
      "style",
      "stroke:var(--edge);stroke-width:var(--width);pointer-hit-width:var(--hit)",
    )
    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 40, height: 40},
    }).flush()
    expect(frame.displayList.find((item) => item.kind === "path")).toMatchObject({
      stroke: "#336699",
      strokeWidth: 3.4,
    })
    expect(frame.hits.get(path)?.path?.pointerHitWidth).toBe(16)
  })

  test("keeps 10k Path items and hits exact across one shared transform update", () => {
    const count = 10_000
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
      path.setAttribute("style", "stroke:#fff;stroke-width:2px;pointer-hit-width:16px")
      root.appendChild(path)
      return path
    })
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 1200, height: 1200},
    })
    const initial = renderer.flush()
    const initialItems = [...initial.displayList]
    const initialHits = paths.map((path) => initial.hits.get(path))

    Bun.gc(true)
    const samples: number[] = []
    let last = initial
    for (let index = 0; index < 35; index += 1) {
      const offset = index % 2 === 0 ? 5 : 0
      root.setAttribute(
        "style",
        `position:relative;width:1000px;height:1000px;transform:translate(${offset}px,${offset + 2}px) scale(${offset === 0 ? 1 : 1.25});transform-origin:0 0`,
      )
      Bun.gc(true)
      const started = performance.now()
      last = renderer.flush()
      if (index >= 5) samples.push(performance.now() - started)
    }

    expect(last.displayList).toHaveLength(count)
    expect(last.displayList.every((item, index) => item === initialItems[index])).toBeTrue()
    expect(paths.every((path, index) => last.hits.get(path) === initialHits[index])).toBeTrue()
    expect(last.presentationTransforms?.get(root)).toEqual({
      scaleX: 1.25,
      scaleY: 1.25,
      translateX: 5,
      translateY: 7,
    })
    samples.sort((left, right) => left - right)
    const p50 = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.5) - 1)]!
    const p95 = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)]!
    expect(p50).toBeLessThan(16.7)
    expect(p95).toBeLessThan(50)
  })

  test("reuses Path projections inside a mixed transformed Node subtree", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const node = document.createElement("div")
    document.appendChild(root)
    root.setAttribute(
      "style",
      "position:relative;width:400px;height:300px;transform:translate(0px,0px) scale(1);transform-origin:0 0",
    )
    node.setAttribute("style", "position:absolute;left:40px;top:30px;width:80px;height:40px;background:#336699")
    const paths = Array.from({length: 1_000}, (_, index) => {
      const path = document.createElement("vector-path")
      path.d = `M 0 ${index % 300} L 200 ${index % 300}`
      path.setAttribute("style", "stroke:#fff;stroke-width:2px;pointer-hit-width:16px")
      root.appendChild(path)
      return path
    })
    root.appendChild(node)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 500, height: 400},
    })
    const initial = renderer.flush()
    const pathItems = new Map(paths.map((path) => [
      path,
      initial.displayList.find((item) => item.kind === "path" && item.node === path),
    ]))
    const pathHits = new Map(paths.map((path) => [path, initial.hits.get(path)]))
    const initialNodeBox = initial.boxByNode.get(node)
    const initialNodeHit = initial.hits.get(node)
    const initialNodePaint = initial.displayList.find((item) => item.node === node)

    root.setAttribute(
      "style",
      "position:relative;width:400px;height:300px;transform:translate(12px,18px) scale(1.5);transform-origin:0 0",
    )
    const next = renderer.flush()

    expect(paths.every((path) =>
      next.displayList.find((item) => item.kind === "path" && item.node === path) === pathItems.get(path)
    )).toBeTrue()
    expect(paths.every((path) => next.hits.get(path) === pathHits.get(path))).toBeTrue()
    expect(next.boxByNode.get(node)).not.toBe(initialNodeBox)
    expect(next.boxByNode.get(node)?.transform).toEqual({
      scaleX: 1.5,
      scaleY: 1.5,
      translateX: 12,
      translateY: 18,
    })
    expect(next.hits.get(node)).not.toBe(initialNodeHit)
    expect(next.displayList.find((item) => item.node === node)).not.toBe(initialNodePaint)
    expect(next.presentationTransforms?.get(root)).toEqual({
      scaleX: 1.5,
      scaleY: 1.5,
      translateX: 12,
      translateY: 18,
    })
  })

  test("recomposes a boxless Path transform owner when its ancestor changes", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const path = document.createElement("vector-path")
    const ordinary = document.createElement("div")
    document.appendChild(root)
    root.append(path, ordinary)
    root.setAttribute(
      "style",
      "position:relative;width:100px;height:100px;transform:translate(10px,20px) scale(2);transform-origin:0 0",
    )
    path.d = "M 0 0 L 20 0"
    path.setAttribute(
      "style",
      "stroke:#fff;stroke-width:2px;pointer-hit-width:16px;transform:translate(5px,3px) scale(0.5);transform-origin:0 0",
    )
    ordinary.setAttribute(
      "style",
      "position:absolute;left:70px;top:70px;width:10px;height:10px;background:#f00",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 150},
    })
    const initial = renderer.flush()
    const item = initial.displayList.find((entry) => entry.kind === "path")
    const hit = initial.hits.get(path)
    expect(initial.presentationTransforms?.get(path)).toEqual({
      scaleX: 1,
      scaleY: 1,
      translateX: 20,
      translateY: 26,
    })

    root.setAttribute(
      "style",
      "position:relative;width:100px;height:100px;transform:translate(4px,6px) scale(3);transform-origin:0 0",
    )
    const next = renderer.flush()

    expect(next.displayList.find((entry) => entry.kind === "path")).toBe(item)
    expect(next.hits.get(path)).toBe(hit)
    expect(next.presentationTransforms?.get(path)).toEqual({
      scaleX: 1.5,
      scaleY: 1.5,
      translateX: 19,
      translateY: 15,
    })
    expect(hitTest(next, 30, 22)?.node).toBe(path)
  })

  test("rebuilds Path owner references when ancestor transform ownership appears or disappears", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const path = document.createElement("vector-path")
    document.appendChild(root)
    root.appendChild(path)
    root.setAttribute("style", "position:relative;width:100px;height:100px")
    path.d = "M 0 10 L 50 10"
    path.setAttribute("style", "stroke:#fff;stroke-width:2px;pointer-hit-width:16px")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 120},
    })
    const plain = renderer.flush()
    const plainPath = plain.displayList.find((item) => item.kind === "path")
    expect(plainPath?.presentationOwner).toBeNull()

    root.setAttribute(
      "style",
      "position:relative;width:100px;height:100px;transform:translate(10px,20px) scale(2);transform-origin:0 0",
    )
    const transformed = renderer.flush()
    const transformedPath = transformed.displayList.find((item) => item.kind === "path")
    expect(transformedPath).not.toBe(plainPath)
    expect(transformedPath?.presentationOwner).toBe(root)
    expect(transformed.presentationTransforms?.get(root)).toEqual({
      scaleX: 2,
      scaleY: 2,
      translateX: 10,
      translateY: 20,
    })

    root.setAttribute("style", "position:relative;width:100px;height:100px")
    const restored = renderer.flush()
    const restoredPath = restored.displayList.find((item) => item.kind === "path")
    expect(restoredPath).not.toBe(transformedPath)
    expect(restoredPath?.presentationOwner).toBeNull()
    expect(restored.presentationTransforms?.has(root)).toBeFalse()
    expect(hitTest(restored, 25, 17)?.node).toBe(path)
  })

  test("keeps descendant overflow clips stable through an ancestor transform patch", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const clipOwner = document.createElement("div")
    const child = document.createElement("div")
    const path = document.createElement("vector-path")
    document.appendChild(root)
    root.append(path, clipOwner)
    clipOwner.appendChild(child)
    root.setAttribute(
      "style",
      "position:relative;width:100px;height:100px;transform:translate(0px,0px) scale(1);transform-origin:0 0",
    )
    path.d = "M 0 5 L 80 5"
    path.setAttribute("style", "stroke:#fff;stroke-width:2px;pointer-hit-width:16px")
    clipOwner.setAttribute(
      "style",
      "position:absolute;left:10px;top:10px;width:20px;height:20px;overflow:clip",
    )
    child.setAttribute("style", "position:absolute;width:40px;height:20px;background:#f00")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 220, height: 220},
    })
    const initial = renderer.flush()
    const initialChild = initial.displayList.find((item) => item.node === child)
    const clip = initialChild?.clips[0]
    expect(clip?.presentationOwner).toBe(root)
    expect(hitTest(initial, 15, 15)?.node).toBe(child)
    expect(hitTest(initial, 35, 15)?.node).not.toBe(child)

    root.setAttribute(
      "style",
      "position:relative;width:100px;height:100px;transform:translate(5px,5px) scale(2);transform-origin:0 0",
    )
    const next = renderer.flush()
    const nextChild = next.displayList.find((item) => item.node === child)

    expect(nextChild?.clips[0]).toBe(clip)
    expect(next.scrolls).toBe(initial.scrolls)
    expect(next.presentationTransforms?.get(root)).toEqual({
      scaleX: 2,
      scaleY: 2,
      translateX: 5,
      translateY: 5,
    })
    expect(hitTest(next, 30, 35)?.node).toBe(child)
    expect(hitTest(next, 70, 35)?.node).not.toBe(child)
  })

  test("patches one selected Path inside its bounded stacking block", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const paths = ["a", "b", "c"].map((id, index) => {
      const path = document.createElement("vector-path")
      path.id = id
      path.d = `M 0 ${index * 10} L 50 ${index * 10}`
      path.setAttribute("role", "option")
      return path
    })
    const node = document.createElement("div")
    node.id = "node"
    document.appendChild(root)
    root.append(...paths, node)
    root.setAttribute("style", "position:relative;width:100px;height:100px")
    node.setAttribute("style", "position:absolute;width:10px;height:10px;background:#f00;z-index:3")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 100},
      styleSheets: [
        "vector-path{stroke:#fff;stroke-width:2.2px;pointer-hit-width:16px;z-index:1}",
        "vector-path[aria-selected=true]{stroke-width:3.4px;z-index:2}",
      ],
    })
    const initial = renderer.flush()
    const initialItems = new Map(paths.map((path) => [
      path,
      initial.displayList.find((item) => item.node === path),
    ]))

    paths[1]!.setAttribute("aria-selected", "true")
    const selected = renderer.flush()
    const orderedPaths = selected.displayList
      .filter((item) => item.kind === "path")
      .map((item) => item.node)

    expect(orderedPaths).toEqual([paths[0]!, paths[2]!, paths[1]!])
    expect(selected.displayList.at(-1)?.node).toBe(node)
    expect(selected.displayList.find((item) => item.node === paths[0])).toBe(initialItems.get(paths[0]!))
    expect(selected.displayList.find((item) => item.node === paths[2])).toBe(initialItems.get(paths[2]!))
    expect(selected.displayList.find((item) => item.node === paths[1])).toMatchObject({strokeWidth: 3.4})
    expect(selected.hitOrder?.filter(({node}) => paths.includes(node as never)).map(({node}) => node))
      .toEqual([paths[0]!, paths[2]!, paths[1]!])

    paths[1]!.setAttribute("style", "z-index:100")
    const crossed = renderer.flush()
    expect(crossed.displayList.at(-1)?.node).toBe(paths[1])
    expect(crossed.displayList.findIndex((item) => item.node === node))
      .toBeLessThan(crossed.displayList.findIndex((item) => item.node === paths[1]))
  })

  test("patches two-Path selection switches in either mutation order", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const paths = ["a", "b", "c", "d"].map((id, index) => {
      const path = document.createElement("vector-path")
      path.id = id
      path.d = `M 0 ${index * 10} L 50 ${index * 10}`
      path.setAttribute("role", "option")
      root.appendChild(path)
      return path
    })
    paths[0]!.setAttribute("aria-selected", "true")
    document.appendChild(root)
    root.setAttribute("style", "display:flex;position:relative;width:100px;height:100px")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 100},
      styleSheets: [
        "vector-path{stroke:#fff;stroke-width:2.2px;pointer-hit-width:16px;z-index:1}",
        "vector-path[aria-selected=true]{stroke-width:3.4px;z-index:2}",
      ],
    })
    const initial = renderer.flush()
    const stableC = initial.displayList.find((item) => item.node === paths[2])
    const stableD = initial.displayList.find((item) => item.node === paths[3])

    paths[0]!.removeAttribute("aria-selected")
    paths[1]!.setAttribute("aria-selected", "true")
    const selectedB = renderer.flush()
    expect(selectedB.displayList.filter(({kind}) => kind === "path").map(({node}) => node))
      .toEqual([paths[0]!, paths[2]!, paths[3]!, paths[1]!])
    expect(selectedB.displayList.find((item) => item.node === paths[2])).toBe(stableC)
    expect(selectedB.displayList.find((item) => item.node === paths[3])).toBe(stableD)
    expect(FrameChanges.readCanonicalRenderFrameChanges(selectedB)?.operations).toHaveLength(2)

    paths[2]!.setAttribute("aria-selected", "true")
    paths[1]!.removeAttribute("aria-selected")
    const selectedC = renderer.flush()
    expect(selectedC.displayList.filter(({kind}) => kind === "path").map(({node}) => node))
      .toEqual([paths[0]!, paths[1]!, paths[3]!, paths[2]!])
    expect(selectedC.hitOrder?.filter(({path}) => path !== undefined).map(({node}) => node))
      .toEqual([paths[0]!, paths[1]!, paths[3]!, paths[2]!])
    expect(FrameChanges.readCanonicalRenderFrameChanges(selectedC)?.operations).toHaveLength(2)
  })
})
