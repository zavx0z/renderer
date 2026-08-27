import {
  BufferGeometry,
  CachedText,
  Color,
  ImageMaterial,
  Matrix4,
  Mesh,
  Object3D,
  PlaneGeometry,
  RoundedRectMaterial,
  Text,
  TextMaterial,
  type PresentationClipShape,
  type TrueTypeFont,
} from "@engine/core"
import type {
  DisplayItem,
  ImageDisplayItem,
  RectDisplayItem,
  RenderClip,
  RenderFrame,
  RenderTransform,
  TextDisplayItem,
} from "@zavx0z/renderer"

export type RendererWebGpuBackendOptions = Readonly<{
  /** One resolved Engine font for every Text item in this backend. */
  font?: TrueTypeFont
  /** Releases renderer-owned GPU buffers for a geometry before it is forgotten. */
  invalidateGeometry(geometry: BufferGeometry): void
  /** Schedules a new host presentation after an asynchronous texture change. */
  requestPresentation?(): void
}>

type DisplayNode = DisplayItem["node"]
type DisplayToken = object

type PreparedClip = Readonly<{
  x: number
  y: number
  width: number
  height: number
  radii: readonly [number, number, number, number]
  transform: RenderTransform
}>

type PreparedRectItem = Readonly<{
  kind: "rect"
  item: RectDisplayItem
  fill: Color
  border: Color
  borderWidths: readonly [number, number, number, number]
  radii: readonly [number, number, number, number]
  opacity: number
  shadow: Readonly<{
    blurRadius: number
    spreadRadius: number
    geometryWidth: number
    geometryHeight: number
  }> | null
  clips: readonly PreparedClip[]
  token: DisplayToken
}>

type PreparedTextItem = Readonly<{
  kind: "text"
  item: TextDisplayItem
  color: Color
  opacity: number
  clips: readonly PreparedClip[]
  token: DisplayToken
}>

type PreparedImageItem = Readonly<{
  kind: "image"
  item: ImageDisplayItem
  boxAspect: number
  opacity: number
  clips: readonly PreparedClip[]
  token: DisplayToken
}>

type PreparedItem = PreparedRectItem | PreparedTextItem | PreparedImageItem

type RetainedClipSpace = {
  coordinateSpace: Object3D
  localMatrix: Matrix4
}

type RetainedClipState = {
  clipSpaces: RetainedClipSpace[]
}

type RectEntry = RetainedClipState & {
  kind: "rect"
  node: Mesh
  geometry: PlaneGeometry
  material: RoundedRectMaterial
  width: number
  height: number
}

type TextEntry = RetainedClipState & {
  kind: "text"
  node: CachedText
  material: TextMaterial
  text: string
  fontSize: number
  letterSpacing: number
}

type ImageEntry = RetainedClipState & {
  kind: "image"
  node: Mesh
  geometry: PlaneGeometry
  material: ImageMaterial
  src: string
  width: number
  height: number
}

type RetainedEntry = RectEntry | TextEntry | ImageEntry

const WHITE = "#ffffff"
const NO_PRESENTATION_CLIPS: readonly PresentationClipShape[] = Object.freeze([])
const NO_PREPARED_CLIPS: readonly PreparedClip[] = Object.freeze([])

/**
 * Retained projection of resolved Rect/Text/Image display items into Engine objects.
 *
 * Item identity is the composite `(DisplayItem.node, DisplayItem.key)`. The
 * backend does not evaluate DOM, selectors, CSS, layout, events or hit
 * semantics.
 */
export class RendererWebGpuBackend {
  public readonly root = new Object3D()

  readonly #font: TrueTypeFont | undefined
  readonly #invalidateGeometry: (geometry: BufferGeometry) => void
  readonly #requestPresentation: (() => void) | undefined
  readonly #tokens = new WeakMap<DisplayNode, Map<string, DisplayToken>>()
  #entries = new Map<DisplayToken, RetainedEntry>()
  #disposed = false

