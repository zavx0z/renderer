import type {Event} from "../event.ts"

export const buttonActivationBehavior: unique symbol = Symbol("button activation behavior")

export interface ButtonActivationTarget {
  [buttonActivationBehavior](event: Event): void
}
