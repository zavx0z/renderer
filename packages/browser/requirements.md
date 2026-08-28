# Требования `@zavx0z/renderer-browser`

`@zavx0z/renderer-browser` — generic browser composition owner semantic
`@zavx0z/dom` Document. Он предоставляет готовый host одного WebGPU canvas и
caller-owned runtime world-space document plane, соединяет уже существующих
production owners и не объявляет UI, Storybook, HTML mirror или новый renderer.

## `RENDERER-BROWSER-001` — один owner graph

`createDocumentCanvasRuntime()` принимает exact `canvas`, `document`, `root`,
author `styleSheets` и обязательный готовый `TrueTypeFont`. Runtime создаёт и
публично предоставляет один Engine `Renderer`, `Space`, fixed `ViewPoint`, CPU
`DocumentRenderer`, `DocumentInteractionController`,
`RendererWebGpuBackend` и `RendererWebGpuScreenOverlay`.

DOM, Renderer, WebGPU backend и Engine являются peers. Package не содержит
копий их types, compatibility aliases или скрытой загрузки font.

## `RENDERER-BROWSER-002` — viewport и presentation

Logical viewport вычисляется из canvas bounding rect и имеет минимум один
logical pixel на axis. Resize устанавливает validated pixel ratio и physical
canvas size, обновляет ViewPoint aspect, пересоздаёт только viewport-bound CPU
renderer и изменяет ScreenOverlay viewport. Semantic Document, Engine owners,
backend root и overlay identity сохраняются.

Каждый direct `render()` flush-ит CPU renderer, добавляет interaction-owned
presentation, применяет immutable frame к WebGPU backend и передаёт Space,
overlay и fixed ViewPoint Engine renderer. `requestRender()` объединяет
несколько запросов в одну browser frame. `currentFrame` и `subscribe()` дают
наблюдаемое состояние последнего реально переданного frame.

Runtime подписывается на оба независимых Document channels: structural/
attribute/character mutations и live state changes. Внешние Template, React и
imperative DOM updates автоматически вызывают один coalesced `requestRender()`;
caller не обязан вручную сигнализировать после каждого `text.data`, attribute,
scroll или input value update.

Backend texture readiness uses a separate presentation-only callback. Runtime
wires it to the same coalesced `requestRender()` path, so an asynchronous Engine
`TextureLoader` change presents the already-owned semantic image without a DOM
mutation or synthetic state record. Repeated texture notifications before the
browser frame collapse into one request.

## `RENDERER-BROWSER-003` — standard browser input

Canvas `pointermove`, `pointerdown`, `pointerup`, `pointercancel` и `wheel`
преобразуются из client coordinates в текущие logical document coordinates.
Это преобразование выполняется ровно один раз. Core затем inverse-hit-test-ит
собственный cumulative RenderTransform/clip chain; runtime не применяет CSS
scale/translate повторно и semantic PointerEvent сохраняет logical viewport
`clientX/clientY`, а не element-local coordinates.
Pointer capture остаётся у canvas. Wheel delta и modifiers передаются exact
Core `DocumentInteractionController.wheel()`; Core выбирает scroll owner и
меняет standard DOM `scrollTop`/`scrollLeft`, после чего runtime выполняет один
новый frame. Browser package не реализует собственный scroll law.

Каждый Canvas/Plane/Overlay runtime создаёт один lazy Core
`DocumentInteractionState` и передаёт exact owner одновременно CPU renderer и
interaction controller. Hover/pressed не проецируются в `class` или
`data-ui-state`: изменение pointer chain invalidates только symmetric difference
старой/новой exact Element ancestor chain. До первого pointer event координата
не считается известной и synthetic `:hover` в `(0, 0)` не создаётся.

Accepted semantic pointer-down prevents the browser canvas default before the
hidden native input proxy is focused, so the browser cannot immediately steal
focus back from the semantic `HTMLInputElement`.

Tooltip timeout только запрашивает следующий presentation frame после
`tooltipDelayMs`; содержимое и timing decision остаются у Core interaction.

## `RENDERER-BROWSER-004` — reusable native text-input host

`DocumentNativeInputHost` создаёт ровно два off-screen browser owners: один
`input[data-renderer-input-proxy]` и один
`textarea[data-renderer-textarea-proxy]`. Активен только proxy exact focused
semantic target. Это keyboard/IME event host, а не HTML mirror semantic tree.
Text-like `HTMLInputElement` ограничен standard selection-applicable types
`text/search/tel/url/password`; `HTMLTextAreaElement` использует textarea proxy.
Checkbox/radio и остальные input types остаются DOM-owned activation и никогда
не зеркалируются.

