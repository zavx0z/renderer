import {
  Matrix4,
  Object3D,
  Ray,
  Vector3,
} from "@engine/core"
import type {RenderViewport} from "@zavx0z/renderer"

export type RendererWebGpuDocumentPoint = Readonly<{
  x: number
  y: number
}>

export type RendererWebGpuDocumentPlaneOptions = Readonly<{
  content: Object3D
  viewport: RenderViewport
  worldUnitsPerPixel: number
}>

export type RendererWebGpuDocumentPlaneIntersection = Readonly<{
  /** Exact world-space intersection with the infinite local plane. */
  worldPoint: Vector3
  /** Top-left logical document coordinates at the intersection. */
  documentPoint: RendererWebGpuDocumentPoint
  /** World-space distance from the Ray origin to `worldPoint`. */
  distance: number
  /** Whether the intersection belongs to the finite logical viewport. */
  inside: boolean
  /** Logical viewport point nearest to the infinite-plane intersection. */
  nearestDocumentPoint: RendererWebGpuDocumentPoint
  /** World-space realization of `nearestDocumentPoint`. */
  nearestWorldPoint: Vector3
  /** Exact world-space gap to the nearest finite viewport point. */
  nearestDistance: number
}>

/**
 * World-space presentation transform for one logical document viewport.
 *
 * The plane keeps local `(0, 0, 0)` at the viewport center while its stable
 * content root retains the backend's top-left logical coordinates. Consumer
 * transforms are ordinary Engine `Object3D` transforms on this instance.
 * This adapter owns no DOM, CSS, layout, hit dispatch, camera locking or GPU
 * lifecycle.
 */
export class RendererWebGpuDocumentPlane extends Object3D {
  public readonly content: Object3D
  #viewport: RenderViewport
  #worldUnitsPerPixel: number

  constructor(options: RendererWebGpuDocumentPlaneOptions) {
    super()
    if (options === null || typeof options !== "object") {
      throw new TypeError("Document plane options are required")
    }
    if (!(options.content instanceof Object3D)) {
      throw new TypeError("Document plane content must be an Object3D")
    }
    const viewport = validateViewport(options.viewport)
    const worldUnitsPerPixel = positive(options.worldUnitsPerPixel, "worldUnitsPerPixel")
    validatePhysicalExtents(viewport, worldUnitsPerPixel)
    this.content = options.content
    this.#viewport = viewport
    this.#worldUnitsPerPixel = worldUnitsPerPixel
    this.name = "@zavx0z/renderer-webgpu:document-plane"
    this.renderLayer = "world"
    this.frustumCulled = false
    this.add(this.content)
    this.#syncContentTransform()
  }

  public get viewport(): RenderViewport {
    return this.#viewport
  }

  public get worldUnitsPerPixel(): number {
    return this.#worldUnitsPerPixel
  }

