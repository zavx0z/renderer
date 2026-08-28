# `@zavx0z/renderer` requirements

`@zavx0z/renderer` is a deterministic CPU projection of one
HTML-DOM-compatible semantic tree. It computes boxes, paint items and spatial
hit metadata. It does not own a GPU device, Engine objects, WebGPU resources or
semantic DOM state.

## `RENDERER-CPU-001` — document boundary

`createDocumentRenderer()` receives one `@zavx0z/dom` `Document`, a root
`Node`, a finite non-negative viewport and optional author style sheets. The
root must belong to the supplied document. The package has no Engine, Layout,
UI Elements or browser DOM dependency.

## `RENDERER-CPU-002` — immutable frame

The renderer subscribes to the supplied Document's committed mutation and state
change batches. Each record invalidates its semantic target and exact ancestor
chain through the renderer root; state records also invalidate the owner's
subtree. `render(node?)` can additionally invalidate an explicit node
before flushing. `render()` and `flush()` compute only when dirty. A clean call
returns the exact previous `RenderFrame` object. Frames, box records,
display-list items, hit records, scroll metrics and their exposed collections
are immutable snapshots. `boxes` and `displayList` preserve ordinary Array
consumer semantics (`Array.isArray`, numeric indexing, length, iteration and
non-mutating Array methods) through mutation-rejecting chunked facades; they do
not claim `Object.isFrozen(array)`. Individual records remain frozen. Readonly
maps preserve Map lookup, size, order, iteration and `forEach` without exposing
`set`, `delete` or `clear`.

## `RENDERER-CPU-003` — cascade

The initial cascade supports flat author rules with tag, class, id, attribute,
child and descendant selectors. The bounded native pseudo-class subset is
`:hover`, `:active`, `:focus`, `:focus-within`, `:disabled`, `:checked` and
`:indeterminate`. Unsupported selector syntax rejects that selector rather than
partially matching it. Specificity and source order decide declarations;
inline style wins over author rules. `color`, `font-size`, `line-height` and
`letter-spacing` inherit. Supported
properties are `display`, physical `width`/`height` and logical
`inline-size`/`block-size`, their `min-*`/`max-*` constraints, `box-sizing`,
physical and logical margin/padding edges, solid border width/color/radius,
`opacity`, `overflow`/`overflow-x`/`overflow-y`, standard `scrollbar-width`, `gap`,
`background`/`background-color`, `color`, `font-size`, bounded `line-height`,
`letter-spacing`, inherited `text-align` (`start | end | left | right | center`),
single-line `text-overflow`, plus integer/`auto`
`z-index` for direct flex items and bounded `object-fit` (`cover | contain`)
for image replaced content. Bounded physical positioning supports
`position: static | relative | absolute` and `left`/`top`/`right`/`bottom`
with `auto`, px or percentage values. Bounded compositor properties are
`transform` translate/scale functions and `transform-origin` px/percentage/
`center` axes. One standard bounded `box-shadow` is supported for analytical
rounded-card ink.
Shorthands expand before cascade resolution, so a later side declaration or
longhand wins at the same specificity. Inherited `white-space` supports
`normal` collapsing, `pre` preservation and `nowrap` collapsing without line
breaks; formatting-only whitespace under
`normal` paints nothing.

The computed `color` resolves `currentcolor` against the inherited computed
color. `background` and `background-color` resolve `currentcolor` against that
element's computed `color`, exactly as border colors and box-shadow already do.
Absent backgrounds remain absent, `transparent` remains transparent and literal
colors remain unchanged.

Rules are indexed once by the strongest available id, class, attribute or tag
in their rightmost compound. Resolving an Element visits only the universal
rules and buckets named by that exact Element, then applies the ordinary
specificity/source-order cascade. Pointer pseudo state is held by one optional
renderer-owned `DocumentInteractionState` shared with the interaction
controller; semantic focus and control pseudo state are read directly from the
DOM. `@scope`, cascade layers and a component style compiler remain pending and
are not accepted by this bounded parser.

## `RENDERER-CPU-004` — layout

Layout is deterministic and CPU-only. It supports block flow, minimal inline
flow, and flex rows or columns. A `RenderBox` uses border-box geometry;
`content*` excludes border and padding, while resolved margins remain outside
the box and participate in parent-owned flow. `content-box` and `border-box`
sizing, min/max constraints and physical or logical size aliases resolve before
placement. Numeric and `px` lengths are absolute; supported percentages resolve
against the available containing size. Adjacent vertical block margins do not
collapse in this initial deterministic subset.

