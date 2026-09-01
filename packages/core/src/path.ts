import type {
  RenderPathBounds,
  RenderPathCubic,
  RenderPathGeometry,
  RenderPathPoint,
  RenderPathSegment,
} from "./types.ts"
import {VECTOR_PATH_COORDINATE_LIMIT} from "@zavx0z/dom"

const CURVE_STEPS = 6
const EPSILON = 1e-6
const MAX_SOURCE_LENGTH = 65_536
const MAX_TOKENS = 2_048
const MAX_CUBICS = 256
const TOKEN = /[MLQC]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g

type PathToken = string | number

/** Parses the bounded absolute, open `M/L/Q/C` project path grammar. */
export function parseRenderPath(source: string): RenderPathGeometry | null {
  if (source.length > MAX_SOURCE_LENGTH) return null
  const tokens = tokenizePath(source)
  if (tokens === null || tokens.length < 4 || tokens[0] !== "M") return null
  let index = 1
  const startX = numberAt(tokens, index++)
  const startY = numberAt(tokens, index++)
  if (startX === null || startY === null) return null
  let cursor = point(startX, startY)
  const cubics: RenderPathCubic[] = []

  while (index < tokens.length) {
    const command = tokens[index++]
    if (typeof command !== "string" || command === "M") return null
    if (command === "L") {
      const x = numberAt(tokens, index++)
      const y = numberAt(tokens, index++)
      if (x === null || y === null) return null
      const to = point(x, y)
      appendCubic(cubics, lineCubic(cursor, to))
      if (cubics.length > MAX_CUBICS) return null
      cursor = to
      continue
    }
    if (command === "Q") {
      const controlX = numberAt(tokens, index++)
      const controlY = numberAt(tokens, index++)
      const toX = numberAt(tokens, index++)
      const toY = numberAt(tokens, index++)
      if (controlX === null || controlY === null || toX === null || toY === null) return null
      const control = point(controlX, controlY)
      const to = point(toX, toY)
      appendCubic(cubics, Object.freeze({
        from: cursor,
        control1: lerp(cursor, control, 2 / 3),
        control2: lerp(to, control, 2 / 3),
        to,
      }))
      if (cubics.length > MAX_CUBICS) return null
      cursor = to
      continue
    }
    if (command === "C") {
      const control1X = numberAt(tokens, index++)
      const control1Y = numberAt(tokens, index++)
      const control2X = numberAt(tokens, index++)
      const control2Y = numberAt(tokens, index++)
      const toX = numberAt(tokens, index++)
      const toY = numberAt(tokens, index++)
      if (
        control1X === null || control1Y === null ||
        control2X === null || control2Y === null ||
        toX === null || toY === null
      ) return null
      const to = point(toX, toY)
      appendCubic(cubics, Object.freeze({
        from: cursor,
        control1: point(control1X, control1Y),
        control2: point(control2X, control2Y),
        to,
      }))
      if (cubics.length > MAX_CUBICS) return null
      cursor = to
      continue
    }
    return null
  }

  if (cubics.length === 0) return null
  const segments = sampleCubics(cubics)
  if (segments.length === 0) return null
  if (segments.some(({from, to}) => !finitePoint(from) || !finitePoint(to))) return null
  const bounds = segmentBounds(segments)
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) return null
  return Object.freeze({
    cubics: Object.freeze(cubics),
    segments,
    bounds,
  })
}

function tokenizePath(source: string): readonly PathToken[] | null {
  const tokens: PathToken[] = []
  let end = 0
  TOKEN.lastIndex = 0
  for (let match = TOKEN.exec(source); match !== null; match = TOKEN.exec(source)) {
    if (!/^[\s,]*$/.test(source.slice(end, match.index))) return null
    const token = match[0]!
    if (/^[MLQC]$/.test(token)) tokens.push(token)
    else {
      const number = Number(token)
      if (!Number.isFinite(number)) return null
      tokens.push(number)
    }
    if (tokens.length > MAX_TOKENS) return null
    end = TOKEN.lastIndex
  }
  if (!/^[\s,]*$/.test(source.slice(end))) return null
  return Object.freeze(tokens)
}

function numberAt(tokens: readonly PathToken[], index: number): number | null {
  const value = tokens[index]
  return typeof value === "number" && Math.abs(value) <= VECTOR_PATH_COORDINATE_LIMIT
    ? value
    : null
}

function point(x: number, y: number): RenderPathPoint {
  return Object.freeze({x, y})
}

function lerp(from: RenderPathPoint, to: RenderPathPoint, amount: number): RenderPathPoint {
  return point(
    from.x * (1 - amount) + to.x * amount,
    from.y * (1 - amount) + to.y * amount,
  )
}

function finitePoint(value: RenderPathPoint): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y)
}

function lineCubic(from: RenderPathPoint, to: RenderPathPoint): RenderPathCubic {
  return Object.freeze({
    from,
    control1: lerp(from, to, 1 / 3),
    control2: lerp(from, to, 2 / 3),
    to,
  })
}

function appendCubic(output: RenderPathCubic[], cubic: RenderPathCubic): void {
  if (
    distanceSquared(cubic.from, cubic.control1) <= Number.EPSILON &&
    distanceSquared(cubic.from, cubic.control2) <= Number.EPSILON &&
    distanceSquared(cubic.from, cubic.to) <= Number.EPSILON
  ) return
  output.push(cubic)
}

function sampleCubics(cubics: readonly RenderPathCubic[]): readonly RenderPathSegment[] {
  const output: RenderPathSegment[] = []
  for (const cubic of cubics) {
    const steps = isLineCubic(cubic) ? 1 : CURVE_STEPS
    let from = cubic.from
    for (let index = 1; index <= steps; index += 1) {
      const to = cubicPoint(cubic, index / steps)
      if (distanceSquared(from, to) > Number.EPSILON) {
        output.push(Object.freeze({from, to}))
      }
      from = to
    }
  }
  return Object.freeze(output)
}

function isLineCubic(cubic: RenderPathCubic): boolean {
  const expected1 = lerp(cubic.from, cubic.to, 1 / 3)
  const expected2 = lerp(cubic.from, cubic.to, 2 / 3)
  return distanceSquared(cubic.control1, expected1) <= EPSILON * EPSILON &&
    distanceSquared(cubic.control2, expected2) <= EPSILON * EPSILON
}

function cubicPoint(cubic: RenderPathCubic, amount: number): RenderPathPoint {
  const inverse = 1 - amount
  return point(
    inverse ** 3 * cubic.from.x +
      3 * inverse ** 2 * amount * cubic.control1.x +
      3 * inverse * amount ** 2 * cubic.control2.x +
      amount ** 3 * cubic.to.x,
    inverse ** 3 * cubic.from.y +
      3 * inverse ** 2 * amount * cubic.control1.y +
      3 * inverse * amount ** 2 * cubic.control2.y +
      amount ** 3 * cubic.to.y,
  )
}

function distanceSquared(left: RenderPathPoint, right: RenderPathPoint): number {
  const x = right.x - left.x
  const y = right.y - left.y
  return x * x + y * y
}

function segmentBounds(segments: readonly RenderPathSegment[]): RenderPathBounds {
  let minimumX = Number.POSITIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  for (const {from, to} of segments) {
    minimumX = Math.min(minimumX, from.x, to.x)
    minimumY = Math.min(minimumY, from.y, to.y)
    maximumX = Math.max(maximumX, from.x, to.x)
    maximumY = Math.max(maximumY, from.y, to.y)
  }
  return Object.freeze({
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  })
}
