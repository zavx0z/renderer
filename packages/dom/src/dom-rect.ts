export type DOMRectInit = Readonly<{
  x?: number
  y?: number
  width?: number
  height?: number
}>

/** Immutable finite rectangle used by renderer-backed geometry reads. */
export class DOMRectReadOnly {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number

  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = finiteNumber(x, "x")
    this.y = finiteNumber(y, "y")
    this.width = finiteNumber(width, "width")
    this.height = finiteNumber(height, "height")
    Object.freeze(this)
  }

  get top(): number {
    return Math.min(this.y, this.y + this.height)
  }

  get right(): number {
    return Math.max(this.x, this.x + this.width)
  }

  get bottom(): number {
    return Math.max(this.y, this.y + this.height)
  }

  get left(): number {
    return Math.min(this.x, this.x + this.width)
  }

  toJSON(): Readonly<{
    x: number
    y: number
    width: number
    height: number
    top: number
    right: number
    bottom: number
    left: number
  }> {
    return Object.freeze({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      top: this.top,
      right: this.right,
      bottom: this.bottom,
      left: this.left
    })
  }
}

const finiteNumber = (value: number, label: string): number => {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new RangeError(`${label} must be finite`)
  return number
}