Flex supports the standard `flex` forms needed by the UI (`1`, `none`,
grow/shrink, and grow/shrink/basis), the corresponding longhands,
`align-items`, and `justify-content`. Positive free space follows grow factors;
negative free space follows weighted shrink factors and honors resolved minima.
Rows and columns own every child position, including padding, border and margin.

## `RENDERER-CPU-005` — built-in defaults

The renderer supplies a small user-agent sheet: `div` is block, `span` is
inline, text uses inherited color and font size, and `button` is an inline
interactive control with deterministic padding and background. Text/search
inputs have deterministic border-box size, padding, border, background, color
and clipping; checkbox/radio inputs have compact square/circular defaults.
Images are inline replaced elements whose reflected `width`/`height` attributes
provide low-priority size declarations when present; no intrinsic decoder
metrics are fabricated.
Collapsed selects use the same deterministic replaced-control box law, while
option elements have no independent UA box.
Progress and meter use a compact deterministic gauge box whose internal track
and value remain renderer-owned UA paint.
Disabled input/select opacity is a UA declaration. Author and inline declarations
override every default through the normal cascade.
Textarea has a deterministic rows/cols-derived border-box, multiline font,
padding, border, background and clipping default. Disabled textarea opacity is
also UA-owned; readonly remains visually active and focusable. Author and
inline declarations replace all of these outer defaults through the same
cascade.

## `RENDERER-CPU-006` — display and input projection

Each visible semantic Element receives one `RenderBox` and one `HitMetadata`
entry keyed by the exact semantic `Node`. Backgrounds or borders emit `Rect`
display items. Each Rect carries a resolved fill color, effective
ancestor-composited opacity, non-uniform border widths and colors, and normalized
corner radii; these fields are finite pixel values or resolved color strings and
require no CSS interpretation in a backend. In particular, no Rect fill, border
or shadow color may carry the CSS context keyword `currentcolor` into a backend.
Text nodes with at least one paintable character emit `Text` display items with
effective opacity and resolved letter spacing. Whitespace-only Text still owns
its measured layout advance under preserving white-space modes but emits no
paint item or empty GPU geometry. Non-empty image sources with positive
content geometry emit one resolved `Image` item. Every display item and hit record carries
its immutable inherited clip stack and resolved RenderTransform; every clip
retains the transform of its own overflow owner. Display items use the
stable composite identity `(node, key)`, so one semantic node may own multiple
paint fragments without being copied. Keys prefixed by `ua:` are reserved for
renderer-owned presentation. `display:none` removes the complete subtree from
boxes, paint and hit output. Standard Comment nodes are invisible region
anchors and do not participate in block or Flex layout, nor produce a box,
paint item or hit entry.

## `RENDERER-CPU-007` — invalidation

Invalidating a leaf marks that leaf and only its ancestors up to the renderer
root. Clean siblings are not inserted into the dirty set. An invalidated
ancestor may reposition descendants during the following layout, but semantic
mutation ownership remains with `@zavx0z/dom`.

## `RENDERER-CPU-008` — pointer bridge and activation

The interaction controller resolves the topmost deepest hit from a
`RenderFrame`, emits `PointerEvent` boundary and pointer events through the DOM
capture/target/bubble path, focuses an enabled interactive target, and invokes
its standard `click()` activation when pointer-down and pointer-up resolve to
the same target. Disabled controls receive no activation.

Hit testing accepts a candidate only when the point belongs to its border-box
and to every axis-aware rounded rectangle in its inherited clip stack.

Platform adapters supply pointer coordinates and state. DOM listeners remain
the only author-facing event API; renderer consumers do not register callbacks
on boxes, surfaces or Engine objects.

## `RENDERER-CPU-009` — `title` advisory presentation

`HTMLElement.title` remains a reflected DOM attribute. On hover, the renderer
uses the nearest ancestor with a present `title` attribute. An explicitly empty
attribute suppresses inherited advisory text. After a configurable delay, the
controller derives anonymous `ua:title-*` display items; line feeds create
lines, long content wraps deterministically, and geometry is clamped inside the
viewport. Components and the WebGPU backend contain no title-specific logic.

For ordinary DOM Text, preserved CR/LF boundaries produce separate display
fragments keyed `text:<line-index>`. Text measurement uses the maximum line
width and the sum of line heights; empty lines consume height without emitting a
glyph fragment. A single line retains the established `text` key.

## `RENDERER-CPU-010` — deterministic overlay scrollbar paint

The supported standard `scrollbar-width` values are non-inherited `auto`,
`thin` and `none`, with initial `auto`. Invalid values, including pixel lengths,
are invalid declarations and do not create a custom-width contract. This
renderer resolves `auto` to a deterministic 10 logical pixels and `thin` to 4;
`none` preserves scrolling and metrics but emits no scrollbar paint.

