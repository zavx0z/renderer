import {describe, expect, test} from "bun:test"
import {
  Object3D,
  Ray,
  Vector3,
} from "@engine/core"
import {RendererWebGpuDocumentPlane} from "../src/index.ts"

describe("RendererWebGpuDocumentPlane", () => {
  test("centers one logical viewport in local world units and converts both directions", () => {
    const content = new Object3D()
    const plane = new RendererWebGpuDocumentPlane({
      content,
      viewport: {width: 200, height: 100},
      worldUnitsPerPixel: 0.01,
    })

    expect(plane.children).toEqual([content])
    expect(plane.content).toBe(content)
    expect(plane.renderLayer).toBe("world")
    expect(content.renderLayer).toBeUndefined()
    expect(content.position.x).toBeCloseTo(-1)
    expect(content.position.y).toBeCloseTo(0.5)
    expect(content.scale.x).toBeCloseTo(0.01)
    expect(content.scale.y).toBeCloseTo(0.01)
    expect(content.scale.z).toBeCloseTo(0.01)

    expectVector(plane.documentPointToWorld({x: 0, y: 0}), [-1, 0.5, 0])
    expectVector(plane.documentPointToWorld({x: 100, y: 50}), [0, 0, 0])
    expectVector(plane.documentPointToWorld({x: 200, y: 100}), [1, -0.5, 0])
    expect(plane.worldPointToDocument(new Vector3(-1, 0.5, 0))).toEqual({x: 0, y: 0})
    expect(plane.worldPointToDocument(new Vector3(1, -0.5, 0))).toEqual({x: 200, y: 100})
  })

  test("preserves UI content paint order inside a world-space transform", () => {
    const content = new Object3D()
    content.renderLayer = "ui"
    const background = new Object3D()
    const first = new Object3D()
    const last = new Object3D()
    content.add(background)
    content.add(first)
    content.add(last)

    const plane = new RendererWebGpuDocumentPlane({
      content,
      viewport: {width: 200, height: 100},
      worldUnitsPerPixel: 0.01,
    })

    expect(plane.renderLayer).toBe("world")
    expect(content.renderLayer).toBe("ui")
    expect(content.children).toEqual([background, first, last])
    expect(content.children.every((child) => child.parent === content)).toBeTrue()
  })

  test("reports finite bounds, nearest logical point and logical distance", () => {
    const plane = fixture()

    expect(plane.containsDocumentPoint({x: 0, y: 0})).toBeTrue()
    expect(plane.containsDocumentPoint({x: 200, y: 100})).toBeTrue()
    expect(plane.containsDocumentPoint({x: -0.01, y: 50})).toBeFalse()
    expect(plane.containsDocumentPoint({x: 100, y: 100.01})).toBeFalse()
    expect(plane.nearestDocumentPoint({x: -30, y: 120})).toEqual({x: 0, y: 100})
    expect(plane.distanceToDocumentBounds({x: -30, y: 140})).toBe(50)
    expect(plane.distanceToDocumentBounds({x: 100, y: 50})).toBe(0)

    plane.resize({width: 0, height: 0})
    expect(plane.content.visible).toBeFalse()
    expect(plane.containsDocumentPoint({x: 0, y: 0})).toBeFalse()
    expect(plane.nearestDocumentPoint({x: 10, y: -10})).toEqual({x: 0, y: 0})
  })

  test("preserves plane, content and transform owners across resize and density changes", () => {
    const content = new Object3D()
    const plane = new RendererWebGpuDocumentPlane({
      content,
      viewport: {width: 200, height: 100},
      worldUnitsPerPixel: 0.01,
    })
    const contentPosition = content.position
    const contentScale = content.scale
    const planePosition = plane.position
    const planeQuaternion = plane.quaternion
    const planeScale = plane.scale

    plane.resize({width: 300, height: 120})
    plane.configure({width: 300, height: 120}, 0.02)
    plane.position.set(10, 20, 30)
    plane.rotation.z = Math.PI / 2
    plane.scale.set(2, 3, 4)

    expect(plane.content).toBe(content)
    expect(content.position).toBe(contentPosition)
    expect(content.scale).toBe(contentScale)
    expect(plane.position).toBe(planePosition)
    expect(plane.quaternion).toBe(planeQuaternion)
    expect(plane.scale).toBe(planeScale)
    expect(plane.viewport).toEqual({width: 300, height: 120})
    expect(plane.worldUnitsPerPixel).toBe(0.02)
    expect(content.position.x).toBeCloseTo(-3)
    expect(content.position.y).toBeCloseTo(1.2)
    expect(content.scale.x).toBeCloseTo(0.02)

    const documentPoint = {x: 40, y: 90}
    const worldPoint = plane.documentPointToWorld(documentPoint)
    const roundTrip = plane.worldPointToDocument(worldPoint)
    expect(roundTrip.x).toBeCloseTo(documentPoint.x, 4)
    expect(roundTrip.y).toBeCloseTo(documentPoint.y, 4)
  })

  test("intersects an inverse-transformed Ray and exposes inside and nearest distances", () => {
    const plane = fixture()
    const inside = plane.intersectRay(new Ray(
      new Vector3(0, 0, 5),
      new Vector3(0, 0, -2),
    ))

    expect(inside).not.toBeNull()
    expect(inside?.inside).toBeTrue()
    expect(inside?.documentPoint.x).toBeCloseTo(100)
    expect(inside?.documentPoint.y).toBeCloseTo(50)
    expect(inside?.distance).toBeCloseTo(5)
    expect(inside?.nearestDistance).toBe(0)
    expect(inside?.nearestDocumentPoint).toEqual({x: 100, y: 50})

    const outside = plane.intersectRay(new Ray(
      new Vector3(2, 0, 5),
      new Vector3(0, 0, -1),
    ))
    expect(outside?.inside).toBeFalse()
    expect(outside?.documentPoint).toEqual({x: 300, y: 50})
    expect(outside?.nearestDocumentPoint).toEqual({x: 200, y: 50})
    expect(outside?.nearestDistance).toBeCloseTo(1)
    expectVector(outside!.nearestWorldPoint, [1, 0, 0])

    expect(plane.intersectRay(new Ray(
      new Vector3(0, 0, 5),
      new Vector3(1, 0, 0),
    ))).toBeNull()
    expect(plane.intersectRay(new Ray(
      new Vector3(0, 0, 5),
      new Vector3(0, 0, 1),
    ))).toBeNull()
  })

  test("uses the complete parent and plane transform for conversion and Ray picking", () => {
    const parent = new Object3D()
    parent.position.set(5, -2, 7)
    parent.rotation.z = Math.PI / 6
    const plane = fixture()
    plane.position.set(3, 4, 5)
    plane.rotation.x = Math.PI / 3
    plane.scale.set(2, 1.5, 1)
    parent.add(plane)

    const center = plane.documentPointToWorld({x: 100, y: 50})
    const normalPoint = new Vector3(0, 0, 1).applyMatrix4(plane.matrixWorld)
    const normal = normalPoint.clone().sub(center).normalize()
    const ray = new Ray(
      center.clone().add(normal.clone().multiplyScalar(12)),
      normal.clone().negate(),
    )
    const hit = plane.intersectRay(ray)

    expect(hit?.inside).toBeTrue()
    expect(hit?.documentPoint.x).toBeCloseTo(100, 4)
    expect(hit?.documentPoint.y).toBeCloseTo(50, 3)
    expect(hit?.distance).toBeCloseTo(12, 3)
    expectVector(hit!.worldPoint, [center.x, center.y, center.z], 3)
  })

  test("fails closed before mutating options, points, Rays or singular transforms", () => {
    const content = new Object3D()
    expect(() => new RendererWebGpuDocumentPlane(null as never)).toThrow("options")
    expect(() => new RendererWebGpuDocumentPlane({
      content: null as never,
      viewport: {width: 10, height: 10},
      worldUnitsPerPixel: 1,
    })).toThrow("content")
    expect(() => new RendererWebGpuDocumentPlane({
      content,
      viewport: {width: -1, height: 10},
      worldUnitsPerPixel: 1,
    })).toThrow("viewport")
    expect(() => new RendererWebGpuDocumentPlane({
      content,
      viewport: {width: 10, height: 10},
      worldUnitsPerPixel: 0,
    })).toThrow("worldUnitsPerPixel")

    const plane = fixture()
    const viewport = plane.viewport
    const scale = plane.worldUnitsPerPixel
    const contentPosition = plane.content.position.clone()
    expect(() => plane.resize({width: Number.NaN, height: 10})).toThrow("viewport")
    expect(() => plane.setWorldUnitsPerPixel(Number.POSITIVE_INFINITY))
      .toThrow("worldUnitsPerPixel")
    expect(() => plane.setWorldUnitsPerPixel(Number.MAX_VALUE))
      .toThrow("physical extents")
    expect(plane.viewport).toBe(viewport)
    expect(plane.worldUnitsPerPixel).toBe(scale)
    expectVector(plane.content.position, [contentPosition.x, contentPosition.y, contentPosition.z])

    const overflowPlane = fixture()
    overflowPlane.setWorldUnitsPerPixel(2)
    const overflowViewport = overflowPlane.viewport
    expect(() => overflowPlane.resize({width: Number.MAX_VALUE, height: 10}))
      .toThrow("physical extents")
    expect(overflowPlane.viewport).toBe(overflowViewport)
    expect(() => plane.documentPointToWorld({x: Number.NaN, y: 0})).toThrow("point")
    expect(() => plane.distanceToDocumentBounds({x: Number.MAX_VALUE, y: Number.MAX_VALUE}))
      .toThrow("bounds distance")
    expect(() => plane.worldPointToDocument(new Vector3(0, 0, Number.NaN))).toThrow("finite")
    expect(() => plane.intersectRay({} as Ray)).toThrow("requires a Ray")
    expect(() => plane.intersectRay(new Ray(
      new Vector3(),
      new Vector3(),
    ))).toThrow("non-zero")

    plane.scale.x = 0
    expect(() => plane.documentPointToWorld({x: 0, y: 0})).toThrow("invertible")
    plane.scale.x = 1
    plane.position.x = Number.NaN
    expect(() => plane.worldPointToDocument(new Vector3())).toThrow("finite")
  })

  test("is a direct world adapter rather than a camera-locked overlay alias", async () => {
    const source = await Bun.file(new URL("../src/document-plane.ts", import.meta.url)).text()

    expect(source).toContain("extends Object3D")
    expect(source).toContain("worldUnitsPerPixel")
    expect(source).toContain("new Ray(")
    for (const forbidden of [
      "RendererWebGpuScreenOverlay",
      "ViewPoint",
      "@layout/core",
      "UiSurface",
      "distanceMm",
    ]) expect(source).not.toContain(forbidden)
  })
})

function fixture(): RendererWebGpuDocumentPlane {
  return new RendererWebGpuDocumentPlane({
    content: new Object3D(),
    viewport: {width: 200, height: 100},
    worldUnitsPerPixel: 0.01,
  })
}

function expectVector(
  actual: Vector3,
  expected: readonly [number, number, number],
  precision = 8,
): void {
  expect(actual.x).toBeCloseTo(expected[0], precision)
  expect(actual.y).toBeCloseTo(expected[1], precision)
  expect(actual.z).toBeCloseTo(expected[2], precision)
}
