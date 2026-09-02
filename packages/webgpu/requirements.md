# Требования `@zavx0z/renderer-webgpu`

`@zavx0z/renderer-webgpu` является retained WebGPU backend для immutable
display list `@zavx0z/renderer`. Он не владеет DOM, HTML, CSS, layout,
accessibility или input semantics.

## Контракт кадра

1. Backend принимает канонический `RenderFrame` из `@zavx0z/renderer`.
   Пара `DisplayItem.node` + `DisplayItem.key` является retained identity
   visual item и должна встречаться в `displayList` не более одного раза.
   Один semantic node может порождать несколько visual items. Первый успешно
   применённый frame привязывает backend к exact `Document` и root; другой
   owner отклоняется. Revision является non-negative safe integer и не может
   идти назад. Повтор той же revision остаётся допустим для exact clean frame
   либо interaction overlay, но не получает incremental batch fast path при
   изменившемся display list.
2. Поддерживаются только `kind: "rect" | "text" | "image" | "path"`. Неизвестный kind,
   пустой `key`, повторная пара `node` + `key`, отрицательный размер Rect,
   нечисловая geometry, opacity вне finite `0..1` и malformed border завершают
   `applyFrame()` ошибкой до изменения retained tree.
3. Координаты display list являются top-left: Rect и Image materialize-ятся центром в
   `(x + width / 2, -(y + height / 2), 0)`. Для Text `y` является верхом
   разрешённого line box, а alphabetic baseline вычисляется по exact Engine TTF
   metrics как
   `y + lineHeight / 2 + fontSize × (ascent - descent) / (2 × unitsPerEm)`.
   Поэтому положительный либо отрицательный half-leading распределяется
   симметрично, а `hhea.lineGap` повторно не добавляется поверх уже разрешённого
   CSS `line-height`. Paint order задаётся порядком `displayList` и
   `root.children` под Engine `renderLayer = "ui"`.