An `auto` or `scroll` axis with positive remaining range emits two UA Rect
display items owned by the exact scroll Element. Vertical identities are
`(node, "ua:scrollbar-y-track")` and
`(node, "ua:scrollbar-y-thumb")`; horizontal identities use the corresponding
`x` keys. Track precedes thumb, vertical precedes horizontal, and simultaneous
axes shorten their tracks around one bottom-right corner. `overflow:hidden`
remains programmatically scrollable but paints no chrome.

Scrollbar chrome overlays the padding box and reserves no layout gutter. The
track uses the client axis; thumb length is proportional to `client / scroll`
with a deterministic two-thickness minimum, and applied scroll offset maps over
the remaining thumb travel. Track color is `#1f2937`, thumb color is `#9ca3af`,
and both use the scroll owner's effective opacity and circular radii. Their
clip chain contains ancestor clips only: an owner's own overflow clip and
scroll offset apply to content, never to its chrome. An ancestor's scroll and
clip still move and constrain a nested owner's complete box normally.

Clean frames retain exact identity. Scroll or wheel updates keep composite
keys and track geometry stable while changing only the affected thumb geometry
within scrollbar paint. This phase creates no scrollbar HitMetadata, drag
behavior, pointer callbacks, buttons, platform fading or OS theme claim.

## `RENDERER-CPU-011` — conservative character-data patch

After an initial frame, one committed `characterData`-only Text target may use
an incremental frame patch when the Text remains non-empty and is the sole child
of a block with a fixed pixel height and a width proven independent of its
content. The patch replaces only that Text's immutable box and `text` display
item, reuses unchanged records and hit metadata, and advances the frame revision
exactly once. Frame-local indexes resolve the target box and composite display
identity without an O(n) search. Each exposed Array replacement clones only one
256-entry chunk and structurally shares every untouched chunk; the node map adds
one persistent override over its immutable base. Old frames remain unchanged
and fully iterable, and a clean flush still returns exact frame identity.

Inline containers, multiple children or Text targets, empty/non-empty
transitions, auto-width flex-row items, ancestor style mutations and explicit
renderer invalidation always fall back to the complete layout pipeline. Any CR
or LF in either the old or new Text value also forces full measurement and line
fragment rebuilding. A Text under a programmatically scrollable overflow
ancestor also falls back because its content size may change scroll metrics. The
fast path must not infer safety outside these conditions.

## `RENDERER-CPU-012` — overflow clip projection

The supported overflow values are `visible`, `hidden`, `clip`, `auto` and
`scroll`. The shorthand expands to both axes before cascade; computed-axis rules
convert `visible` to `auto` and `clip` to `hidden` when either axis establishes a
scroll container. A non-visible axis establishes a GPU-neutral `RenderClip` at
the element's padding box.

An element's own background, border and hit record receive only ancestor clips.
Its descendants additionally inherit its overflow clip. Nested clips stay as an
ordered immutable stack, so consumers and `hitTest()` apply their logical
intersection without destroying rounded-corner information. Clip corner radii
are resolved non-negative pixel ellipses derived from the normalized border
radii and adjacent border widths, then normalized again against the padding-box
dimensions. One-axis `visible`/`clip` combinations carry an explicit axis mask
and no corner curve.

## `RENDERER-CPU-013` — scroll metrics and placement

`hidden`, `auto` and `scroll` axes are programmatically scrollable. Each such
Element receives one immutable `RenderScrollMetrics` in `RenderFrame.scrolls`,
keyed by exact Element identity. Client size is the padding-box size. Scroll size
is the deterministic visible-overflow extent of placed descendants plus the
owner's end padding, never smaller than client size. A descendant's non-visible
overflow boundary stops its overflow contribution on that axis.

The DOM owns requested `HTMLElement.scrollLeft`/`scrollTop` state. A frame keeps
both requested values and applied values clamped to `maxScrollLeft` and
`maxScrollTop`. Applied offsets shift descendant boxes, display items, hits and
descendant-owned clips; the scrolling Element's own box, paint, hit and
padding-box clip do not move. `visible` and the surviving one-axis `clip` value
never create scroll metrics or apply an offset.

Direct scroll setters reach the renderer through `Document.subscribeStateChanges`.
The renderer does not assume that scroll is the only state-record variant:
future connected state records invalidate their exact owner/subtree and use the
normal layout/paint path. A setter that produces no state change preserves exact
clean-frame identity.

## `RENDERER-CPU-014` — wheel bridge

