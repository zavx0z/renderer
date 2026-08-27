import {domError} from "./errors.ts"

export type TextSelectionDirection = "forward" | "backward" | "none"

export type TextSelection = Readonly<{
  start: number
  end: number
  direction: TextSelectionDirection
}>

export const EMPTY_TEXT_SELECTION: TextSelection = Object.freeze({
  start: 0,
  end: 0,
  direction: "none",
})

export function textSelection(
  valueLength: number,
  startValue: number,
  endValue: number,
  directionValue: string = "none",
): TextSelection {
  const length = Math.max(0, Math.trunc(valueLength))
  let start = selectionIndex(startValue, length)
  const end = selectionIndex(endValue, length)
  if (end < start) start = end
  return Object.freeze({
    start,
    end,
    direction: selectionDirection(directionValue),
  })
}

export function selectionDirection(value: string): TextSelectionDirection {
  const direction = String(value)
  if (direction === "forward" || direction === "backward" || direction === "none") {
    return direction
  }
  return "none"
}

export function sameTextSelection(left: TextSelection, right: TextSelection): boolean {
  return left.start === right.start &&
    left.end === right.end &&
    left.direction === right.direction
}

export function assertSelectionApplies(applies: boolean): void {
  if (!applies) throw domError("InvalidStateError", "Text selection does not apply to this input type")
}

const selectionIndex = (value: number, maximum: number): number => {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(maximum, Math.trunc(number)))
}
