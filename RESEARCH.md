# Исследование HTML DOM как API WebGPU/WebXR UI

## Вывод

Реалистичная модель — не нативные browser nodes и не копия внутренностей
Blink, а собственный компактный DOM realm с теми же публичными именами и
наблюдаемой семантикой поддержанного подмножества:

```text
Document → HTMLElement → CSS/layout/display list → WebGPU → Engine
```

TypeScript interfaces и методы в prototype не создают тяжёлое состояние на
каждом объекте. Стоимость определяют реальные instance fields, атрибуты,
listeners, layout work и GPU resources. Поэтому стандартная prototype chain
сочетается с lazy rare state и incremental derived stages.

## Классы и функции

- Runtime-типы DOM должны быть классами: `Node → Element → HTMLElement →
  HTMLButtonElement`. Методы разделяются через prototypes; `instanceof`,
  специализация и Web IDL-подобное поведение остаются наблюдаемыми.
- UI-композиция может оставаться функцией: функция создаёт или обновляет
  стандартные элементы, но не является параллельным runtime type.
- Closure-фабрика, создающая методы на каждом экземпляре, расходует больше
  памяти. Локальный benchmark показывает ~189 B для пустого DOM element против
  ~312 B для объекта с per-instance closures; детали в
  [PERFORMANCE.md](PERFORMANCE.md).

V8 объясняет shared shapes/prototypes, fast properties и стоимость
dictionary-like properties в [Fast properties](https://v8.dev/blog/fast-properties)
и [Maps (Hidden Classes)](https://v8.dev/docs/hidden-classes).

## Почему не использовать нативный browser DOM напрямую

Нативный DOM удобен для ReactDOM и browser Elements panel, но его узлы принадлежат
browser engine: вместе с ними приходят Blink lifecycle, style/layout/accessibility,
navigation realm и native allocation, которые невозможно заменить своей WebGPU
реализацией. Offscreen/native mirror также создаёт второе дерево и необходимость
синхронизации identity/state.

Собственный realm сохраняет authoring API, но оставляет реализацию компактной:
attributes, listeners, classList, focus, scroll и input state выделяются только
при использовании. Неподдержанные members отсутствуют в types и runtime, а не
возвращают фиктивные значения: [DOM support boundary](packages/dom/SUPPORT.md).

## `title`

`title` — global HTML attribute и отражаемое свойство `HTMLElement.title`, а не
свойство Button или отдельный Tooltip component. WHATWG определяет его как
advisory text, допускаемый для tooltip, с наследованием от ближайшего HTML
предка; явно пустой attribute отменяет наследование:
[HTML Standard, title attribute](https://html.spec.whatwg.org/multipage/dom.html#the-title-attribute).

Поэтому DOM хранит только строку. Renderer владеет hit test, задержкой,
переносами строк, viewport clamp и anonymous UA display items. WebGPU backend
только материализует уже решённые fragments.

`title` не заменяет доступное имя: сам стандарт предупреждает, что полагаться
на него для accessibility нельзя.

## React

`react-dom` нельзя направить на произвольные JavaScript DOM objects: это готовый
host renderer браузера. Нужен custom renderer. Официальный React reconciler
рекомендует mutation mode платформам с `appendChild`/`removeChild` и описывает
`createInstance()` через `document.createElement()`:
[React reconciler README](https://github.com/facebook/react/blob/v19.2.0/packages/react-reconciler/README.md).

`@zavx0z/dom-react` реализует этот путь для React 19.2. Fiber остаётся
authoring/component tree, а host instances — те же `@zavx0z/dom` nodes, которые
читает renderer. React DevTools может подключиться через reconciler hook.

React Three Fiber подтверждает общую модель custom renderer: JSX `mesh`
создаёт `THREE.Mesh`, а не browser element:
[R3F introduction](https://r3f.docs.pmnd.rs/),
[how it works](https://r3f.docs.pmnd.rs/tutorials/how-it-works).

## Browser DevTools

Одинаковые имена классов не добавляют custom nodes в стандартную вкладку
Elements. Chrome DOM domain адресует mirror objects настоящих Blink nodes через
`NodeId`/`BackendNodeId`:
[Chrome DevTools Protocol DOM domain](https://chromedevtools.github.io/devtools-protocol/tot/DOM/).
CSS domain также принимает именно DOM node IDs:
[CDP CSS domain](https://chromedevtools.github.io/devtools-protocol/tot/CSS/).

`@zavx0z/dom-devtools` поэтому предоставляет честный custom-panel/AI protocol:
stable realm-local IDs, serializable DOM/render snapshots и compact mutation/
state signals. Stock Elements integration потребовала бы участия Blink или
отдельного расширения, а не переименования классов.

## Почему Three.js не построен как HTML DOM

Three.js решает другой минимальный контракт: его ядро — scene graph, где
`Object3D` задаёт local coordinate spaces, transforms и GPU-facing resources:
[Three.js Scene Graph](https://threejs.org/manual/en/scenegraph.html).
Полный HTML contract потребовал бы parser, cascade, layout, form controls,
events, accessibility и browser-like invalidation — это резко расширило бы
ядро 3D engine и не помогло бы обычным scene objects.

Поверх Three.js такой authoring всё же существует:

- [A-Frame](https://aframe.io/docs/) использует HTML/DOM и entity-component
  layer поверх Three.js;
- [LUME](https://github.com/lume/lume) реализует GPU-powered custom HTML
  elements, совместимые с framework DOM tooling;
- React Three Fiber оставляет Three.js scene graph и добавляет React host
  renderer вместо HTML layout engine.

Это подтверждает разделение: DOM/document engine является слоем над GPU engine,
а не заменой Engine scene graph.

## WebXR DOM Overlay — не тот же продукт

[WebXR DOM Overlays](https://immersive-web.github.io/dom-overlays/) позволяет UA
показать один нативный 2D DOM root как topmost screen/floating/head-locked
overlay. Он не превращает HTML layout в WebGPU geometry приложения, не даёт
world occlusion и не заменяет собственный renderer. Его можно поддержать как
отдельный browser adapter, но это не основа spatial document engine.

## Принятая граница репозиториев

- `renderer`: DOM, CPU renderer, WebGPU backend, browser host, React adapter,
  DevTools bridge;
- `engine`: GPU/scene/material/resource owner;
- `template`: addressed DOM compiler;
- `ui`: DOM/CSS compositions, theme/assets and private stories;
- `storybook`: shared DOM Workbench/lifecycle;
- generic `layout`, `ui/elements` и отдельный `ui/hud`: retired после
  доказанного zero-import cutover, без compatibility aliases. Локальный
  unregistered Layout checkout сохранён только как recoverable user-WIP
  snapshot и не входит в package graph.