`DocumentInteractionController.wheel(frame, input)` hit-tests through the
current clip stacks and dispatches one standard cancelable, composed, bubbling
DOM `WheelEvent` at the deepest hit. `preventDefault()` suppresses all offset
changes. Accepted deltas select the deepest ancestor with remaining range
independently for each axis and set DOM scroll state from the current requested
offset clamped by the supplied frame metrics. Consecutive wheel inputs therefore
accumulate before the caller's next `flush()`.

Pixel deltas use layout units directly, line deltas use 16 layout units, and
page deltas use the selected scroller's client size. The interaction controller
does not render synchronously; the state channel makes the caller's next
renderer flush observe the change.

## `RENDERER-CPU-015` — input replaced-control projection

An `HTMLInputElement` is one replaced semantic Element. It owns exactly one
Element RenderBox and HitMetadata record; semantic child nodes do not participate
in its layout. Text-like input types derive an anonymous Text display item with
the exact composite identity `(input, "value")`. The item reads live `.value`,
falls back to `placeholder` only while value is empty, aligns vertically inside
the resolved content box and inherits the input's own padding-box clip. No
synthetic Text Node is allocated.

Password values are replaced by one bullet per `Intl.Segmenter` grapheme, with a
Unicode code-point fallback when that standard runtime facility is unavailable.
Placeholder text remains readable and uses resolved color with a deterministic
UA opacity multiplier. CR/LF is flattened because these controls are
single-line.

Checked checkbox and radio controls emit no value text. They may emit one
generic resolved Rect indicator keyed `indicator`; radio indicators use resolved
round radii. Unchecked controls emit no indicator. This is renderer-owned generic
presentation, not a textual check glyph. Specialized color, file and date picker
chrome, selection, caret, composition and text editing remain separate
form-control phases.

Live value/checked updates arrive through the generic Document state channel and
invalidate the exact input/subtree. Disabled inputs remain painted but their hit
record is disabled and non-interactive. Property assignment does not synthesize
`input` or `change`; standard DOM EventTarget dispatch remains the only
author-facing event mechanism.

## `RENDERER-CPU-016` — horizontal range input projection

An `input[type=range]` keeps the ordinary input-owned outer RenderBox,
background and border produced by the normal cascade. Inside its resolved
content box the renderer emits exactly two generic Rect display items with
stable composite identities `(input, "track")` and `(input, "thumb")`.
Track precedes thumb in paint order. Both inherit the input's effective opacity
and own padding-box clip, use zero-width borders, deterministic UA colors
`#d1d5db` and `#2563eb`, and resolved circular radii.

V1 orientation is horizontal. The thumb is at most 12 logical pixels and is
clamped by both content axes. Its center travels from the content start to end;
the track spans the same center-to-center interval with thickness at most 4
logical pixels. Author width, height, box-sizing, padding, border and background
therefore resize the control and its inner paint without component coordinates
or replacing outer CSS ownership.

The DOM remains the only owner of range numeric semantics. Renderer reads
reflected `.min`/`.max` only to recover the endpoints and consumes the already
sanitized `.valueAsNumber`; midpoint fallback, clamping and step rounding are
not reimplemented in paint. The generic input state channel invalidates live
value and numeric-attribute changes, so the next frame moves the same `thumb`
identity while preserving `track` identity. Disabled ranges remain painted
through resolved UA opacity and expose disabled, non-interactive slider hit
metadata.

Range dragging, keyboard stepping, ticks, vertical orientation and datalist
marks remain later interaction/form-control phases. This paint slice introduces
no component callbacks or synthetic DOM children.

## `RENDERER-CPU-017` — collapsed select projection

An enabled single `HTMLSelectElement` with `size` 0 or 1 is one replaced
semantic Element. It owns exactly one RenderBox and combobox HitMetadata;
descendant `HTMLOptionElement` nodes keep DOM identity/state but receive no
independent box, hit or display item. Standalone option UA display is `none`.

The ordinary cascade owns the select's outer `background` Rect with composite
identity `(select, "background")`. The collapsed selected label is one anonymous
Text display item `(select, "value")`, vertically aligned in the resolved
content box, inheriting color, font size, opacity and the select's padding-box
clip. Renderer reads `select.selectedIndex`, a current static `select.options`
snapshot and exact `option.label`; it never binds to an undeclared `option.text`
API. `select.value` may differ from the visible label and remains DOM state, not
a second painted string. Explicit empty selection or an empty label emits no
value Text.

Author width, height, box-sizing, padding, border, background, color and font
size replace UA values through normal CSS. Connected option selectedness and
label mutations invalidate through the existing mutation/state ancestry, so a
new frame changes the same `(select, "value")` identity. Disabled selects keep
paint through resolved UA opacity, expose disabled/non-interactive combobox hit
metadata and follow the DOM focus law.

