# Web-realm support matrix

This package is a bounded compatibility realm, not an implementation of the
complete web platform or `lib.dom.d.ts`. “Supported” below means routed to the
same semantic Document or deliberately delegated to the supplied native host.
Everything else is unsupported and must not silently fall through to the
browser Document.

## Runtime bindings

| Family | Status | Owner and boundary |
|---|---|---|
| `window`, `self`, `globalThis` | Supported facade | Same read-only `WebRealmWindow`, scoped to one semantic Document; not the native WindowProxy |
| `document` | Supported semantic | Exact `@zavx0z/dom` Document supplied to `createWebRealm()` |
| DOM/event constructors | Supported subset | Exact constructors listed by `@zavx0z/dom`; see `../dom/SUPPORT.md` for members |
| `Window` | Bounded identity | `WebRealmWindow`; illegal constructor, no browsing-context ownership |
| URL and navigation | Host delegated | `URL`, `URLSearchParams`, `location`, `history` from the supplied platform host |
| Native capabilities | Host delegated | `navigator` (including host `gpu`/`xr`), `performance`, `crypto`, `console`, `devicePixelRatio` |
| Network and scheduling | Host delegated | `fetch`, timeout/interval functions, `queueMicrotask`, request/cancelAnimationFrame; functions stay bound to the host |
| `getComputedStyle(element)` | Renderer backed | Immutable supported computed cascade for an Element in this realm; no pseudo-elements or writable CSSOM |
| `Element.getBoundingClientRect()` | Renderer backed | One transformed axis-aligned border box as immutable `DOMRectReadOnly`; detached/unpainted returns zero rect |
| Unknown Window members | Unsupported | Absent from `in`; reads throw `NotSupportedError`; facade mutation throws |

The computed-style view currently serializes the renderer subset: display,
box sizing, positioning offsets and sizes, min/max sizes, margin, padding,
border widths/colors/radii, background/color, font size, line height, letter
spacing, opacity, overflow, scrollbar width, object fit, text alignment and
overflow, white space, z-index, bounded flex properties, gap, axis-aligned
transform/origin and one box shadow. Unknown properties throw instead of
returning an empty string. The object is a snapshot of that read; a later read
flushes and returns current renderer state.

An element skipped below a `display:none` or renderer-replaced control subtree
has no current renderer computed-style record, so a read fails closed. The
facade does not traverse hidden semantic subtrees to construct a second style
tree merely to imitate a browser resolved-value query.

Not supported includes storage, indexed databases, workers, service workers,
media queries, observers, DOM parsing/serialization, Shadow DOM, custom
elements, full CSSOM, range/client-rect lists, offset metrics, visual viewport,
screen APIs, dialogs and every unlisted Window member. The platform host may
have these APIs, but the realm does not expose them.

## Build and dependency policy

| Source category | Default | Opt-in / failure behavior |
|---|---|---|
| Application modules under `sourceRoots` | Lexically transformed | Only referenced supported names are injected from one binding module |
| Package under `node_modules` | Not transformed | Add its exact package name to `transformPackages` and bundle it |
| Unlisted dependency | Outside realm | No compatibility claim; audit before allowlisting |
| Existing top-level declaration of an injected name | Build error | Exclude or write an explicit adapter; no silent renaming |
| Direct `export … from` in a governed module | Build error | On Bun 1.4, import first and then export the local binding |
| `react-dom` or unsupported subpath | Build error | No native React DOM fallback |
| `react-dom/client` | Build error | Set `reactDomClientAdapter: true` to alias to `@zavx0z/dom-react` |
| Dynamic code (`eval`, Function constructor), generated modules | Unsupported | Must be rejected/audited; strings are not transformed |
| Module with no-transform marker | Native host/bootstrap module | Never receives realm lexical bindings |

For bundled third-party policy use Bun's `packages: "bundle"`; otherwise Bun
can leave bare packages to runtime and neither transformation nor aliasing can
govern their internals. This matrix does not claim arbitrary npm compatibility.
Packages are candidates only when their used path stays inside the semantic
DOM subset, does not depend on hidden browser slots/brand checks, and passes
focused integration tests.

Identifier selection is intentionally textual and conservative. A name used
only in a comment or TypeScript type can still select a runtime binding; if
that collides with a module declaration, exclude or explicitly adapt the
module rather than relying on a guessed rewrite.

`react-dom/client` opt-in does not make React DOM compatible. It deliberately
substitutes the repository's React custom renderer, whose public `createRoot`
commits to the same semantic tree. Other `react-dom` imports remain errors.

## Type boundary

Realm application code should compile in a separate TypeScript project with
`lib: ["ESNext"]` and the `@zavx0z/web-realm/globals` declarations. Native
host/bootstrap code keeps its browser/WebGPU libraries and carries the
no-transform marker. Combining the complete browser `lib.dom.d.ts` with the
realm globals is unsupported because it would advertise APIs that this realm
does not implement.

The source transform does not create JavaScript lexical bindings at type time,
and the declarations do not mutate runtime globals. Both halves are required.

This facade is an ownership boundary, not a security sandbox. The plugin
conservatively rejects direct textual `eval` and `Function` use in governed
modules, but it does not attempt to confine hostile JavaScript or every
constructor-reflection escape. Only trusted, audited source belongs in a realm
build.