  /** Resizes only the logical bounds while preserving every Engine owner. */
  public resize(viewport: RenderViewport): void {
    this.configure(viewport, this.#worldUnitsPerPixel)
  }

  /** Changes physical density without replacing the plane or content root. */
  public setWorldUnitsPerPixel(value: number): void {
    this.configure(this.#viewport, value)
  }

  /** Atomically changes logical bounds and physical density in place. */
  public configure(viewport: RenderViewport, worldUnitsPerPixel: number): void {
    const nextViewport = validateViewport(viewport)
    const nextScale = positive(worldUnitsPerPixel, "worldUnitsPerPixel")
    validatePhysicalExtents(nextViewport, nextScale)
    this.#viewport = nextViewport
    this.#worldUnitsPerPixel = nextScale
    this.#syncContentTransform()
  }

  /** Converts a top-left logical document point to the current world plane. */
  public documentPointToWorld(
    point: RendererWebGpuDocumentPoint,
    target: Vector3 = new Vector3(),
  ): Vector3 {
    const documentPoint = validateDocumentPoint(point)
    if (!(target instanceof Vector3)) throw new TypeError("Document plane target must be a Vector3")
    const matrixWorld = this.#currentWorldMatrix()
    target.set(
      (documentPoint.x - this.#viewport.width / 2) * this.#worldUnitsPerPixel,
      (this.#viewport.height / 2 - documentPoint.y) * this.#worldUnitsPerPixel,
      0,
    ).applyMatrix4(matrixWorld)
    validateVector(target, "converted world point")
    return target
  }

  /**
   * Projects a world point through the inverse plane transform.
   * The conversion is an exact inverse for points on the plane.
   */
  public worldPointToDocument(point: Vector3): RendererWebGpuDocumentPoint {
    validateVector(point, "world point")
    const local = point.clone().applyMatrix4(this.#currentInverseWorldMatrix())
    return documentPoint(
      local.x / this.#worldUnitsPerPixel + this.#viewport.width / 2,
      this.#viewport.height / 2 - local.y / this.#worldUnitsPerPixel,
    )
  }

  /** Includes exact finite viewport edges and rejects every empty viewport. */
  public containsDocumentPoint(point: RendererWebGpuDocumentPoint): boolean {
    const next = validateDocumentPoint(point)
    const {width, height} = this.#viewport
    return width > 0 && height > 0 &&
      next.x >= 0 && next.x <= width && next.y >= 0 && next.y <= height
  }

  /** Returns the closest finite logical point without mutating the input. */
  public nearestDocumentPoint(
    point: RendererWebGpuDocumentPoint,
  ): RendererWebGpuDocumentPoint {
    const next = validateDocumentPoint(point)
    return documentPoint(
      clamp(next.x, 0, this.#viewport.width),
      clamp(next.y, 0, this.#viewport.height),
    )
  }

  /** Logical-pixel distance to the finite viewport; zero means inside. */
  public distanceToDocumentBounds(point: RendererWebGpuDocumentPoint): number {
    const next = validateDocumentPoint(point)
    const nearest = this.nearestDocumentPoint(next)
    const distance = Math.hypot(next.x - nearest.x, next.y - nearest.y)
    if (!Number.isFinite(distance)) {
      throw new RangeError("Document plane bounds distance must be finite")
    }
    return distance
  }

  /**
   * Intersects a world Ray with local `z = 0` through the exact inverse matrix.
   * Parallel, coplanar and behind-origin Rays have no forward intersection.
   */
  public intersectRay(ray: Ray): RendererWebGpuDocumentPlaneIntersection | null {
    validateRay(ray)
    const matrixWorld = this.#currentWorldMatrix()
    const inverse = inverseMatrix(matrixWorld)
    const localOrigin = ray.origin.clone().applyMatrix4(inverse)
    const localDirection = ray.origin.clone()
      .add(ray.direction)
      .applyMatrix4(inverse)
      .sub(localOrigin)
      .normalize()
    validateVector(localOrigin, "inverse Ray origin")
    validateVector(localDirection, "inverse Ray direction")
    if (localDirection.length() === 0) {
      throw new RangeError("Document plane inverse Ray direction must be non-zero")
    }
    const localRay = new Ray(localOrigin, localDirection)
    if (localRay.direction.z === 0) return null
    const parameter = -localRay.origin.z / localRay.direction.z
    if (!Number.isFinite(parameter)) throw new RangeError("Document plane Ray intersection is not finite")
    if (parameter < 0) return null

    const localPoint = localRay.at(parameter, new Vector3())
    validateVector(localPoint, "local Ray intersection")
    const worldPoint = localPoint.clone().applyMatrix4(matrixWorld)
    validateVector(worldPoint, "Ray intersection")
    const documentAtIntersection = documentPoint(
      localPoint.x / this.#worldUnitsPerPixel + this.#viewport.width / 2,
      this.#viewport.height / 2 - localPoint.y / this.#worldUnitsPerPixel,
    )
    const nearestDocumentPoint = this.nearestDocumentPoint(documentAtIntersection)
    const nearestWorldPoint = this.documentPointToWorld(nearestDocumentPoint)
    const distance = ray.origin.distanceTo(worldPoint)
    const nearestDistance = worldPoint.distanceTo(nearestWorldPoint)
    if (!Number.isFinite(distance) || !Number.isFinite(nearestDistance)) {
      throw new RangeError("Document plane Ray distance is not finite")
    }

    return Object.freeze({
      worldPoint,
      documentPoint: documentAtIntersection,
      distance,
      inside: this.containsDocumentPoint(documentAtIntersection),
      nearestDocumentPoint,
      nearestWorldPoint,
      nearestDistance,
    })
  }

  #syncContentTransform(): void {
    const {width, height} = this.#viewport
    const scale = this.#worldUnitsPerPixel
    this.content.position.set(-width * scale / 2, height * scale / 2, 0)
    this.content.scale.set(scale, scale, scale)
    this.content.visible = width > 0 && height > 0
    this.content.updateMatrix()
  }

  #currentWorldMatrix(): Matrix4 {
    let root: Object3D = this
    while (root.parent !== null) root = root.parent
    root.updateWorldMatrix(true)
    validateMatrix(this.matrixWorld)
    return this.matrixWorld
  }

  #currentInverseWorldMatrix(): Matrix4 {
    return inverseMatrix(this.#currentWorldMatrix())
  }
}

const validateViewport = (viewport: RenderViewport): RenderViewport => {
  if (viewport === null || typeof viewport !== "object") {
    throw new TypeError("Document plane viewport is required")
  }
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width < 0 ||
    viewport.height < 0
  ) {
    throw new RangeError("Document plane viewport must be finite and non-negative")
  }
  return Object.freeze({width: viewport.width, height: viewport.height})
}

const validatePhysicalExtents = (
  viewport: RenderViewport,
  worldUnitsPerPixel: number,
): void => {
  if (
    !Number.isFinite(viewport.width * worldUnitsPerPixel) ||
    !Number.isFinite(viewport.height * worldUnitsPerPixel)
  ) {
    throw new RangeError("Document plane physical extents must be finite")
  }
}

const validateDocumentPoint = (
  point: RendererWebGpuDocumentPoint,
): RendererWebGpuDocumentPoint => {
  if (point === null || typeof point !== "object") {
    throw new TypeError("Document plane point is required")
  }
  return documentPoint(point.x, point.y)
}

const documentPoint = (x: number, y: number): RendererWebGpuDocumentPoint => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError("Document plane point must be finite")
  }
  return Object.freeze({x, y})
}

const validateRay = (ray: Ray): void => {
  if (!(ray instanceof Ray)) throw new TypeError("Document plane intersection requires a Ray")
  validateVector(ray.origin, "Ray origin")
  validateVector(ray.direction, "Ray direction")
  if (ray.direction.length() === 0) throw new RangeError("Document plane Ray direction must be non-zero")
}

const validateVector = (value: Vector3, label: string): void => {
  if (!(value instanceof Vector3)) throw new TypeError(`Document plane ${label} must be a Vector3`)
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new RangeError(`Document plane ${label} must be finite`)
  }
}

const validateMatrix = (matrix: Matrix4): void => {
  if (![...matrix.elements].every(Number.isFinite)) {
    throw new RangeError("Document plane world matrix must be finite")
  }
  const determinant = matrix.determinant()
  if (!Number.isFinite(determinant) || determinant === 0) {
    throw new RangeError("Document plane world matrix must be invertible")
  }
}

const inverseMatrix = (matrix: Matrix4): Matrix4 => {
  validateMatrix(matrix)
  const inverse = new Matrix4().copy(matrix).invert()
  if (![...inverse.elements].every(Number.isFinite)) {
    throw new RangeError("Document plane inverse world matrix must be finite")
  }
  return inverse
}

const positive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number`)
  }
  return value
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))