  constructor(options: RendererWebGpuBackendOptions) {
    this.#font = options.font
    this.#invalidateGeometry = options.invalidateGeometry
    this.#requestPresentation = options.requestPresentation
    this.root.name = "@zavx0z/renderer-webgpu"
    this.root.renderLayer = "ui"
  }

  /** Applies one complete immutable display frame to the stable Engine root. */
  public applyFrame(frame: RenderFrame): void {
    if (this.#disposed) throw new Error("RendererWebGpuBackend is disposed")

    const prepared = this.#prepareFrame(frame)
    const created = new Map<DisplayToken, RetainedEntry>()

    // Allocate every required replacement before mutating retained entries.
    for (const value of prepared) {
      const existing = this.#entries.get(value.token)
      if (existing?.kind === value.item.kind) continue
      created.set(value.token, this.#createEntry(value))
    }

    const nextEntries = new Map<DisplayToken, RetainedEntry>()
    const nextNodes: Object3D[] = []
    const stale: RetainedEntry[] = []

    for (const value of prepared) {
      const existing = this.#entries.get(value.token)
      const entry = existing?.kind === value.item.kind
        ? existing
        : created.get(value.token)
      if (entry === undefined) throw new Error("Display item was not materialized")

      if (existing?.kind === value.item.kind) this.#updateEntry(entry, value)
      if (existing !== undefined && existing !== entry) stale.push(existing)
      nextEntries.set(value.token, entry)
      nextNodes.push(entry.node)
    }

    for (const [token, entry] of this.#entries) {
      if (!nextEntries.has(token)) stale.push(entry)
    }

    const geometries = new Set<BufferGeometry>()
    for (const entry of stale) this.#detachEntry(entry, geometries)

    this.#entries = nextEntries
    this.#setRootChildren(nextNodes)
    for (const geometry of geometries) this.#invalidateGeometry(geometry)
    this.#invalidateEvictedTextGeometries()
  }

  /** Releases every resource owned by this backend. Safe to call repeatedly. */
  public dispose(): void {
    if (this.#disposed) return
    this.#disposed = true

    const geometries = new Set<BufferGeometry>()
    for (const entry of this.#entries.values()) this.#detachEntry(entry, geometries)
    this.#entries.clear()
    this.root.children = []

    for (const geometry of geometries) this.#invalidateGeometry(geometry)
    this.#invalidateEvictedTextGeometries()
  }

  #prepareFrame(frame: RenderFrame): readonly PreparedItem[] {
    assertFiniteNonNegative(frame.viewport.width, "frame.viewport.width")
    assertFiniteNonNegative(frame.viewport.height, "frame.viewport.height")
    assertFinite(frame.revision, "frame.revision")

    const tokens = new Set<DisplayToken>()
    const prepared: PreparedItem[] = []
    for (let index = 0; index < frame.displayList.length; index++) {
      const item = frame.displayList[index]!
      if (!item.key) throw new Error(`Display item at index ${index} requires a non-empty key`)
      const token = this.#tokenFor(item.node, item.key)
      if (tokens.has(token)) throw new Error(`Duplicate display item identity at index ${index}`)
      tokens.add(token)

      const label = `frame.displayList[${index}]`
      assertFinite(item.x, `${label}.x`)
      assertFinite(item.y, `${label}.y`)
      this.#validateTransform(item.transform, `${label}.transform`)

      if (item.kind === "text") {
        if (this.#font === undefined) {
          throw new Error(`Text display item at index ${index} requires RendererWebGpuBackendOptions.font`)
        }
        assertFiniteNonNegative(item.fontSize, `${label}.fontSize`)
        assertFinite(item.letterSpacing, `${label}.letterSpacing`)
        const opacity = assertUnitOpacity(item.opacity, `${label}.opacity`)
        prepared.push(Object.freeze({
          kind: "text",
          item,
          color: parseDisplayColor(item.color || WHITE),
          opacity,
          clips: this.#prepareClips(item.clips, frame, label),
          token,
        }))
      } else if (item.kind === "rect") {
        assertFiniteNonNegative(item.width, `${label}.width`)
        assertFiniteNonNegative(item.height, `${label}.height`)
        prepared.push(this.#prepareRect(item, token, label, frame))
      } else if (item.kind === "image") {
        if (this.#requestPresentation === undefined) {
          throw new Error(
            `Image display item at index ${index} requires RendererWebGpuBackendOptions.requestPresentation`,
          )
        }
        if (typeof item.src !== "string" || item.src === "") {
          throw new Error(`${label}.src must be a non-empty string`)
        }
        assertFinitePositive(item.width, `${label}.width`)
        assertFinitePositive(item.height, `${label}.height`)
        if (item.fit !== "cover" && item.fit !== "contain") {
          throw new Error(`${label}.fit must be cover or contain`)
        }
        prepared.push(Object.freeze({
          kind: "image",
          item,
          boxAspect: item.width / item.height,
          opacity: assertUnitOpacity(item.opacity, `${label}.opacity`),
          clips: this.#prepareClips(item.clips, frame, label),
          token,
        }))
      } else {
        throw new Error(`Unsupported display item kind: ${String((item as {kind?: unknown}).kind)}`)
      }
    }
    return prepared
  }

  #prepareRect(
    item: RectDisplayItem,
    token: DisplayToken,
    label: string,
    frame: RenderFrame,
  ): PreparedRectItem {
    const opacity = assertUnitOpacity(item.opacity, `${label}.opacity`)
    const border = item.border
    if (border === null || typeof border !== "object") {
      throw new TypeError(`${label}.border must be an object`)
    }
    const {top, right, bottom, left} = border.widths
    assertFiniteNonNegative(top, `${label}.border.widths.top`)
    assertFiniteNonNegative(right, `${label}.border.widths.right`)
    assertFiniteNonNegative(bottom, `${label}.border.widths.bottom`)
    assertFiniteNonNegative(left, `${label}.border.widths.left`)
    const {topLeft, topRight, bottomRight, bottomLeft} = border.radii
    assertFiniteNonNegative(topLeft, `${label}.border.radii.topLeft`)
    assertFiniteNonNegative(topRight, `${label}.border.radii.topRight`)
    assertFiniteNonNegative(bottomRight, `${label}.border.radii.bottomRight`)
    assertFiniteNonNegative(bottomLeft, `${label}.border.radii.bottomLeft`)

    const widths = Object.freeze([top, right, bottom, left] as const)
    const uniformWidths = top === right && top === bottom && top === left
    if (!uniformWidths && [topLeft, topRight, bottomRight, bottomLeft].some(radius => radius !== 0)) {
      throw new Error(`${label} has non-uniform border widths with non-zero corner radii`)
    }
    const borderColor = visibleUniformBorderColor(widths, border.colors, label)
    const shadow = prepareRectShadow(item, widths, label)
    return Object.freeze({
      kind: "rect",
      item,
      fill: parseDisplayColor(item.color || WHITE),
      border: borderColor,
      borderWidths: widths,
      radii: Object.freeze([topLeft, topRight, bottomRight, bottomLeft] as const),
      opacity,
      shadow,
      clips: this.#prepareClips(item.clips, frame, label),
      token,
    })
  }

  #prepareClips(
    clips: readonly RenderClip[],
    frame: RenderFrame,
    itemLabel: string,
  ): readonly PreparedClip[] {
    if (!Array.isArray(clips)) throw new TypeError(`${itemLabel}.clips must be an array`)
    if (clips.length === 0) return NO_PREPARED_CLIPS

    const prepared = clips.map((clip, index): PreparedClip => {
      const label = `${itemLabel}.clips[${index}]`
      if (clip === null || typeof clip !== "object") {
        throw new TypeError(`${label} must be an object`)
      }
      assertFinite(clip.x, `${label}.x`)
      assertFinite(clip.y, `${label}.y`)
      assertFiniteNonNegative(clip.width, `${label}.width`)
      assertFiniteNonNegative(clip.height, `${label}.height`)
      if (typeof clip.clipX !== "boolean" || typeof clip.clipY !== "boolean") {
        throw new TypeError(`${label}.clipX and clipY must be booleans`)
      }
      if (!clip.clipX && !clip.clipY) {
        throw new Error(`${label} must clip at least one axis`)
      }
      this.#validateTransform(clip.transform, `${label}.transform`)

      const radii = validateClipRadii(clip, label)
      let circularRadii: readonly [number, number, number, number]
      if (clip.clipX && clip.clipY) {
        const visible = clip.width > 0 && clip.height > 0
        circularRadii = Object.freeze(radii.map((radius, cornerIndex) => {
          if (visible && radius.x !== radius.y) {
            throw new Error(
              `${label}.radii[${cornerIndex}] is elliptical and unsupported by PresentationClipShape`,
            )
          }
          return visible ? radius.x : 0
        }) as [number, number, number, number])
      } else {
        if (radii.some(({x, y}) => x !== 0 || y !== 0)) {
          throw new Error(`${label} has corner radii on a partial-axis clip`)
        }
        circularRadii = Object.freeze([0, 0, 0, 0])
      }

      const transform = partialClipTransform(clip)
      const x = clip.clipX ? clip.x : 0
      const y = clip.clipY ? clip.y : 0
      const width = clip.clipX ? clip.width : frame.viewport.width
      const height = clip.clipY ? clip.height : frame.viewport.height
      return Object.freeze({
        x,
        y,
        width,
        height,
        radii: circularRadii,
        transform,
      })
    })
    return Object.freeze(prepared)
  }

  #validateTransform(transform: RenderTransform, label: string): void {
    if (transform === null || typeof transform !== "object") {
      throw new TypeError(`${label} must be an object`)
    }
    assertFinite(transform.scaleX, `${label}.scaleX`)
    assertFinite(transform.scaleY, `${label}.scaleY`)
    assertFinite(transform.translateX, `${label}.translateX`)
    assertFinite(transform.translateY, `${label}.translateY`)
  }

  #createEntry(value: PreparedItem): RetainedEntry {
    if (value.kind === "rect") return this.#createRect(value)
    if (value.kind === "text") return this.#createText(value)
    return this.#createImage(value)
  }

