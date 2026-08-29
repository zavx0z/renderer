# Architecture

This repository owns one document rendering pipeline with separately
loadable production packages:

```text
@zavx0z/template/compiler → @zavx0z/template/compiled
                                      ↓
                              @zavx0z/react
                                      ↓
@zavx0z/dom ←─────────────────────────┘
    ↓
@zavx0z/renderer
    ↓
@zavx0z/renderer-webgpu
    ↓
@engine/core
```

`@zavx0z/renderer-browser` is the platform composition root for a browser
canvas. It connects those exact owners, viewport resize, routed camera input,
world document planes and camera-locked document overlays in one Engine frame;
it does not add another semantic or layout tree.

## Semantic DOM

`@zavx0z/dom` is the sole owner of observable HTML DOM identity and behavior:
tree mutation, attributes and reflection, events, focus, and HTML element
state. It has no rendering, CSS layout, Engine, WebGPU, Template, React, or UI
dependency.

## CPU document renderer

`@zavx0z/renderer` consumes one DOM tree and derives computed style, box and
fragment geometry, display items, and hit metadata. CSS, layout, paint, input,
and compositor modules are internal stages of this one engine rather than
independent public trees.

The semantic DOM remains stable while derived stages may be replaced. One
semantic node may create zero, one, or several boxes and display items. A
display item is retained by the composite identity `(node, key)`, never by its
array position.

## WebGPU backend

`@zavx0z/renderer-webgpu` consumes the abstract display list and owns only its
retained Engine/WebGPU realization. It does not own DOM, CSS, HTML control, or
authoring semantics.

Compatible consecutive Rect display items are reduced here, never inside a
component: the backend maps stable `(node, key)` identities into Engine
`InstanceLayer` slots and emits shared-unit-quad `InstancedRoundedRect` runs.
Clip, overlap, unsupported policy and non-Rect items remain explicit scalar
barriers, preserving the immutable display list and CPU hit metadata as the
only semantic and interaction owners.

## Authoring boundary

Imperative DOM, templates, custom elements, and optional framework adapters all
mutate the same DOM. Consumer code never receives a render surface, manual
rectangle, Engine object, or materializer function.

npm React, `react-reconciler`, Fiber and a persistent virtual DOM are not part
of this workspace. `@zavx0z/react` owns the scheduler/hooks runtime;
`@zavx0z/template/compiler` lowers familiar component syntax to the shared
Template ABI and direct semantic-DOM mount/update operations. Neither may add
another render or layout tree.

`@zavx0z/dom-devtools` assigns stable realm-local IDs and exposes immutable
serializable DOM/render snapshots plus compact mutation signals. It is the
foundation for an AI inspector or custom DevTools panel. It deliberately does
not claim Chrome Elements integration: Blink alone owns CDP `BackendNodeId`.

## Migration boundary

The former root `compile/evaluate/ResolvedTree/RenderHost/replaceChildren`
implementation was removed after external-source zero-import proof and the new
semantic, layout, visual, interaction, delivery, identity, and performance
gates passed. It has no compatibility export or alternate runtime path.

Generic Layout and `@ui/elements` were retired after their production consumers
reached zero imports. They have no compatibility aliases or alternate runtime
path in the new graph. The unrelated `@nodes/layout` domain package remains the
Node owner's numeric layout and routing boundary.

## External Storybook ownership

Renderer publishes no Storybook package or dependency. The root
`.storybook/manifest.json` declares a project and `@zavx0z/dom` owns pure JSON
catalog data, static owner stories and a structural `storybook-runtime/1`
adapter under `packages/dom/.storybook`. The external Storybook tool owns the
single server, Workbench, routing, package revisions and browser tabs.

The 91 migrated DOM/Elements leaves retain their exact former paths. Interface
and standard-element stories import only the exact production DOM owner; UI
components, navigation and package lifecycle do not enter Renderer.
