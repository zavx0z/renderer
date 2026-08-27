# Требования `@zavx0z/renderer-webgpu`

`@zavx0z/renderer-webgpu` является retained WebGPU backend для immutable
display list `@zavx0z/renderer`. Он не владеет DOM, HTML, CSS, layout,
accessibility или input semantics.

## Контракт кадра

1. Backend принимает канонический `RenderFrame` из `@zavx0z/renderer`.
   Пара `DisplayItem.node` + `DisplayItem.key` является retained identity
   visual item и должна встречаться в `displayList` не более одного раза.
   Один semantic node может порождать несколько visual items.
2. Поддерживаются только `kind: "rect" | "text" | "image"`. Неизвестный kind,
   пустой `key`, повторная пара `node` + `key`, отрицательный размер Rect,
   нечисловая geometry, opacity вне finite `0..1` и malformed border завершают
   `applyFrame()` ошибкой до изменения retained tree.
3. Координаты display list являются top-left: Rect и Image materialize-ятся центром в
   `(x + width / 2, -(y + height / 2), 0)`, Text — baseline-позицией
   `(x, -(y + fontSize), 0)`. Paint order задаётся порядком `displayList` и
   `root.children` под Engine `renderLayer = "ui"`.
4. `color` уже разрешён upstream. Backend поддерживает только транспортные
   формы `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(...)`, `rgba(...)` и
   `transparent`. Внутренний белый fallback защищает только от structurally
   malformed external frame; полный CSS color parsing запрещён.
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
2. Стабильная пара `node` + `key` того же kind сохраняет Engine object,
   geometry и material. Position и paint обновляются in place. Каждый Rect
   использует `RoundedRectMaterial`; fill, opacity, four-edge border widths и четыре
   corner radii изменяются на том же material. Rect resize меняет
   `PlaneGeometry` position buffer in place, ставит `needsUpdate` и обновляет
   material width/height без замены Mesh или geometry.
3. Изменение Text content, `fontSize` либо `letterSpacing` сохраняет
   `CachedText` и material, вызывая только `updateGeometry()`. Color и opacity
   изменяются на том же `TextMaterial` без пересборки text geometry.
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
7. `root.children` всегда повторяет порядок `frame.displayList`. Backend не
   создаёт скрытые дополнительные scene roots.
8. Shadow Rect использует тот же RoundedRect pipeline и один стабильный
   Mesh/PlaneGeometry/RoundedRectMaterial. Изменение offset, blur, spread,
   color, opacity, radii или transform обновляет эти owners in place; plane
   vertex resize не вызывает `invalidateGeometry`, новый texture/offscreen
   pass/pipeline не создаётся. Удаление shadow item следует обычному exact
   cleanup закону.

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
2. Каждая принадлежащая Rect или Image geometry ровно один раз передаётся обязательному
   `invalidateGeometry` callback. Shared geometry `CachedText` не
   инвалидируется вместе с отдельным Text item.
3. Engine-эвикты shared Text layout cache также передаются
   `invalidateGeometry` после кадра либо disposal.
4. `dispose()` идемпотентен, удаляет все owned children и invalidates все
   owned non-shared geometries. `applyFrame()` после disposal запрещён.
5. Каждый retained Image получает source-specific `ImageMaterial.onTextureChange`.
   Callback запрашивает host presentation только пока exact entry активен и
   source остаётся текущим. Callback старого source, удалённого item или
   disposed backend становится наблюдаемо inert; backend не мутирует DOM и не
   фабрикует новый semantic frame. Engine `TextureLoader` остаётся владельцем
   texture cache/fetch/decode lifecycle.

## Type boundary

`RenderFrame`, `DisplayItem`, `RectDisplayItem`, `TextDisplayItem` и
`ImageDisplayItem`
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