  #createRect(value: PreparedRectItem): RectEntry {
    const {item} = value
    const geometryWidth = value.shadow?.geometryWidth ?? item.width
    const geometryHeight = value.shadow?.geometryHeight ?? item.height
    const geometry = new PlaneGeometry({width: geometryWidth, height: geometryHeight})
    const material = new RoundedRectMaterial({
      width: item.width,
      height: item.height,
      radius: radiiParameters(value.radii),
      fill: value.fill,
      border: value.border,
      borderWidths: value.borderWidths,
      opacity: value.opacity,
      shadowBlur: value.shadow?.blurRadius ?? 0,
      shadowSpread: value.shadow?.spreadRadius ?? 0,
    })
    const node = new Mesh(geometry, material)
    node.name = `${item.node.nodeName}:${item.key}`
    const entry: RectEntry = {
      kind: "rect",
      node,
      geometry,
      material,
      width: geometryWidth,
      height: geometryHeight,
      clipSpaces: [],
    }
    this.#updateClips(entry, value.clips)
    positionPlane(node, item)
    return entry
  }

  #createText(value: PreparedTextItem): TextEntry {
    const {item} = value
    if (this.#font === undefined) throw new Error("Text display item requires a font")
    const material = new TextMaterial({color: value.color, opacity: value.opacity})
    const node = new CachedText(item.text, this.#font, item.fontSize, material)
    if (node.letterSpacing !== item.letterSpacing) {
      node.letterSpacing = item.letterSpacing
      node.updateGeometry()
    }
    node.name = `${item.node.nodeName}:${item.key}`
    const entry: TextEntry = {
      kind: "text",
      node,
      material,
      text: item.text,
      fontSize: item.fontSize,
      letterSpacing: item.letterSpacing,
      clipSpaces: [],
    }
    this.#updateClips(entry, value.clips)
    positionText(node, item)
    return entry
  }

  #createImage(value: PreparedImageItem): ImageEntry {
    const {item} = value
    const geometry = new PlaneGeometry({width: item.width, height: item.height})
    const material = new ImageMaterial({
      src: item.src,
      fit: item.fit,
      boxAspect: value.boxAspect,
      opacity: value.opacity,
    })
    const node = new Mesh(geometry, material)
    const entry: ImageEntry = {
      kind: "image",
      node,
      geometry,
      material,
      src: item.src,
      width: item.width,
      height: item.height,
      clipSpaces: [],
    }
    material.onTextureChange = this.#textureChangeCallback(value.token, item.src)
    node.name = `${item.node.nodeName}:${item.key}`
    this.#updateClips(entry, value.clips)
    positionPlane(node, item)
    return entry
  }

  #updateEntry(entry: RetainedEntry, value: PreparedItem): void {
    if (entry.kind === "rect" && value.kind === "rect") {
      const geometryWidth = value.shadow?.geometryWidth ?? value.item.width
      const geometryHeight = value.shadow?.geometryHeight ?? value.item.height
      if (entry.width !== geometryWidth || entry.height !== geometryHeight) {
        resizePlane(entry.geometry, geometryWidth, geometryHeight)
        entry.width = geometryWidth
        entry.height = geometryHeight
      }
      entry.material.width = value.item.width
      entry.material.height = value.item.height
      entry.material.fill.copy(value.fill)
      entry.material.border.copy(value.border)
      entry.material.borderWidths = value.borderWidths
      copyRadii(entry.material.radii, value.radii)
      entry.material.opacity = value.opacity
      entry.material.shadowBlur = value.shadow?.blurRadius ?? 0
      entry.material.shadowSpread = value.shadow?.spreadRadius ?? 0
      this.#updateClips(entry, value.clips)
      positionPlane(entry.node, value.item)
      return
    }

    if (entry.kind === "text" && value.kind === "text") {
      if (
        entry.text !== value.item.text ||
        entry.fontSize !== value.item.fontSize ||
        entry.letterSpacing !== value.item.letterSpacing
      ) {
        entry.node.text = value.item.text
        entry.node.fontSize = value.item.fontSize
        entry.node.letterSpacing = value.item.letterSpacing
        entry.node.updateGeometry()
        entry.text = value.item.text
        entry.fontSize = value.item.fontSize
        entry.letterSpacing = value.item.letterSpacing
      }
      entry.material.color.copy(value.color)
      entry.material.opacity = value.opacity
      this.#updateClips(entry, value.clips)
      positionText(entry.node, value.item)
      return
    }

    if (entry.kind === "image" && value.kind === "image") {
      if (entry.width !== value.item.width || entry.height !== value.item.height) {
        resizePlane(entry.geometry, value.item.width, value.item.height)
        entry.width = value.item.width
        entry.height = value.item.height
      }
      if (entry.src !== value.item.src) {
        entry.src = value.item.src
        entry.material.src = value.item.src
        entry.material.onTextureChange = this.#textureChangeCallback(value.token, value.item.src)
      }
      entry.material.fit = value.item.fit
      entry.material.boxAspect = value.boxAspect
      entry.material.opacity = value.opacity
      this.#updateClips(entry, value.clips)
      positionPlane(entry.node, value.item)
      return
    }

    throw new Error("Display item kind mismatch")
  }

  #updateClips(entry: RetainedEntry, clips: readonly PreparedClip[]): void {
    while (entry.clipSpaces.length < clips.length) {
      entry.clipSpaces.push(createRetainedClipSpace(this.root))
    }
    if (entry.clipSpaces.length > clips.length) entry.clipSpaces.length = clips.length
    if (clips.length === 0) {
      entry.node.presentationClips = NO_PRESENTATION_CLIPS
      return
    }
    entry.node.presentationClips = Object.freeze(clips.map((clip, index): PresentationClipShape => {
      const clipSpace = entry.clipSpaces[index]!
      writeEngineTransform(clipSpace.localMatrix, clip.transform)
      return Object.freeze({
        kind: "rounded-rect",
        coordinateSpace: clipSpace.coordinateSpace,
        center: Object.freeze([clip.x + clip.width / 2, -(clip.y + clip.height / 2)] as const),
        halfSize: Object.freeze([clip.width / 2, clip.height / 2] as const),
        radii: clip.radii,
      })
    }))
  }

  #detachEntry(entry: RetainedEntry, geometries: Set<BufferGeometry>): void {
    entry.node.parent?.remove(entry.node)
    entry.node.presentationClips = NO_PRESENTATION_CLIPS
    entry.clipSpaces.length = 0
    entry.node.children = []
    if (entry.kind === "image") {
      entry.material.onTextureChange = undefined
    }
    if (entry.kind === "rect" || entry.kind === "image") geometries.add(entry.geometry)
  }

  #setRootChildren(next: readonly Object3D[]): void {
    const unchanged = this.root.children.length === next.length
      && this.root.children.every((child, index) => child === next[index])
    if (unchanged) return

    const nextSet = new Set(next)
    for (const child of this.root.children) {
      if (!nextSet.has(child) && child.parent === this.root) child.parent = null
    }
    this.root.children = [...next]
    for (const child of next) child.parent = this.root
  }

  #invalidateEvictedTextGeometries(): void {
    for (const geometry of Text.consumeEvictedLayoutGeometries()) {
      this.#invalidateGeometry(geometry)
    }
  }

  #textureChangeCallback(token: DisplayToken, src: string): () => void {
    const owner = new WeakRef(this)
    return () => {
      const backend = owner.deref()
      if (backend !== undefined) backend.#requestTexturePresentation(token, src)
    }
  }

  #requestTexturePresentation(token: DisplayToken, src: string): void {
    if (this.#disposed) return
    const entry = this.#entries.get(token)
    if (entry?.kind !== "image" || entry.src !== src || entry.material.src !== src) return
    this.#requestPresentation?.()
  }

  #tokenFor(node: DisplayNode, key: string): DisplayToken {
    let nodeTokens = this.#tokens.get(node)
    if (nodeTokens === undefined) {
      nodeTokens = new Map()
      this.#tokens.set(node, nodeTokens)
    }
    let token = nodeTokens.get(key)
    if (token === undefined) {
      token = Object.freeze({})
      nodeTokens.set(key, token)
    }
    return token
  }
}

