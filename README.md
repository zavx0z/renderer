# @zavx0z/renderer

[![npm](https://img.shields.io/npm/v/@zavx0z/renderer)](https://www.npmjs.com/package/@zavx0z/renderer)
[![bun](https://img.shields.io/badge/bun-1.0+-black)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ESM-green)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![MDN](https://img.shields.io/badge/MDN-HTML-red)](https://developer.mozilla.org/en-US/docs/Web/HTML)

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

const { context, update, onUpdate } = new Context((t) => ({
  cups: t.number.required(0)({ title: "orders" }),
  last: t.string.optional()({ title: "last ordered drink" }),
}))

const core = {
  menu: [
    { label: "Espresso", size: "30ml" },
    { label: "Cappuccino", size: "200ml" },
    { label: "Latte", size: "250ml" },
  ],
}

let state = "open"

const nodes = parse<typeof context, typeof core, "open" | "closed">(
  ({ html, context, update, core, state }) => html`
    <h1>☕ Quick Coffee Order</h1>

    <p>
      Status: ${state === "open" ? "🟢 Open" : "🔴 Closed"} · Orders:
      ${context.cups}${context.last && ` · last: ${context.last}`}
    </p>

    ${state === "open" &&
    html`
      <ul>
        ${core.menu.map(
          (product) =>
            html`<li>
              ${product.label} (${product.size})
              <button onclick=${() => update({ cups: context.cups + 1, last: product.label })}>Add</button>
            </li>`
        )}
      </ul>
    `}
    ${state === "closed" && html`<p>Come back later — we’ll brew something tasty ☺️</p>`}
  `
)
```

---

📜 Лицензия

MIT
