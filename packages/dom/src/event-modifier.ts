import type {UIEventInit} from "./ui-event.ts"

export type EventModifierInit = UIEventInit & Readonly<{
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  modifierAltGraph?: boolean
  modifierCapsLock?: boolean
  modifierFn?: boolean
  modifierFnLock?: boolean
  modifierHyper?: boolean
  modifierNumLock?: boolean
  modifierScrollLock?: boolean
  modifierSuper?: boolean
  modifierSymbol?: boolean
  modifierSymbolLock?: boolean
}>

export type ExtendedModifier =
  | "AltGraph"
  | "CapsLock"
  | "Fn"
  | "FnLock"
  | "Hyper"
  | "NumLock"
  | "ScrollLock"
  | "Super"
  | "Symbol"
  | "SymbolLock"

export type ModifierKeys = Readonly<{
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}>

const extendedModifierInitializers: readonly [ExtendedModifier, keyof EventModifierInit][] = [
  ["AltGraph", "modifierAltGraph"],
  ["CapsLock", "modifierCapsLock"],
  ["Fn", "modifierFn"],
  ["FnLock", "modifierFnLock"],
  ["Hyper", "modifierHyper"],
  ["NumLock", "modifierNumLock"],
  ["ScrollLock", "modifierScrollLock"],
  ["Super", "modifierSuper"],
  ["Symbol", "modifierSymbol"],
  ["SymbolLock", "modifierSymbolLock"]
]

export function createExtendedModifiers(init: EventModifierInit): ReadonlySet<ExtendedModifier> | null {
  let modifiers: Set<ExtendedModifier> | null = null
  for (const [name, initializer] of extendedModifierInitializers) {
    if (!init[initializer]) continue
    modifiers ??= new Set()
    modifiers.add(name)
  }
  return modifiers
}

export function readModifierState(
  keys: ModifierKeys,
  extendedModifiers: ReadonlySet<ExtendedModifier> | null,
  keyArg: string
): boolean {
  switch (String(keyArg)) {
    case "Alt": return keys.altKey
    case "Control": return keys.ctrlKey
    case "Meta": return keys.metaKey
    case "Shift": return keys.shiftKey
    default: return extendedModifiers?.has(keyArg as ExtendedModifier) ?? false
  }
}