function positionPlane(
  node: Mesh,
  item: Readonly<{
    x: number
    y: number
    width: number
    height: number
    transform: RenderTransform
  }>,
): void {
  const center = applyRenderTransform(
    item.transform,
    item.x + item.width / 2,
    item.y + item.height / 2,
  )
  node.position.set(center.x, -center.y, 0)
  node.scale.set(item.transform.scaleX, item.transform.scaleY, 1)
}

function positionText(node: CachedText, item: TextDisplayItem): void {
  const origin = applyRenderTransform(item.transform, item.x, item.y + item.fontSize)
  node.position.set(origin.x, -origin.y, 0)
  node.scale.set(item.transform.scaleX, item.transform.scaleY, 1)
}

function applyRenderTransform(
  transform: RenderTransform,
  x: number,
  y: number,
): Readonly<{x: number; y: number}> {
  return {
    x: transform.scaleX * x + transform.translateX,
    y: transform.scaleY * y + transform.translateY,
  }
}

function partialClipTransform(clip: RenderClip): RenderTransform {
  if (clip.clipX && clip.clipY) return clip.transform
  return Object.freeze({
    scaleX: clip.clipX ? clip.transform.scaleX : 1,
    scaleY: clip.clipY ? clip.transform.scaleY : 1,
    translateX: clip.clipX ? clip.transform.translateX : 0,
    translateY: clip.clipY ? clip.transform.translateY : 0,
  })
}

