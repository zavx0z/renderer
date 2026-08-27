# Web-platform support boundary

`@zavx0z/dom` uses the standard public names and observable contracts for the
subset it implements. Consumers import the realm explicitly:

```ts
import {Document, HTMLElement, HTMLButtonElement} from "@zavx0z/dom"
```

The package does not replace browser globals and does not claim structural
assignability to the browser's complete `lib.dom.d.ts`. This prevents an API
that is not implemented yet from appearing type-safe by accident.

## Implemented runtime interfaces

| Family | Interfaces | Current boundary |
|---|---|---|
| Tree | `EventTarget`, `Node`, `Document`, `DocumentFragment` | Stable identity, ordered mutation, adoption, connected state, ParentNode and ChildNode convenience mutation |
| Data | `CharacterData`, `Text`, `Comment` | Live data, `textContent`, mutation records and invisible comment anchors |
| Collections | `NodeList`, `DOMTokenList` | Static query snapshots and lazy reflected class tokens; no live collection claim |
| Elements | `Element`, `HTMLElement` | String attributes, `id`, `className`, `classList`, selector subset, `title`, `tabIndex`, focus, blur, lazy requested scroll offsets and bounded Auto/Manual popover visibility |
| HTML | `HTMLDivElement`, `HTMLSpanElement`, `HTMLButtonElement`, `HTMLInputElement`, `HTMLImageElement`, `HTMLSelectElement`, `HTMLOptionElement`, `HTMLProgressElement`, `HTMLMeterElement`, `HTMLTextAreaElement`, `HTMLLabelElement`, `HTMLFieldSetElement`, `HTMLLegendElement`, `HTMLUListElement`, `HTMLLIElement`, `HTMLHeadingElement`, `HTMLParagraphElement`, `HTMLTableElement`, `HTMLTableSectionElement`, `HTMLTableRowElement`, `HTMLTableCellElement` | Exact prototypes plus form-control live value/checked/selection state, checkbox/radio click activation, reflected image author attributes, normalized gauges, label resolution, bounded fieldset disabledness and bounded table-cell reflection |
| Events | `Event`, `CustomEvent`, `ToggleEvent`, `UIEvent`, `FocusEvent`, `MouseEvent`, `PointerEvent`, `WheelEvent`, `KeyboardEvent`, `InputEvent`, `CompositionEvent` | Capture/target/bubble, cancellation and practical toggle, pointer, wheel, keyboard, text-input and composition data; host input remains responsible for external native keyboard/IME projection |
| Renderer adapters | `Document.transaction`, `Document.subscribeMutations`, `Document.subscribeStateChanges`, `getPopoverVisibilityState` | Separate synchronous mutation, scroll-request, input-live-state and popover-visibility channels, deliberately distinct from `MutationObserver` |

Every omitted member is unsupported. The package never installs a stub that
silently returns a fabricated value.

`@zavx0z/renderer-browser` owns the optional native browser text-entry host for
implemented text-like input/textarea value and selection APIs. The semantic DOM
itself still creates no browser proxy, editing loop or platform event.

## Not implemented yet

- parsing, serialization, `DOMParser`, `XMLSerializer` and `innerHTML`;
- `Window`, browsing contexts, navigation, history, storage and networking;
- namespaces, `DocumentType`, `Attr`, `NamedNodeMap`, `Range` and `Selection`;
- `MutationObserver`, Shadow DOM, slots, custom elements and `ElementInternals`;
- selector lists, combinators other than descendant, pseudo-selectors, namespaces and CSS escapes;
- live `NodeList`, `HTMLCollection`, `dataset` and CSSOM;
- scroll layout metrics, range clamping, smooth scrolling and synthesized scroll lifecycle events;
- `:popover-open`, Hint mode/stacks, light dismiss, close watchers,
  invoker/command attributes, implicit anchors, focus restoration and
  accessibility projection; the renderer already owns bounded showing
  popover top-layer paint/order;
- forms, validation, editing, clipboard, drag-and-drop and accessibility tree;
- select form submission/validity/reset, optgroup, selectedcontent and live `HTMLOptionsCollection`;
- image URL resolution, fetching, decoding, load/error events, currentSrc, complete and intrinsic metrics;
- textarea caret paint/geometry, textLength, hard-wrap submission, validity, form and remaining native editing APIs;
- label activation/reverse labels and fieldset elements/form/validity/reset APIs;
- table collections, caption/section helpers, row/cell insertion algorithms,
  cell indices, table-model/header assignment, list numbering and legacy
  presentation reflections;
- numeric `stepUp`/`stepDown`, picker UI, non-text input selection/caret paint, range geometry and the remaining input-type sanitizers;
- complete native key-layout mapping, DOM `setPointerCapture`, sequential
  focus navigation and the remaining editing/IME host behavior; browser wheel,
  pointer and implemented text-input proxy paths already use the same events;
- the remaining specialized `HTML*Element` interfaces.

Those are implementation backlog, not reasons to add a second semantic tree.
New support extends this prototype chain and the same mutation/event boundary.

## Compatibility consequences

- ordinary application logic that uses an implemented DOM member is portable;
- `react-dom` cannot target this realm because it owns the browser host config;
  an optional React custom renderer must map React mutations to this same DOM;
- browser DevTools Elements/CSS panels inspect Blink backend node identifiers,
  so exact interface names alone cannot register these JavaScript nodes there;
  engine inspection needs an explicit DevTools bridge or custom panel;
- TypeScript interfaces and prototype methods add no per-instance fields. Rare
  attributes, listeners, `classList`, focus, input state and pointer samples
  allocate only when used. Scroll state is also external and lazy; returning to
  `(0, 0)` releases it. Query results allocate explicit static snapshots.