Host переключает один exact active semantic Document и optional owner id.
Переключение либо deactivation снимает прежний semantic/native focus; повторное
назначение того же Document может сменить owner id без потери target identity.
Canvas runtime закрепляет свой Document, а SpaceRuntime выбирает Document
nearest plane при accepted pointer focus. Empty hit, active plane removal и
runtime dispose выполняют blur/cleanup. Canvas предоставляет readonly
`inputTarget`; SpaceRuntime также предоставляет readonly `activeInputPlaneId`.

Input proxy отражает `type`, оба proxy — live `value`, `readOnly`, `disabled` и
standard `selectionStart/selectionEnd/selectionDirection`. Native `select` и
`selectionchange` обновляют только semantic selection state; `select` map-ится
в один ordinary semantic `select` event. Programmatic semantic
value/type/selection changes возвращаются в active proxy через общий
state/mutation request path.

Native `keydown`/`keyup`, `beforeinput`, `input` и
`compositionstart/update/end` проецируются в exact custom event classes только
active Document. Для native `input` value и selection записываются до semantic
dispatch, поэтому listener видит новый state. Cancelable rejection атомарно
возвращает semantic и native value+selection; coalesced state channel не
публикует отменённый intermediate state и host не создаёт второй `input` event.

V1 не заявляет caret paint/geometry, clipboard, DataTransfer, forms или IME
candidate UI. Host является bounded text-entry adapter, а не обещанием полного
browser form control.

## `RENDERER-BROWSER-005` — capture и lifecycle

`captureLastPresentedFramePng()` читает только последний Engine-presented
frame. Runtime не выполняет скрытый render для capture. `dispose()` идемпотентно
отключает ResizeObserver, canvas listeners, pending animation/timer callbacks,
pointer capture, subscribers, interaction, CPU renderer и WebGPU backend.
Before backend disposal the texture-presentation bridge becomes inert, so a
late Engine callback cannot schedule work or throw through the disposed runtime.
Прямые операции после dispose завершаются ошибкой.

Runtime не регистрирует navigation, pagehide, route, ready marker или
Storybook globals. Эти действия принадлежат composition root.

## `RENDERER-BROWSER-006` — testable host boundary

Production factory использует browser и Engine напрямую. Focused unit tests
подменяют только package-internal platform/owner factories, поэтому проверяют
coordinate mapping, resize, render scheduling, wheel delegation, capture и
cleanup без доступного GPU. Test seams не являются package export.

## `RENDERER-BROWSER-007` — caller-owned world document plane

`createDocumentPlaneRuntime()` принимает caller-owned `Document`, root,
author `styleSheets`, готовый font, logical viewport,
`worldUnitsPerPixel`, geometry invalidator и раздельные callbacks
`requestFrame`/`requestPresentation`. Он создаёт и публично предоставляет один
CPU `DocumentRenderer`, `DocumentInteractionController`,
`RendererWebGpuBackend` и `RendererWebGpuDocumentPlane`.

Runtime не создаёт Canvas, Engine Renderer, Space, ViewPoint, ScreenOverlay,
native input, ResizeObserver, timer или animation loop. Caller помещает stable
`plane` в собственный world и вызывает `flush()` по своему scheduling law.
Document mutations и live state changes сигналят `requestFrame`; backend
texture readiness сигналит только `requestPresentation`. После успешного
`flush()` immutable composed frame применён к backend, опубликован subscribers
и передан caller presentation callback.

`pointerMove`, `pointerDown`, `pointerUp`, `pointerCancel` и `wheel` принимают
уже logical `PointerInput`/`WheelInput`. Runtime не читает Canvas rect и не
повторяет world-Ray/document conversion: caller получает logical point через
DocumentPlane и передаёт его exact interaction owner. Synchronous DOM state
signal и interaction-only request объединяются в один caller callback на одну
операцию.

`resize(viewport, worldUnitsPerPixel?)` атомарно обновляет stable plane/content
mapping. При изменении logical viewport заменяется только viewport-bound CPU
renderer; backend, plane, content и interaction identity сохраняются. Изменение
только physical density сохраняет также CPU renderer. `dispose()` идемпотентно
отключает Document subscriptions/subscribers и освобождает текущие CPU,
interaction и backend owners. Late backend callback становится inert; direct
operations после dispose fail closed.

## `RENDERER-BROWSER-008` — one space, multiple document planes

