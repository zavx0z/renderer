# @zavx0z/renderer

[![npm](https://img.shields.io/npm/v/@zavx0z/renderer)](https://www.npmjs.com/package/@zavx0z/renderer)
[![bun](https://img.shields.io/badge/bun-1.0+-black)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ESM-green)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![MDN](https://img.shields.io/badge/MDN-HTML-red)](https://developer.mozilla.org/en-US/docs/Web/HTML)

---

## 📖 Описание

`@zavx0z/renderer` — target-neutral рендерер AST из `@zavx0z/template`.
Он компилирует синтаксическое дерево один раз, вычисляет неизменяемое resolved tree
для текущих данных и передаёт его host-адаптеру. DOM является одним из таких
адаптеров; существующая функция `render` сохраняет прежний DOM API.

Пакет работает в связке с:

- [`@zavx0z/template`](https://github.com/zavx0z/template) — статический парсер `html\`...\`` шаблонов
- [`@zavx0z/context`](https://github.com/zavx0z/context) — строгий и реактивный контекст данных

Парсинг и компиляция выполняются до циклов обновления. При изменении данных
программа только вычисляет resolved tree, после чего host атомарно заменяет
содержимое своего корня.

---

## ✨ Возможности

- Реактивные обновления DOM при изменении `context` или `state`
- Target-neutral API `compile` → `program.evaluate` → `commit`
- Неизменяемая структура resolved tree без зависимости от DOM
- Рекурсивные style-объекты с сохранением вложенных селекторов и at-rules для host
- Поддержка:
  - интерполяций `${...}`
  - условных конструкций (`?:`, `&&`, `||`)
  - циклов `.map(...)` с правильным скоупом
  - meta-элементов акторов в рамках MetaFor
- AST-контракт [`@zavx0z/template`](https://github.com/zavx0z/template)
- DOM-адаптер для [`@zavx0z/context`](https://github.com/zavx0z/context)
- Условный рендеринг с переключением ветвей
- Meta-элементы акторов

---

## 🚀 Установка

```bash
bun add @zavx0z/renderer
```

Компилируемый API не привязан к DOM:

```ts
import { commit, compile } from "@zavx0z/renderer"

const program = compile(nodes)
const tree = program.evaluate({
  bindings: { fields, mass, state },
  update,
})

commit(host, root, tree)
```

`compile(nodes)` вызывается один раз после парсинга. В циклах обновления остаются
только `program.evaluate(...)` и `commit(...)`. Host получает рекурсивный
`style` как объект и сам определяет, как применять обычные свойства, вложенные
селекторы и at-rules.

Контейнеры resolved tree заморожены. Opaque payloads, включая legacy `core` и
объекты в значениях атрибутов, сохраняют исходную identity: рендерер не клонирует
и не замораживает пользовательские данные.

---

🛠 DOM-адаптер

```ts
import { contextFromSchema, contextSchema } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { render } from "@zavx0z/renderer"

const schema = contextSchema((t) => ({ name: t.string.required("World") }))
const ctx = contextFromSchema(schema)
const st = { state: "ready", states: ["ready"], onUpdate: () => () => {} }
const nodes = parse<typeof ctx.context>(
  ({ html, context }) => html`<p>Hello, ${context.name}</p>`,
)

render({ el: document.body, ctx, st, core: {}, nodes })
```

## Документация

Полная документация с описанием и примерами доступна здесь: [https://zavx0z.github.io/renderer/](https://zavx0z.github.io/renderer/)

---

📜 Лицензия

MIT
