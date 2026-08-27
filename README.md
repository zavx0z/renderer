# Document renderer

This workspace is the clean document-engine replacement for the historical
`@zavx0z/renderer` experiment.

## Packages

- `@zavx0z/dom` — lean observable HTML DOM semantics.
- `@zavx0z/renderer` — CSS, layout, paint, display-list, and hit projection.
- `@zavx0z/renderer-webgpu` — retained Engine/WebGPU realization.
- `@zavx0z/renderer-browser` — browser canvas/input/lifecycle composition.
- `@zavx0z/dom-react` — optional React 19 mutation renderer into the same DOM.
- `@zavx0z/dom-devtools` — serializable custom-panel and AI inspection bridge.

Consumer authoring uses HTML, CSS, and DOM APIs. Manual surfaces, rectangles,
materializers, Engine objects, and GPU resources are backend implementation
details.

## Development

```bash
bun install
bun run check
```

The former root `compile/evaluate/ResolvedTree/RenderHost/replaceChildren`
experiment has been deleted. The workspace packages above are now the only
renderer implementation and public contract in this repository. Generic Layout
and `@ui/elements` have been retired after their consumers reached the recorded
zero-import gates; `@nodes/layout` remains a separate Node-domain package.

See [ARCHITECTURE.md](ARCHITECTURE.md), [requirements.md](requirements.md),
[MIGRATION.md](MIGRATION.md), and the exact implemented web-platform boundary
in [packages/dom/SUPPORT.md](packages/dom/SUPPORT.md). Reproducible baseline
commands and current open budgets are in [PERFORMANCE.md](PERFORMANCE.md).
The standards/project comparison and the React/DevTools consequences are in
[RESEARCH.md](RESEARCH.md).
