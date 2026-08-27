import {
  Matrix4,
  Object3D,
  Vector3,
  type ViewPoint,
} from "@engine/core"
import type {RenderViewport} from "@zavx0z/renderer"

export type RendererWebGpuScreenOverlayOptions = Readonly<{
  content: Object3D
  viewport: RenderViewport
  distance?: number
}>

/**
 * Camera-locked presentation transform for one logical-pixel document root.
 *
 * CSS/layout coordinates stay in logical pixels. This overlay derives one
 * uniform world-unit scale from the current camera frustum and positions the
 * document's top-left at the visible plane's top-left. It owns no semantic,
 * layout, paint, input or GPU resource state.
 */
export class RendererWebGpuScreenOverlay extends Object3D {
  public readonly content: Object3D
  public distance: number
  #viewport: RenderViewport

  constructor(options: RendererWebGpuScreenOverlayOptions) {
    super()
    this.content = options.content
    this.distance = positive(options.distance ?? 600, "distance")
    this.#viewport = validateViewport(options.viewport)
    this.name = "@zavx0z/renderer-webgpu:screen-overlay"
    this.renderLayer = "ui"
    this.frustumCulled = false
    this.add(this.content)
  }

  public get viewport(): RenderViewport {
    return this.#viewport
  }

  public resize(viewport: RenderViewport): void {
    this.#viewport = validateViewport(viewport)
  }

  public updateForViewPoint(viewPoint: ViewPoint): void {
    const forward = new Vector3()
      .subVectors(viewPoint.getTarget(), viewPoint.position)
      .normalize()
    if (forward.length() === 0) return

    const center = viewPoint.position
      .clone()
      .add(forward.clone().multiplyScalar(this.distance))
    const zAxis = forward.clone().negate().normalize()
    const viewUp = viewPoint.getUp().clone().normalize()
    let xAxis = new Vector3().crossVectors(viewUp, zAxis).normalize()
    if (xAxis.length() === 0) xAxis = new Vector3(1, 0, 0)
    const yAxis = new Vector3().crossVectors(zAxis, xAxis).normalize()
    const rotation = new Matrix4().set(
      xAxis.x, yAxis.x, zAxis.x, 0,
      xAxis.y, yAxis.y, zAxis.y, 0,
      xAxis.z, yAxis.z, zAxis.z, 0,
      0, 0, 0, 1,
    )

    this.position.copy(center)
    this.quaternion.setFromRotationMatrix(rotation)
    this.#fitContent(viewPoint)
    this.updateWorldMatrix(true)
  }

  #fitContent(viewPoint: ViewPoint): void {
    const {width, height} = this.#viewport
    if (width === 0 || height === 0) {
      this.content.visible = false
      return
    }
    this.content.visible = true
    const visibleHeight = 2 * this.distance * Math.tan(viewPoint.fov / 2)
    const aspect = Number.isFinite(viewPoint.aspect) && viewPoint.aspect > 0
      ? viewPoint.aspect
      : width / height
    const visibleWidth = visibleHeight * aspect
    const scale = Math.min(visibleWidth / width, visibleHeight / height)
    this.content.scale.set(scale, scale, scale)
    this.content.position.set(-width * scale / 2, height * scale / 2, 0)
    this.content.updateMatrix()
  }
}

const validateViewport = (viewport: RenderViewport): RenderViewport => {
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width < 0 ||
    viewport.height < 0
  ) {
    throw new RangeError("Screen overlay viewport must be finite and non-negative")
  }
  return Object.freeze({width: viewport.width, height: viewport.height})
}

const positive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number`)
  }
  return value
}