`createDocumentSpaceRuntime()` владеет одним canvas, Engine Renderer, Space,
ViewPoint, Raycaster, ResizeObserver и coalesced animation-frame loop. Каждый
registered stable id получает ровно один `createDocumentPlaneRuntime()`;
SpaceRuntime не создаёт параллельный DOM/CSS/display-list/backend contract.
Duplicate id отклоняется до owner allocation. Document/root/style/font для id
не заменяются: новый semantic owner требует explicit remove + add.

`addPlane()` возвращает exact созданный `DocumentPlaneRuntime`. `updatePlane()`
меняет только logical viewport, `worldUnitsPerPixel` и ordinary world
position/quaternion/scale/visibility на том же PlaneRuntime/DocumentPlane/
backend/interaction/content. `removePlane()` отсоединяет plane и освобождает
только его runtime. Registry order стабилен и используется лишь как tie-break
для равной физической дистанции.

PlaneRuntime `requestFrame` отмечает dirty только свой semantic plane и
запрашивает общий frame. Его `requestPresentation` запрашивает общий Engine
frame без semantic flush. Один SpaceRuntime `render()` flush-ит все dirty
planes, обновляет один Space/ViewPoint и выполняет ровно один Engine
presentation. Canvas resize меняет только physical renderer size/pixel ratio и
ViewPoint aspect; logical viewport каждого plane остаётся caller-owned.

Canvas pointer становится одним Raycaster ray. Среди visible planes выбирается
ближайшее forward intersection с `inside=true`, после чего document point
передаётся как logical `PointerInput`/`WheelInput` exact PlaneRuntime. Pointer
capture удерживает выбранный plane до up/cancel; удаление captured plane сначала
посылает ему `pointerCancel`. `activePlaneId` и `hoveredPlaneId` доступны только
для readonly observation. Wheel выбирает ближайший plane заново.

После semantic `pointerMove` SpaceRuntime держит не более одного timer на exact
hovered plane/overlay и через его `tooltipDelayMs + 1` помечает exact runtime
dirty и запрашивает frame, чтобы Core заново выполнил `composeFrame()` для
owned `title` tooltip. Следующий move заменяет timer; hover
change/leave, owner removal и dispose отменяют его. Host не читает `title`, не
создаёт tooltip и не дублирует Core timing decision.

Runtime предоставляет direct capture последнего Engine frame и explicit
serializable ViewPoint `snapshotViewPoint()`/`restoreViewPoint()` без storage
policy. Dispose отменяет общий frame, observer/listeners/captures и освобождает
каждый registered PlaneRuntime. V1 не реализует drag-resize, caret
geometry/paint, occlusion beyond nearest finite plane или automatic
CSS/world layout. Keyboard/IME routing ограничен exact active text-like target
через один `DocumentNativeInputHost`; focus traversal между displays не
заявлен. Остальные механизмы требуют следующих отдельных owners; Surface, HUD,
panel и product semantics здесь запрещены.

## `RENDERER-BROWSER-009` — semantic screen overlays

`createDocumentOverlayRuntime()` соединяет caller-owned Document/root/style/
font с одним CPU renderer, interaction owner, WebGPU backend и
`RendererWebGpuScreenOverlay`. Он не создаёт Canvas, Engine Renderer, Space,
ViewPoint, browser input proxy, observer или frame loop. `resize()` меняет
logical viewport, сохраняя overlay/backend/interaction/content identity;
`updateForViewPoint()` выполняет только camera-lock transform.

SpaceRuntime `addOverlay()` регистрирует такой runtime в том же Space и Engine
frame, а его viewport автоматически повторяет logical Canvas size. Overlay ids
и plane ids образуют одно пространство exact identities. При input visible
overlays проверяются от последнего к первому до world Ray picking; transparent
место без semantic hit остаётся доступным world plane и camera navigation.
Capture, native text input, dirty/presentation channels, removal и disposal
сохраняют exact overlay owner. `activeOverlayId` и `hoveredOverlayId` являются
только readonly observation. Package не объявляет HUD, dock или product layer.

## `RENDERER-BROWSER-010` — routed camera gestures

Опция `cameraGestures` включает browser routing к public Engine `ViewPoint`
operations. Primary drag над пустым или non-interactive world hit выполняет
orbit, secondary drag — pan, wheel — pan, а Ctrl+wheel — anchored zoom.
Semantic overlay hit имеет приоритет; interactive world hit и ancestor с
оставшимся scroll range сохраняют DOM input ownership. SpaceRuntime не
дублирует orbit/pan/zoom math.

`setCameraGesturesEnabled()` меняет только routing policy и при выключении
освобождает active camera captures. ViewPoint pose, semantic Documents и
registered owners сохраняются; policy near/far, focus display и camera storage
остаются у consumer composition.
