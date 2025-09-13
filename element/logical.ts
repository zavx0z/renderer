// import type { Update, Values } from "@zavx0z/context"
// import type { Core, NodeLogical, State } from "@zavx0z/template"
// import type { Node as NodeTemplate } from "@zavx0z/template"
// import { collect } from "../data"

// export const Logical = (
//   context: Values<any>,
//   update: Update<any>,
//   core: Core,
//   state: State,
//   node: NodeLogical,
//   itemScope: NodeTemplate | undefined
// ) => {
//     const ok = evalBool(
//         node.expr ?? "false",
//         collect(core, context, state, node.data, itemScope)
//       )
//       if (ok) {
//         const frag = document.createDocumentFragment()
//         for (const c of node.child ?? []) {
//           const dom = this.toDOM(c, itemScope)
//           if (dom) frag.appendChild(dom)
//         }
//         return frag
//       }
//       return null
// }