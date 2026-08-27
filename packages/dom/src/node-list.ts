import type {Node} from "./node.ts"
import {toLong} from "./internal/web-idl.ts"

const constructionKey = Symbol("NodeList construction")

export class NodeList<NodeType extends Node = Node> implements Iterable<NodeType> {
  readonly [index: number]: NodeType
  readonly #snapshot: readonly NodeType[]

  constructor(nodes?: readonly NodeType[], key?: symbol) {
    if (key !== constructionKey || !nodes) throw new TypeError("Illegal constructor")
    this.#snapshot = Object.freeze([...nodes])
    for (let index = 0; index < this.#snapshot.length; index += 1) {
      Object.defineProperty(this, index, {
        configurable: false,
        enumerable: true,
        value: this.#snapshot[index],
        writable: false
      })
    }
    Object.freeze(this)
  }

  get length(): number {
    return this.#snapshot.length
  }

  item(index: number): NodeType | null {
    return this.#snapshot[toLong(Number(index), 32, true)] ?? null
  }

  entries(): ArrayIterator<[number, NodeType]> {
    return this.#snapshot.entries()
  }

  forEach(
    callback: (value: NodeType, key: number, parent: NodeList<NodeType>) => void,
    thisArg?: unknown
  ): void {
    for (let index = 0; index < this.#snapshot.length; index += 1) {
      callback.call(thisArg, this.#snapshot[index]!, index, this)
    }
  }

  keys(): ArrayIterator<number> {
    return this.#snapshot.keys()
  }

  values(): ArrayIterator<NodeType> {
    return this.#snapshot.values()
  }

  [Symbol.iterator](): ArrayIterator<NodeType> {
    return this.values()
  }
}

export function createStaticNodeList<NodeType extends Node>(nodes: readonly NodeType[]): NodeList<NodeType> {
  return new NodeList(nodes, constructionKey)
}