`multiple` or `size > 1` requires listbox layout and interaction that this slice
does not define; renderer therefore fails closed before committing a frame.
Popup/picker UI, disclosure indicators, option activation, keyboard selection,
listbox scrolling and open state remain later host/form-control phases. Paint
never fabricates `input` or `change` events and creates no synthetic option
nodes.

## `RENDERER-CPU-018` — progress and meter gauge projection

`HTMLProgressElement` and `HTMLMeterElement` are replaced semantic Elements.
Each owns one outer RenderBox and non-interactive standard HitMetadata role
(`progressbar` or `meter`); fallback child nodes retain DOM identity but receive
no independent box, hit or paint. The normal cascade owns outer width, height,
box-sizing, padding, border, background and opacity.

Inside the resolved content box the renderer emits exactly two Rect display
items with stable composite identities `(element, "track")` and
`(element, "value")`. Track color is `#d1d5db`; both items inherit effective
opacity and the gauge's padding-box clip, use zero-width borders and resolved
circular radii. Track always spans the complete content width. Determinate
progress consumes the DOM-normalized `position` directly and paints its value
from the start with `#2563eb`.

An absent progress value has `position === -1` and is not represented as zero.
It paints a centered one-third-width `value` segment with `#60a5fa`, preserving
the same key without claiming animation timing. Adding a determinate zero value
changes that same item to zero width at the start; removing the attribute
restores the distinct indeterminate segment.

Meter geometry consumes only normalized DOM `min`, `max` and `value`; a
degenerate range produces finite zero-width value paint. `low`, `high` and
`optimum` affect only the standard gauge-region tone: optimum `#16a34a`,
suboptimal `#d97706`, and even-less-good `#dc2626`. When optimum lies between
low and high, that middle region is optimum and both outer regions are
suboptimal. An optimum below low makes low/middle/high respectively
optimum/suboptimal/even-less-good; an optimum above high reverses those regions.

Numeric attribute mutations invalidate through the normal mutation ancestry;
track/value composite identities remain stable while geometry or tone changes.
Paint adds no animation controller, component callback, form behavior,
activation, tooltip, `input` or `change` event.

## `RENDERER-CPU-019` — textarea replaced-control projection

`HTMLTextAreaElement` is one replaced semantic Element. It owns exactly one
outer RenderBox and textbox HitMetadata; its default child Text nodes retain
DOM identity but create no child box, hit or paint. The normal cascade owns
outer width, height, min/max constraints, box-sizing, padding, border,
background, color, font size, opacity, overflow and white-space.

UA width and height derive deterministically from the DOM-normalized `cols` and
`rows` values using the default 13px font, then participate as ordinary low
priority declarations. The default border-box uses padding, border, white
background and overflow clipping. Author or inline CSS replaces each value
without a component sizing or positioning API.

Paint reads the exact live `textarea.value`; while it is empty, non-empty
`placeholder` is used at a deterministic `0.55` opacity. DOM dirty/defaultValue
semantics remain upstream and are not reimplemented. Each visible line is an
anonymous Text display item owned by the textarea with stable composite key
`value:<line-index>`, resolved color/font/opacity and the textarea's own clip
stack. Empty lines consume line position without fabricating glyph items.

The renderer normalizes CR/LF boundaries, preserves explicit lines and spaces
for `white-space: pre`, and applies deterministic content-width wrapping unless
the textarea's reflected `wrap` is `off`. `white-space: normal` collapses ASCII
whitespace and word-wraps to the same measured character capacity, breaking a
long token only when necessary. All lines retain source order and remain
clipped by the resolved overflow boundary.

Connected live value records and default child mutations invalidate through
the existing generic state/mutation channels. Property assignment changes only
the following frame and never fabricates `input` or `change`. Enabled and
readonly textareas expose interactive textbox hits and follow DOM focus law;
disabled textareas remain painted with resolved UA opacity but expose disabled,
non-interactive hits and reject focus.

Caret, selection, native editing, IME composition, resize handles, scrollable
text storage and synthetic Text nodes are outside this projection.

## `RENDERER-CPU-020` — inherited text alignment

`text-align` accepts the standard bounded values `start`, `end`, `left`,
`right` and `center`, is inherited, and has initial value `start`. Invalid
declarations are ignored before cascade priority, so they cannot replace a
valid lower-priority value with a fabricated fallback.

This slice is explicitly LTR-only: `start` maps to physical left and `end` maps
to physical right. `direction`, bidi paragraph resolution and RTL logical
mapping are not implemented and no `direction: rtl` declaration changes this
law. Those remain a documented text-layout phase rather than a hidden guess.