function createRetainedClipSpace(root: Object3D): RetainedClipSpace {
  const coordinateSpace = new Object3D()
  const localMatrix = new Matrix4()
  const worldMatrix = new Matrix4()
  coordinateSpace.name = "@zavx0z/renderer-webgpu:clip-space"
  Object.defineProperty(coordinateSpace, "matrixWorld", {
    configurable: false,
    enumerable: true,
    get: () => worldMatrix.multiplyMatrices(root.matrixWorld, localMatrix),
  })
  return {coordinateSpace, localMatrix}
}

function writeEngineTransform(matrix: Matrix4, transform: RenderTransform): void {
  matrix.set(
    transform.scaleX, 0, 0, transform.translateX,
    0, transform.scaleY, 0, -transform.translateY,
    0, 0, 1, 0,
    0, 0, 0, 1,
  )
}

function resizePlane(geometry: PlaneGeometry, width: number, height: number): void {
  const position = geometry.attributes.position
  if (position === undefined || position.array.length !== 12) {
    throw new Error("Engine PlaneGeometry position layout is unsupported")
  }

  const halfWidth = width / 2
  const halfHeight = height / 2
  const values = position.array
  values[0] = -halfWidth
  values[1] = halfHeight
  values[2] = 0
  values[3] = halfWidth
  values[4] = halfHeight
  values[5] = 0
  values[6] = -halfWidth
  values[7] = -halfHeight
  values[8] = 0
  values[9] = halfWidth
  values[10] = -halfHeight
  values[11] = 0
  position.needsUpdate = true
  geometry.boundingSphere = null
}

