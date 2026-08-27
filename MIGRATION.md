# Clean document-engine migration

The old root Renderer contour has been removed after its replacement and
external-source zero-import gates passed. Generic Layout and `@ui/elements`
were also retired after their consumer zero-import gates passed. The final
pipeline is `@zavx0z/dom` → `@zavx0z/renderer` →
`@zavx0z/renderer-webgpu` → `@engine/core`; no compatibility exports were
introduced.

## Slice 1 — semantic and static visual root

```text
Document → HTMLDivElement / HTMLSpanElement / Text
→ CSS block/Flex → display list → retained WebGPU
```

Gates:

- stable DOM identity and tree mutation;
- exact absent/empty/value attribute behavior;
- deterministic layout and display list;
- retained backend identity on an unchanged frame;
- package typechecks and focused tests.

## Slice 2 — interaction

```text
HTMLButtonElement → title → capture/target/bubble → default action
```

Gates:

- disabled and activation semantics;
- hit-to-owner mapping;
- no stale hit, listener, or retained resource after removal;
- viewport-edge tooltip behavior in the UI integration.

## Slice 3 — authoring

Template bindings and optional framework hosts mutate the same DOM through one
transaction boundary. A binding update must not rebuild unaffected semantic
nodes or derived resources.

The React adapter uses the same boundary through `createRoot(container)` and
retains host instances across keyed updates. React DevTools may attach through
the reconciler hook; browser Elements/CSS panels still require a separate
engine bridge because these nodes are not Blink backend nodes.

## Slice 4 — product integration

Components and HUD become DOM/CSS compositions. Inspector proves controlled
state, scrolling, source documents, interaction, visual reference, and browser
delivery through the new engine.

## Cutover

The historical root Renderer, `@layout/core`, and `@ui/elements` are removed.
Their cutovers required:

- production graph contains zero imports of their old APIs;
- replacement semantic, renderer, backend, UI, and consumer checks pass;
- combined bundle contains exactly one DOM and Engine identity;
- clean and transform-only frame performance gates pass;
- no dirty linked checkout is presented as accepted integration.

`@nodes/layout` is not part of the retired generic Layout contour; it remains
the Node-owned domain package for numeric placement and routing.
