# @zavx0z/renderer

[![npm](https://img.shields.io/npm/v/@zavx0z/renderer)](https://www.npmjs.com/package/@zavx0z/renderer)
[![bun](https://img.shields.io/badge/bun-1.0+-black)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ESM-green)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![License](https://img.shields.io/github/license/zavx0z/renderer)](LICENSE)

---

## 📖 Описание

`@zavx0z/renderer` — рендерер для **MetaFor Framework**, работающий в связке с:

- [`@zavx0z/template`](https://github.com/zavx0z/template) — статический парсер `html\`...\`` шаблонов
- [`@zavx0z/context`](https://github.com/zavx0z/context) — строгий и реактивный контекст данных

Рендерер принимает схему из парсера и **императивно обновляет DOM**:  
перерисовываются только те узлы и атрибуты, которые реально зависят от изменённых данных.

---

## ✨ Возможности

- Реактивные обновления DOM при изменении `context` или `state`
- Поддержка:
  - интерполяций `${...}`
  - условных конструкций (`?:`, `&&`, `||`)
  - циклов `.map(...)` с правильным скоупом
  - meta-элементов акторов в рамках MetaFor
- Полная интеграция с [`@zavx0z/template`](https://github.com/zavx0z/template)
- Полная интеграция с [`@zavx0z/context`](https://github.com/zavx0z/context)
- Поддержка array.map с диффингом
- Условный рендеринг с переключением ветвей
- Meta-элементы акторов
- Оптимизация списков атрибутов (class, style, aria-\*)

---

## 🚀 Установка

```bash
bun add @zavx0z/renderer
```

---

🛠 Пример

```ts
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { Renderer } from "@zavx0z/renderer"

const { schema, context, update, onUpdate } = new Context((t) => ({
  attempt: t.number.required(0),
}))

const core = {
  ice: [{ url: "https://ice.com" }, { url: "https://ice2.com" }],
}
type State = "online" | "offline"
let state: State = "online"

const nodes = parse<typeof schema, typeof core, State>(
  ({ html, context, update, core, state }) => html`
    <h1>Config</h1>
    <ul>
      ${core.ice.map((server) => html`<li>Url: ${server.url}</li>`)}
    </ul>
    <h1>State</h1>
    <p>${state}</p>
    ${state === "offline" && html` <button onclick=${() => update({ attempt: context.attempt + 1 })}>Connect</button>`}
  `
)

// создаём рендерер
const renderer = new Renderer(document.getElementById("app")!, nodes, context, update, state, core)

let prevState = state

onUpdate((updated) => {
  renderer.update({ context: updated, ...(state !== prevState && { state }) })
  prevState = state
})
```

---

📜 Лицензия

MIT