function radiiParameters(
  radii: readonly [number, number, number, number],
): {tl: number; tr: number; br: number; bl: number} {
  return {tl: radii[0], tr: radii[1], br: radii[2], bl: radii[3]}
}

function copyRadii(
  target: [number, number, number, number],
  source: readonly [number, number, number, number],
): void {
  target[0] = source[0]
  target[1] = source[1]
  target[2] = source[2]
  target[3] = source[3]
}

function validateClipRadii(
  clip: RenderClip,
  label: string,
): readonly [
  RenderClip["radii"]["topLeft"],
  RenderClip["radii"]["topRight"],
  RenderClip["radii"]["bottomRight"],
  RenderClip["radii"]["bottomLeft"],
] {
  if (clip.radii === null || typeof clip.radii !== "object") {
    throw new TypeError(`${label}.radii must be an object`)
  }
  const radii = [
    clip.radii.topLeft,
    clip.radii.topRight,
    clip.radii.bottomRight,
    clip.radii.bottomLeft,
  ] as const
  const names = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const
  for (let index = 0; index < radii.length; index += 1) {
    const radius = radii[index]
    const name = names[index]
    if (radius === null || typeof radius !== "object") {
      throw new TypeError(`${label}.radii.${name} must be an object`)
    }
    assertFiniteNonNegative(radius.x, `${label}.radii.${name}.x`)
    assertFiniteNonNegative(radius.y, `${label}.radii.${name}.y`)
  }
  return radii
}

