import type { Core, Node, State } from "@zavx0z/template"
import type { Values, Update } from "@zavx0z/context"

export class Renderer {
  constructor(
    target:HTMLElement,
    nodes: Node[],
    context: Values<any>,
    update: Update<any>,
    state: State,
    core: Core,
  ) {}
  update({ context, state }: { context?: Partial<Values<any>>; state?: State }) {}
}