4. `color` уже разрешён и проверен upstream. Core не выпускает malformed CSS
   color в display list: direct invalid declaration отбрасывается до cascade,
   а invalid-at-computed-value-time `var()` использует inherited/initial law.
   Backend поддерживает только транспортные
   формы `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, legacy comma и modern
   space/slash формы `rgb(...)`/`rgba(...)`, а также `transparent`. Внутренний
   белый fallback защищает только от structurally malformed external frame;
   полный CSS color parsing запрещён.
5. `RectDisplayItem.opacity` является уже разрешённым upstream effective
   ancestor product. Backend передаёт его в `RoundedRectMaterial.opacity`, не
   вычисляя CSS semantics повторно. Per-corner radii передаются в порядке
   `topLeft, topRight, bottomRight, bottomLeft`. Четыре border widths
   передаются каноническим Engine tuple `[top, right, bottom, left]`, а один
   эквивалентный resolved RGBA видимых сторон — в exact `border` owner.
6. Engine `RoundedRectMaterial` представляет non-uniform widths только для
   прямоугольника с нулевыми corner radii; asymmetric rounded inner contour
   пока не заявлен. Такая комбинация и разные resolved RGBA одновременно
   видимых сторон завершаются явной ошибкой до retained mutations. Backend не
   выбирает одну сторону и не теряет данные молча. Стороны с нулевой шириной
   не требуют парсинга невидимого border color.
7. Text требует один `TrueTypeFont`, переданный при создании backend. Кадр с
   Text без font завершается явной ошибкой до мутации retained tree.
   `unitsPerEm`, `ascent` и положительная глубина `descent` проверяются и
   сворачиваются в один baseline ratio ровно один раз в constructor; per-item
   prepare выполняет только одно умножение и сложения. `fontSize` и
   `lineHeight` должны быть finite non-negative.
   Backend также публично предоставляет один immutable `textMeasurer` exact
   этого font. Он использует TTF advance каждого code point, Engine space
   advance `0.3em` и межсимвольный `letterSpacing`; до 4096 встреченных
   codepoint advances кэшируются без string-array allocation на вызов. Browser
   composition передаёт тот же экземпляр CPU Renderer и сохраняет его при
   resize.
   `TextDisplayItem.opacity` напрямую записывается в `TextMaterial.opacity`, а
   finite signed `letterSpacing` — в exact `CachedText.letterSpacing`.
8. Image требует непустой `src`, positive finite content-box dimensions,
   bounded `fit: "cover" | "contain"`, finite opacity и обязательный для Image
   `requestPresentation` callback backend options. Backend вычисляет только
   транспортный `boxAspect = width / height`; URL, fetch/decode, intrinsic
   dimensions и CSS semantics остаются upstream/Engine owners.
9. Каждый display item требует finite axis-aligned `RenderTransform`.
   Backend применяет его только к retained Engine `position`/`scale`: logical
   x/y/width/height и geometry остаются локальными. Нулевой или отрицательный
   scale сохраняется как exact Engine transform; backend не подменяет его
   положительным размером и не интерпретирует CSS function list повторно.
10. Rect с non-null analytical shadow требует positive source dimensions,
    finite non-negative blur/spread и нулевые border widths. Backend сохраняет
    source width/height/radii в `RoundedRectMaterial`, расширяет только retained
    PlaneGeometry симметрично на `blur + spread`, использует Rect color/opacity
    как shadow fill и не reparsит CSS.

## Retained ownership

1. Backend создаёт и публично предоставляет один стабильный `Object3D` root с
   `renderLayer = "ui"`.
2. На scalar fallback стабильная пара `node` + `key` того же kind сохраняет Engine object,
   geometry и material. Position и paint обновляются in place. Каждый Rect
   использует `RoundedRectMaterial`; fill, opacity, four-edge border widths и четыре
   corner radii изменяются на том же material. Rect resize меняет
   `PlaneGeometry` position buffer in place, ставит `needsUpdate` и обновляет
   material width/height без замены Mesh или geometry.
3. Изменение Text content, `fontSize` либо `letterSpacing` сохраняет
   `CachedText` и material, вызывая только `updateGeometry()`. Color и opacity
   изменяются на том же `TextMaterial` без пересборки text geometry.
   Изменение только `lineHeight` пересчитывает baseline position на том же
   `CachedText` и не перестраивает, не инвалидирует и не загружает geometry.
4. Image использует один `Mesh`, `PlaneGeometry` и `ImageMaterial`. При
   сохранении `(node, key, kind)` source, `fit`, `boxAspect`, opacity,
   presentation clips, position и plane vertices обновляются in place без
   замены этих трёх Engine owners.
5. Transform-only frame сохраняет exact `Mesh`/`CachedText`, geometry и
   material для Rect, Text и Image. Backend меняет position/scale in place;
   Text не вызывает `updateGeometry()`, Image/Rect не меняют plane vertices и
   `invalidateGeometry` не вызывается.
6. Изменение kind при том же `node` создаёт новый Engine object и освобождает
   прежний owned resource.
7. `root.children` сохраняет exact paint order `frame.displayList`: scalar
   owner представляет один item, а `InstancedRoundedRect` — один consecutive
   run на его точном месте. Backend не создаёт скрытые дополнительные scene
   roots и не переносит run через scalar barrier.
8. Shadow Rect использует тот же RoundedRect pipeline и один стабильный
   Mesh/PlaneGeometry/RoundedRectMaterial. Изменение offset, blur, spread,
   color, opacity, radii или transform обновляет эти owners in place; plane
   vertex resize не вызывает `invalidateGeometry`, новый texture/offscreen
   pass/pipeline не создаётся. Удаление shadow item следует обычному exact
   cleanup закону.

## Retained Rect instancing

1. Safe instancing включён по умолчанию. `rectInstancing: "disabled"` оставляет
   весь кадр на scalar пути только как явный oracle/fallback для проверки.
   `maxRectInstances` является positive hard bound; overflow не расширяет его
   молча и остаётся scalar.
2. Backend сначала валидирует полный immutable frame по обычному контракту.
   Затем он автоматически выделяет maximal consecutive Rect runs. В run
   допускаются только positive-size Rect без clips, с finite non-zero
   axis-aligned scale/translation и с уже представимыми scalar fill/border/
   radii/shadow значениями.
3. AABB каждого кандидата включает analytical shadow expansion и signed scale.
   Внутри одного draw допускаются только pairwise non-overlapping AABB. Touch,
   overlap, clip, Text, Image, capacity overflow либо bounded spatial-index
   policy разрывает run. Индекс использует 64-logical-unit cells; Rect,
   покрывающий больше 256 cells либо выходящий за safe integer cell address,
   остаётся scalar. Поэтому blending order
   внутри draw не может изменить пиксель, а порядок между run и scalar owners
   остаётся порядком display list.
4. Один backend владеет одним Engine `RoundedRectInstanceLayer`. Каждая
   retained пара `(node, key)` в совместимом subset получает canonical
   generation-guarded handle и stable physical slot. Insert/delete/reorder
   меняет только dense order; один изменённый item помечает ровно свой
   128-byte record. Несколько `InstancedRoundedRect` run views разделяют unit
   quad, records и order и вызывают один indexed instanced draw на run.
5. Packed record содержит exact logical `x/y/width/height`, signed transform,
   fill/border RGBA, четыре radii, четыре widths, opacity, shadow blur/spread и
   local Z. DPR и viewport не переписывают эти значения. CPU `RenderFrame.hits`
   остаётся единственным hit oracle; Engine не получает semantic node.
6. `diagnostics` раздельно показывает scalar Rect draws, instanced run draws,
   admitted instances, active slots/capacity и pending record/order upload
   ranges/bytes. `rectPlanReused` и `rectPreparedItems` показывают, был ли
   использован incremental plan и сколько display-list items прошли текущий
   prepare traversal (на fast path — только changed references). Эти счётчики
   не подменяют фактический Engine draw: Engine
   pipeline тестируется отдельным command/readback seam.
7. После успешного полного кадра backend может повторно использовать его
   validated prepared plan только при неизменных Document/root/viewport,
   display-list length, exact `(node,key,kind)` order, retained root topology и
   deep-immutable source records. Изменившиеся references допускаются на fast
   path только для Rect внутри уже существующего instanced run и только при
   равных x/y/width/height, transform, shadow expansion и empty clip topology.
   Reorder, scalar item change, geometry/transform/shadow/clip change,
   overlap/compatibility change либо mutable source немедленно выбирают полный
   prepare/plan/synchronize fallback.
8. Fast path полностью validates и packs все changed Rects до первой retained
   mutation. Затем он меняет только отличающиеся 128-byte records; dense order,
   run owners, scalar entries и root children не трогаются. Ошибка preparation
   сохраняет предыдущие records и diagnostics, а неожиданная ошибка нескольких
   record writes откатывает уже применённые records прежде чем выйти fail-closed.

## Retained stroked Path batching

1. Exact-opaque `PathDisplayItem` (`resolved color alpha === 1` и effective
   opacity `=== 1`) сохраняет composite identity `(node, key)` через один
   stable Engine style handle и упорядоченный набор stable sampled-segment
   handles. Этот instanced fast path не парсит `d`, не вычисляет Node routing и
   не создаёт per-Link Mesh, geometry или material.
2. Один `StrokedPathInstanceLayer` владеет независимыми 32-byte style и
   segment records. Style содержит resolved RGBA, logical width и opacity.
   Segment содержит logical `(fromX, fromY, toX, toY)` и физический stable
   style slot и generation. Изменение только opaque width пишет ровно его
   4-byte field, color — contiguous 16-byte field;
   изменение route загружает только изменившиеся segment records.
3. Consecutive Paths с одним exact `presentationOwner`, эквивалентной clip
   chain и без scalar paint barrier образуют один `InstancedStrokedPath`
   draw-range view. Несколько views разделяют layer/unit quad/storage и остаются
   на точных местах immutable display list. Rect/Text/Image либо различный
   owner/clip завершают run.
4. Run `Object3D` несёт один resolved owner transform и ordinary Engine
   `presentationClips`. DOM Y-down переводится в Engine Y-up ровно на run
   transform. Transform-only frame с неизменными Path references сохраняет
   style/segment handles, order, run и geometry, загружает ноль Path bytes и
   меняет только run matrix.
5. Engine аналитически расширяет каждый admitted exact-opaque sampled segment в AA round capsule.
   Segment order сохраняет path/paint order, а соседние opaque capsules образуют
   bounded round stroke. Complete SVG stroking, translucent self-union,
   adaptive curve quality and arbitrary joins/caps остаются за пределами этого
   extension contract.
6. Diagnostics публикует total `pathDraws`, separate `pathInstancedDraws` /
   `pathScalarDraws`, `pathPreparedItems`, active style/segment counts and
   capacities, exact retained record/order bytes, constant unit-geometry bytes,
   per-apply style/segment/order write bytes and pending Engine upload bytes.
   Pending bytes may include unacknowledged earlier capacity uploads; hot-path
   acceptance uses per-apply write bytes. Focused 10k proof requires one
   instanced/zero scalar draw, 10k styles, zero per-Link Engine owners and zero
   Path writes при shared pan/zoom. Removal/dispose releases every style/segment
   handle and invalidates the shared Engine geometry ровно один раз после её
   фактического представления.
7. Non-opaque Path не допускается в capsule batch. Он использует один retained
   scalar Mesh/BufferGeometry/MeshBasicMaterial с continuous sampled strip,
   bounded mitered sampled joins, round end caps и ordinary presentation clips.
   Это не аналитический AA/full-SVG stroke. Transform-only frame сохраняет все три owner и
   не меняет geometry storage; route/width меняет position/index arrays in
   place, color/opacity меняет тот же material, removal/dispose invalidates
   geometry ровно один раз. Этот correctness fallback не заявляется как
   high-performance batching и не меняет opaque Node-edge budgets.
8. Backend читает sparse display indexes только из unforgeable Core registry и
   только когда registry predecessor является exact cached source frame.
   External clones, parallel renderer revision streams and malformed hints use
   complete validation. One through eight changed compatible Paths update only
   their retained style/segment fields. Ordered move/replace operations from
   one exact predecessor cover an atomic old-selected/new-selected switch;
   each variable-length segment block uses allocation-free `moveRange`, and
   only the changed Path records are prepared. One bounded contiguous Path
   stacking permutation is prevalidated before retained mutation; scalar
   barriers or run-topology changes fall back to full plan.

## Presentation clip transport

1. Каждый `DisplayItem.clips` является уже разрешённой Core цепочкой
   пересечений в top-left logical pixels. Backend валидирует всю цепочку всего
   frame до retained mutations и записывает по одному Engine
   `PresentationClipShape` на тот же retained `Mesh` или `CachedText`, включая
   Image Mesh.
2. Все shapes имеют `kind: "rounded-rect"`. Полный X/Y clip
   `(x, y, width, height)` преобразуется в local Engine center
   `(x + width / 2, -(y + height / 2))` и halfSize
   `(width / 2, height / 2)`. Circular radii сохраняют порядок
   `topLeft, topRight, bottomRight, bottomLeft`.
3. Каждый retained clip index получает стабильный internal `Object3D`
   coordinate space, отсутствующий в scene `root.children`. Его live
   `matrixWorld` является `backend.root.matrixWorld × RenderClip.transform` с
   top-left-to-Engine Y conversion. Поэтому ScreenOverlay, nested translation,
   positive/negative/non-uniform scale и Engine culling используют одну matrix
   chain, а local radii/geometry не rematerialize-ятся. Clip space identity
   сохраняется при transform update и освобождается вместе с item/removed index.
4. X-only clip использует его X interval и детерминированно расширяет Y до
   `0..frame.viewport.height`. Y-only clip аналогично расширяет X до
   `0..frame.viewport.width`. Partial-axis clips не могут нести corner radii,
   а clip с двумя `false` axes отклоняется как malformed.
5. Core может выразить normalized elliptical corner radii, а текущий Engine
   `PresentationClipShape` принимает только один scalar на corner. Любой
   видимый full-axis corner с `x !== y` отклоняется до retained mutations;
   backend не усредняет, не выбирает один axis и не искажает clip молча.
6. Изменение или очистка clip chain сохраняет Engine object, geometry и
   material. Удалённый, заменённый или disposed retained object получает
   пустой `presentationClips`, чтобы внешняя ссылка не сохраняла stale clip.

## Cleanup

1. Удалённый item немедленно отсоединяется от root и удаляется из retained map.
2. Каждая принадлежащая scalar Rect или Image geometry ровно один раз передаётся обязательному
   `invalidateGeometry` callback. Shared geometry `CachedText` не
   инвалидируется вместе с отдельным Text item.
3. Engine-эвикты shared Text layout cache также передаются
   `invalidateGeometry` после кадра либо disposal.
4. `dispose()` идемпотентен, удаляет все owned children и invalidates все
   owned non-shared geometries. Если instanced layer хотя бы раз был
   представлен, его shared unit-quad/storage geometry invalidates ровно один
   раз. Root children отсоединяются одной bulk-операцией до per-entry resource
   cleanup; disposal не вызывает `Object3D.remove()` для каждого sibling и не
   создаёт квадратичный scan scene children. `applyFrame()` после disposal
   запрещён.
5. Каждый retained Image получает source-specific `ImageMaterial.onTextureChange`.
   Callback запрашивает host presentation только пока exact entry активен и
   source остаётся текущим. Callback старого source, удалённого item или
   disposed backend становится наблюдаемо inert; backend не мутирует DOM и не
   фабрикует новый semantic frame. Engine `TextureLoader` остаётся владельцем
   texture cache/fetch/decode lifecycle.

Focused owner test запрещает per-entry root removal для 512 overlapping scalar
entries. Dense consumer evidence после bulk detach: backend disposal `11.594ms`
для 1k Node scene и `328.632ms` для 10k scene; полный 10k lifecycle завершается
за `7209.438ms`, из которых component teardown занимает `6790.071ms`. Это
доказывает bounded backend cleanup, но не устанавливает frame-time budget для
application shutdown и не закрывает retained-memory gate.

## Type boundary

`RenderFrame`, `DisplayItem`, `RectDisplayItem`, `TextDisplayItem`,
`ImageDisplayItem` и `PathDisplayItem`
импортируются type-only из `@zavx0z/renderer`. Backend не объявляет
параллельный display-list контракт.

## Presentation adapters

### Camera-locked screen overlay

`RendererWebGpuScreenOverlay` is the camera-locked adapter from logical
document pixels to the current `ViewPoint` frustum. It owns one stable content
root, derives a uniform world-unit scale from the visible plane, places logical
`(0, 0)` at its top-left, and preserves the same retained tree across viewport
resize. It does not perform CSS layout, hit testing or DOM event dispatch and
replaces no semantic node.

### World-space document plane

1. `RendererWebGpuDocumentPlane` is an independent generic world-space adapter,
   not an alias or mode of ScreenOverlay. It owns one stable caller-supplied
   `Object3D` content root and uses ordinary Engine position/quaternion/scale
   on the plane itself. It does not import Layout, UiSurface, DOM, CSS,
   `ViewPoint` or browser lifecycle.
   The plane remains `renderLayer = "world"`, but never rewrites the caller's
   content layer: a WebGPU backend root stays `renderLayer = "ui"`, so its
   coplanar descendants retain display-list paint order without depth writes.
2. The plane receives one finite non-negative logical viewport and one finite
   positive `worldUnitsPerPixel`. Local plane origin is the viewport center.
   Backend top-left document coordinates remain unchanged under the content
   root: its position is `(-width × scale / 2, height × scale / 2, 0)` and its
   uniform scale is `worldUnitsPerPixel`.
3. `documentPointToWorld()` and `worldPointToDocument()` use the current complete
   parent/plane matrix. They are exact inverses for points on local `z = 0`.
   Finite viewport edges are inside; an empty viewport has no inside point.
   Nearest-point and logical bounds-distance operations clamp to that exact
   rectangle without mutating inputs.
4. `intersectRay()` validates a real finite non-zero Engine `Ray`, transforms it
   through the exact inverse world matrix, and intersects local `z = 0`.
   Parallel, coplanar and behind-origin rays return `null`. A forward result
   contains its world/document point, world distance, inside flag, nearest
   finite document/world point and exact world-space nearest distance.
5. Resize and density changes preserve the plane, content root and their
   position/quaternion/scale object identities. Zero viewport extent hides only
   content. Invalid viewport, density, point, Ray, non-finite matrix or singular
   transform fails before returning fabricated geometry; no camera-facing or
   automatic physical sizing policy is inferred.