function visibleUniformBorderColor(
  widths: readonly [number, number, number, number],
  colors: RectDisplayItem["border"]["colors"],
  label: string,
): Color {
  const values = [colors.top, colors.right, colors.bottom, colors.left] as const
  const visible = values.flatMap((value, index) => widths[index]! > 0
    ? [parseDisplayColor(value)]
    : [])
  const first = visible[0]
  if (first === undefined) return new Color(0, 0, 0, 0)
  if (visible.some(color => !sameColor(first, color))) {
    throw new Error(`${label} has non-uniform border colors unsupported by RoundedRectMaterial`)
  }
  return first
}

function prepareRectShadow(
  item: RectDisplayItem,
  borderWidths: readonly [number, number, number, number],
  label: string,
): PreparedRectItem["shadow"] {
  if (item.shadow === null) return null
  if (typeof item.shadow !== "object") throw new TypeError(`${label}.shadow must be an object or null`)
  assertFiniteNonNegative(item.shadow.blurRadius, `${label}.shadow.blurRadius`)
  assertFiniteNonNegative(item.shadow.spreadRadius, `${label}.shadow.spreadRadius`)
  if (item.width <= 0 || item.height <= 0) {
    throw new Error(`${label} analytical shadow requires positive source dimensions`)
  }
  if (borderWidths.some((width) => width !== 0)) {
    throw new Error(`${label} analytical shadow cannot carry border widths`)
  }
  const expansion = item.shadow.blurRadius + item.shadow.spreadRadius
  const geometryWidth = item.width + expansion * 2
  const geometryHeight = item.height + expansion * 2
  assertFinitePositive(geometryWidth, `${label}.shadow.geometryWidth`)
  assertFinitePositive(geometryHeight, `${label}.shadow.geometryHeight`)
  return Object.freeze({
    blurRadius: item.shadow.blurRadius,
    spreadRadius: item.shadow.spreadRadius,
    geometryWidth,
    geometryHeight,
  })
}