Ordinary Text display fragments align within the containing block's available
content line box. Each preserved multiline fragment measures and aligns its own
line independently while keeping exact `text:<line-index>` identity. Text wider
than the available box receives no negative offset. Alignment changes display X
only; semantic nodes, line order, measured glyph width and owner box geometry do
not move.

Text-like input `(input, "value")`, collapsed select `(select, "value")` and
textarea `value:<line-index>` fragments apply the same resolved alignment within
their own content boxes, including placeholder and multiline projection. The
indexed fixed-row character-data patch recomputes aligned X from the unchanged
parent content box, preserves composite keys and remains equivalent to a forced
full frame. No alignment value creates synthetic nodes or component callbacks.

## `RENDERER-CPU-021` — bounded child z-index stacking

`z-index` accepts `auto` or an exact base-10 integer representable as a safe
JavaScript number. Decimal, length, unknown and out-of-range values are invalid
declarations and cannot replace a valid lower-priority value. The property is
not inherited and has initial value `auto`.

Z-index applies to direct items of one `display:flex` formatting context,
matching the standard non-positioned flex-item exception, and to positioned
direct children of block/inline formatting contexts. A static non-flex child
ignores z-index. `auto` participates at level zero. Direct child subtrees paint
in ascending numeric level; a higher level paints later. Equal levels,
including `auto` and integer zero, retain exact DOM tree order. RenderBox
geometry, `boxByNode`, DOM identity and composite display keys remain unchanged.

Hit stacking uses the identical atomic subtree order, so reverse hit testing
selects the visually last overlapping item. Reordering does not create new hit
records or synthetic stacking nodes. A clean flush retains exact frame identity.

Every nested block/flex container owns a bounded local child-stacking scope.
Its applicable direct children reorder inside that subtree, while the complete
subtree remains one atomic direct item in the parent scope; a large descendant
level cannot escape above a higher parent sibling. General CSS stacking-context
creation, `order`, floats, positioned escape across these bounded atomic scopes,
transform-created stacking contexts, isolation and negative-level painting
behind the owner's own background remain unsupported and are not approximated.
The separate bounded transform projection and popover top layer are defined
below.

## `RENDERER-CPU-022` — popover visibility and viewport top layer

Renderer consumes the exact DOM `getPopoverVisibilityState` symbol and owns no
parallel open flag. An element with non-null `popover` state is excluded from
normal flow, boxes, paint and hits while hidden. A showing popover is likewise
removed from its DOM flow position, then materialized once in a viewport-owned
top layer after ordinary document boxes, display items and hit order.

Author CSS owns the popover's width, height, box-sizing, margin data, padding,
border, background, typography, opacity and nested layout. The top-level border
box remains deterministically centered in the viewport and clamped to viewport
dimensions; its own `position` and physical inset declarations do not replace
this bounded top-layer law. Nested descendants use ordinary supported
positioning. An auto-width block fills the available viewport. Anchor
positioning and author callbacks remain unsupported rather than being
interpreted approximately.

Top-layer roots receive no DOM-ancestor overflow clip and are not shifted by an
ancestor scroll offset. Their own overflow still clips nested content normally.
Each popover subtree remains atomic and internally preserves flex z-index,
display and hit order. Multiple showing popovers are projected in deterministic
DOM tree order because the bounded DOM exposes visibility, not a public mutable
top-layer collection; later projected peers paint and hit-test later.

Popover state records use the generic Document state invalidation path. A
successful show/hide or DOM-owned Auto peer closure produces a new frame; a
canceled `beforetoggle` changes no state and preserves exact clean frame
identity. Renderer fabricates no `beforetoggle`/`toggle`, focus movement, light
dismiss, Escape handling, source/anchor geometry, backdrop, or activation
callback. Semantic node identity and ordinary DOM event ownership remain
unchanged.

## `RENDERER-CPU-023` — image replaced-element projection

An exact DOM `HTMLImageElement` is one replaced semantic Element. It owns one
ordinary outer RenderBox and HitMetadata record; programmatic child nodes keep
DOM identity but produce no child layout, display item or hit. Author CSS owns
width, height, min/max constraints, box-sizing, margin, padding, border,
background, opacity and overflow. When an author dimension is absent, the
corresponding reflected `image.width` or `image.height` attribute is a
low-priority fallback. With neither author nor reflected size, the renderer
does not invent intrinsic fetch/decode dimensions.

