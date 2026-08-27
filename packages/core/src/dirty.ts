import type { Node } from "@zavx0z/dom"

export class DirtyTracker {
  readonly #root: Node
  readonly #nodes = new Set<Node>()

  constructor(root: Node) {
    this.#root = root
    this.#nodes.add(root)
  }

  get dirty(): boolean {
    return this.#nodes.size > 0
  }

  invalidate(node: Node): void {
    const path: Node[] = []
    let current: Node | null = node
    while (current) {
      path.push(current)
      if (current === this.#root) {
        for (const candidate of path) this.#nodes.add(candidate)
        return
      }
      current = current.parentNode
    }
    throw new RangeError("Cannot invalidate a node outside the renderer root")
  }

  snapshot(): readonly Node[] {
    return Object.freeze([...this.#nodes])
  }

  clear(): void {
    this.#nodes.clear()
  }
}
