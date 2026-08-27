# `@zavx0z/dom-react`

Optional React 19 authoring for the lean `@zavx0z/dom` realm.

```ts
import {createDocument} from "@zavx0z/dom"
import {createRoot} from "@zavx0z/dom-react"
import {createElement} from "react"

const document = createDocument()
const container = document.createDocumentFragment()
const root = createRoot(container)

root.render(createElement("button", {title: "Output"}, "Output"))
```

The resulting button is the same `HTMLButtonElement` instance that the CPU
renderer and native DOM event API consume. React is an authoring adapter, not a
second runtime tree.

The adapter is pinned to `react-reconciler@0.33.0`. React's own
[`react-reconciler` README](https://github.com/facebook/react/blob/v19.2.0/packages/react-reconciler/README.md)
marks this API experimental, so reconciler upgrades require an explicit host
contract review and focused tests.