Non-empty `src` and a positive content box emit one `ImageDisplayItem` with
exact composite identity `(image, "image")`. It carries the reflected source,
content-box geometry, effective ancestor-composited opacity, inherited clip
chain and resolved bounded fit. `object-fit` accepts only `cover` and `contain`;
invalid values are discarded before cascade priority and the bounded initial
value is `cover`. Scaling and cropping remain backend presentation mechanics,
not semantic layout.

An empty `src` emits no Image item, so no backend texture or transparent
placeholder is fabricated. The outer CSS box/background/border and hit record
remain. Alt-text rendering, URL resolution, fetch/decode state, intrinsic
dimensions, load/error events, responsive `srcset`/`sizes` and image maps are
explicit later DOM/platform phases; this slice does not approximate them.

Attribute and style mutations use the ordinary Document mutation channel. A
clean frame retains exact frame identity, while source, fit, geometry, opacity
or clip changes preserve the same semantic node and composite display key.

## `RENDERER-CPU-024` — bounded physical positioned layout

`position` is non-inherited with initial `static` and accepts only `static`,
`relative` or `absolute`. Physical `left`, `top`, `right` and `bottom` are
non-inherited and accept `auto`, finite px lengths or percentages. Unsupported
values such as `fixed`, `sticky`, `calc(...)` or unknown units are invalid
declarations and cannot replace a valid lower-priority value. Logical insets,
writing modes and transform-established containing blocks are not part of this
slice; bounded transform presentation is defined separately below.

A static box ignores insets. A relative box keeps its exact original block or
flex slot and therefore does not move following siblings. Its complete derived
subtree is then offset for final box, paint, hit, own clips and descendant
geometry. Physical `left` wins over `right`, and `top` wins over `bottom`; an
end-only inset moves in the negative physical direction. Relative percentages
resolve against the immediate block/flex content box.

An absolute box is excluded from parent natural size, block cursor, flex basis,
grow/shrink, gap and justification calculations. Its containing block is the
padding box of the nearest non-static block or flex ancestor; when none exists,
the initial viewport is used. Insets resolve against that padding-box axis.
With an explicit size, start inset wins and an end-only inset anchors the margin
box from the opposite edge. With auto size and both opposing insets present,
the border box fills the remaining non-negative space subject to min/max;
otherwise the bounded intrinsic size is used.

When both insets on an axis are auto, the absolute box uses its static position
without consuming a slot. A block child uses the current block cursor. A flex
child uses `justify-content` and `align-items` as a hypothetical sole item while
remaining absent from actual flex sizing. Margin remains outside the positioned
border box. Positioned inline ancestors do not establish an absolute containing
block in this bounded block/flex phase.

All final positioned geometry enters the ordinary display, hit, overflow-clip
and scroll-overflow projection before scrolling is applied. Scrolling shifts
the same descendant boxes, paint and hits, and positioned z-index uses the
bounded direct-child stacking law above. Mutation invalidation uses the normal
style/layout path; a clean flush preserves exact frame identity. This phase
creates no component coordinates, callbacks or parallel transform tree.

## `RENDERER-CPU-025` — bounded axis-aligned transform compositor

`transform` is non-inherited with initial `none`. The bounded grammar accepts
an ordered whitespace-separated list of `translate`, `translateX`,
`translateY`, `scale`, `scaleX` and `scaleY`. Translate axes accept finite px
or percentage lengths; percentages resolve against the transformed element's
unchanged border-box axis. Scale axes accept finite numbers, including zero and
negative reflection. Functions compose in CSS list order. Any unsupported or
malformed function, including `rotate`, `skew`, `matrix`, perspective or 3D
forms, invalidates the complete declaration before cascade priority rather than
partially applying it.

`transform-origin` is non-inherited and initially `center center`. One or two
axes accept finite px/percentage lengths or the `center` keyword; one axis
defaults the second to center. The resolved origin wraps the complete function
list. Left/right/top/bottom origin keywords, a Z origin and `transform-box`
remain outside this slice.

Layout measurement, flex/block slots, RenderBox x/y/width/height and semantic
DOM identity do not change. Core resolves one immutable axis-aligned
`RenderTransform {scaleX, scaleY, translateX, translateY}` chain. Parent and
child chains compose exactly; the chain is carried by RenderBox, every display
item and HitMetadata. Each overflow RenderClip retains its own local geometry
and the cumulative transform of its owning element, so nested transformed clips
intersect without baking scale into radii or rewriting descendant geometry.

Hit testing maps the viewport point through the inverse HitMetadata transform,
then applies the same inverse law independently to every clip before the
existing rounded-rectangle test. A zero scale is deliberately non-invertible
and yields no hit for that item. Browser event coordinates remain viewport
coordinates; Core does not rewrite `clientX/clientY` to local values.