function sameColor(left: Color, right: Color): boolean {
  return left.r === right.r && left.g === right.g && left.b === right.b && left.a === right.a
}

function parseDisplayColor(value: string): Color {
  const normalized = value.trim().toLowerCase()
  if (normalized === "transparent") return new Color(0, 0, 0, 0)

  const hex = /^#([0-9a-f]+)$/i.exec(normalized)?.[1]
  if (hex !== undefined) {
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0]! + hex[0]!, 16)
      const g = Number.parseInt(hex[1]! + hex[1]!, 16)
      const b = Number.parseInt(hex[2]! + hex[2]!, 16)
      const a = hex.length === 4 ? Number.parseInt(hex[3]! + hex[3]!, 16) : 255
      return new Color(r / 255, g / 255, b / 255, a / 255)
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255
      return new Color(r / 255, g / 255, b / 255, a / 255)
    }
  }

  const functional = /^(rgb|rgba)\((.*)\)$/.exec(normalized)
  if (functional !== null) {
    const parts = functional[2]!.split(",").map((part) => part.trim())
    const expected = functional[1] === "rgba" ? 4 : 3
    if (parts.length === expected) {
      const r = parseRgbChannel(parts[0]!)
      const g = parseRgbChannel(parts[1]!)
      const b = parseRgbChannel(parts[2]!)
      const a = parts[3] === undefined ? 1 : parseAlphaChannel(parts[3])
      if ([r, g, b, a].every(Number.isFinite)) return new Color(r, g, b, a)
    }
  }

  throw new Error(`Unsupported resolved display color: ${value}`)
}

function parseRgbChannel(value: string): number {
  if (value.endsWith("%")) return clampUnit(Number.parseFloat(value) / 100)
  return clampUnit(Number.parseFloat(value) / 255)
}

function parseAlphaChannel(value: string): number {
  if (value.endsWith("%")) return clampUnit(Number.parseFloat(value) / 100)
  return clampUnit(Number.parseFloat(value))
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`)
}

function assertFiniteNonNegative(value: number, label: string): void {
  assertFinite(value, label)
  if (value < 0) throw new Error(`${label} must be non-negative`)
}

function assertFinitePositive(value: number, label: string): void {
  assertFinite(value, label)
  if (value <= 0) throw new Error(`${label} must be positive`)
}

function assertUnitOpacity(value: number, label: string): number {
  assertFinite(value, label)
  if (value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`)
  return value
}
