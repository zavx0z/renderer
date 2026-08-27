import {describe, expect, test} from "bun:test"
import {Object3D, Vector3, type ViewPoint} from "@engine/core"
import {RendererWebGpuScreenOverlay} from "../src/index.ts"

describe("RendererWebGpuScreenOverlay", () => {
  test("maps logical pixels uniformly onto the camera-locked visible plane", () => {
    const content = new Object3D()
    const overlay = new RendererWebGpuScreenOverlay({
      content,
      viewport: {width: 200, height: 100},
      distance: 600,
    })
    const viewPoint = fakeViewPoint({fov: Math.PI / 2, aspect: 2})

    overlay.updateForViewPoint(viewPoint)

    expect(overlay.children).toEqual([content])
    expect(overlay.position.x).toBeCloseTo(0)
    expect(overlay.position.y).toBeCloseTo(600)
    expect(overlay.position.z).toBeCloseTo(0)
    expect(content.scale.x).toBeCloseTo(12)
    expect(content.scale.y).toBeCloseTo(12)
    expect(content.scale.z).toBeCloseTo(12)
    expect(content.position.x).toBeCloseTo(-1200)
    expect(content.position.y).toBeCloseTo(600)
    expect(content.position.z).toBeCloseTo(0)
    expect(content.visible).toBeTrue()
  })

  test("preserves content identity across resize and hides an empty viewport", () => {
    const content = new Object3D()
    const overlay = new RendererWebGpuScreenOverlay({
      content,
      viewport: {width: 100, height: 100},
    })
    const viewPoint = fakeViewPoint({fov: Math.PI / 2, aspect: 1})
    overlay.updateForViewPoint(viewPoint)
    const scale = content.scale.x

    overlay.resize({width: 200, height: 100})
    overlay.updateForViewPoint(fakeViewPoint({fov: Math.PI / 2, aspect: 2}))
    expect(overlay.content).toBe(content)
    expect(content.scale.x).toBe(scale)

    overlay.resize({width: 0, height: 0})
    overlay.updateForViewPoint(viewPoint)
    expect(content.visible).toBeFalse()
  })

  test("preserves content-root clip coordinates across camera and viewport transforms", () => {
    const content = new Object3D()
    const renderable = new Object3D()
    content.add(renderable)
    const clips = Object.freeze([Object.freeze({
      kind: "rounded-rect" as const,
      coordinateSpace: content,
      center: Object.freeze([50, -25] as const),
      halfSize: Object.freeze([40, 20] as const),
      radii: Object.freeze([4, 4, 2, 2] as const),
    })])
    renderable.presentationClips = clips
    const overlay = new RendererWebGpuScreenOverlay({
      content,
      viewport: {width: 100, height: 50},
    })

    overlay.updateForViewPoint(fakeViewPoint({fov: Math.PI / 2, aspect: 2}))
    overlay.resize({width: 200, height: 100})
    overlay.updateForViewPoint(fakeViewPoint({fov: Math.PI / 3, aspect: 2}))

    expect(renderable.presentationClips).toBe(clips)
    expect(renderable.presentationClips[0]?.coordinateSpace).toBe(content)
    expect(overlay.content).toBe(content)
  })

  test("fails closed for invalid physical or logical dimensions", () => {
    const content = new Object3D()
    expect(() => new RendererWebGpuScreenOverlay({
      content,
      viewport: {width: -1, height: 10},
    })).toThrow("viewport")
    expect(() => new RendererWebGpuScreenOverlay({
      content,
      viewport: {width: 10, height: 10},
      distance: 0,
    })).toThrow("distance")
  })
})

function fakeViewPoint(options: Readonly<{fov: number; aspect: number}>): ViewPoint {
  return {
    fov: options.fov,
    aspect: options.aspect,
    position: new Vector3(0, 0, 0),
    getTarget: () => new Vector3(0, 1, 0),
    getUp: () => new Vector3(0, 0, 1),
  } as unknown as ViewPoint
}