Transformed descendant bounds contribute in the scroll owner's local coordinate
space, so a transform on the scroll owner itself does not fabricate scroll
range while a larger translated/scaled child can extend it. Applied scroll
offsets update boxes, display items, hits and inner clip chains with the same
affine law. Axis-aligned transforms therefore reach paint, Engine culling,
overflow and interaction consistently.

A single connected inline-style mutation whose non-transform computed style is
unchanged uses a transform-only frame patch when the affected subtree owns no
overflow clip and the frame has no scroll container. It recomputes cumulative
chains, shares untouched box/display/hit records, preserves layout geometry and
is equivalent to a forced full frame. More complex mutation batches, scroll or
owned clipping fall back to the complete exact renderer path. Transform does
not yet establish an absolute containing block, create a general CSS stacking
context or introduce rotation; those gaps are explicit rather than guessed.

## `RENDERER-CPU-026` — one analytical box shadow

`box-shadow` is non-inherited with initial `none`. The bounded grammar accepts
either `none` or exactly one outer shadow: required finite px offset-x/offset-y,
optional non-negative px blur radius, optional finite px spread radius and an
optional resolved color. Color may be currentColor, transparent, hex,
rgb/rgba or one of the basic named colors resolved to hex. Invalid blur,
percent lengths, `inset`, a top-level comma/multiple shadow or malformed color
invalidates the complete declaration before cascade priority.

A visible shadow creates no semantic node, layout box, hit target, scroll range
or component callback. Core emits one renderer-owned Rect display item with
stable composite identity `(element, "shadow")` immediately before the owner's
`background` item and complete descendant subtree. Its source rectangle is the
owner border box shifted by the two offsets, with the owner's normalized corner
radii, effective ancestor opacity and cumulative RenderTransform.

Positive spread and blur remain explicit analytical metadata. Negative spread
is resolved without a lossy negative Engine parameter by contracting the source
rectangle symmetrically, reducing each radius by the same amount down to zero,
and transporting zero analytical spread. A fully contracted source emits no
shadow. Ancestor overflow clips apply; the owner's own overflow clip does not
cut its outer shadow because that clip begins only for descendant paint.

Core does not allocate blur textures, repeated bands or an offscreen pass.
Multiple shadows, inset shadows, the complete CSS color space and browser-
specific blur-kernel matching remain explicit future gaps. Shadow mutation
uses normal style/paint invalidation while retaining the same semantic node and
display key; unchanged geometry/transform fields remain resolved data for the
retained backend.

## `RENDERER-CPU-027` — deterministic typography metrics and ellipsis

`line-height` is inherited and accepts `normal`, a finite non-negative unitless
number, a finite non-negative px length or percentage. `normal` resolves to the
bounded `1.2 × font-size` metric. A unitless value remains a factor when
inherited and therefore follows each descendant's font size. A percentage is
computed against the declaring element's font size and inherits as that
absolute length; px is likewise absolute.

`letter-spacing` is inherited and accepts `normal` or a finite px length,
including negative values. `normal` resolves to zero. CPU width is deliberately
deterministic rather than a shaping claim: every Unicode code point contributes
`0.6 × font-size`, and letter spacing is added exactly between adjacent code
points, never after the last. Width is clamped non-negative. Multiline height
and Y placement use the resolved line height; line fragment keys remain
`text:<line-index>`.

`white-space: nowrap` uses the same ASCII whitespace collapsing as `normal` but
produces one line. `text-overflow` is non-inherited with initial `clip` and also
accepts `ellipsis`. For a single nowrap line in an `overflow-x:hidden` content
box, ellipsis replaces the maximum Unicode prefix whose deterministic advance
plus `…` fits the content width. The existing `text` composite key is retained.
`clip` keeps the complete text and relies on the ordinary overflow clip. No
ellipsis is fabricated when the marker itself cannot fit.

Text-like input and collapsed select values use the same advance,
line-height/vertical-line-box and optional ellipsis rules. Textarea uses the
same per-gap width and line-height for wrapping and line placement;
`white-space:nowrap` collapses into one unwrapped line, while multiline
textarea fragments do not claim ellipsis. Placeholder opacity and live DOM
state laws remain unchanged.

The fixed-row character-data patch measures with the same metrics, recomputes
ellipsis from the unchanged parent content width and remains equivalent to a
forced full frame while preserving stable keys and untouched records.
Selection, caret, glyph shaping, kerning, bidi, font fallback, ligatures,
grapheme-cluster truncation and browser-exact font metrics remain explicit
future text-engine phases; this slice creates none of them implicitly.
