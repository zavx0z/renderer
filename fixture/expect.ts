import { expect } from "bun:test"
import { diffChars } from "diff"
import prettier from "prettier"

/** Канонизирует HTML через сериализацию DOM (Happy DOM / браузер) */
const canonicalizeViaDOM = (html: string) => {
  try {
    const tpl = document.createElement("template")
    tpl.innerHTML = html
    return tpl.innerHTML
  } catch {
    return html
  }
}

/** Токенизация атрибутов с учётом кавычек (двойных/одинарных) */
const tokenizeAttributes = (attrText: string): Array<{ name: string; value: string | null }> => {
  const out: Array<{ name: string; value: string | null }> = []
  let i = 0
  const n = attrText.length

  const isSpace = (ch: string) => /\s/.test(ch)

  while (i < n) {
    // пропуск пробелов и слэшей самозакрытия
    while (i < n && (isSpace(attrText[i]!) || attrText[i] === "/")) i++
    if (i >= n) break

    // имя атрибута
    const nameStart = i
    while (i < n && !isSpace(attrText[i]!) && attrText[i] !== "=" && attrText[i] !== ">") i++
    const name = attrText.slice(nameStart, i)
    if (!name) break

    // пропуск пробелов перед '='
    while (i < n && isSpace(attrText[i]!)) i++

    let value: string | null = null
    if (i < n && attrText[i] === "=") {
      i++ // пропустить '='
      while (i < n && isSpace(attrText[i]!)) i++

      if (i < n && (attrText[i] === `"` || attrText[i] === `'`)) {
        const quote = attrText[i++]
        const vStart = i
        while (i < n && attrText[i] !== quote) i++
        value = attrText.slice(vStart, i)
        if (i < n && attrText[i] === quote) i++ // закрывающая кавычка
      } else {
        const vStart = i
        while (i < n && !isSpace(attrText[i]!) && attrText[i] !== ">") i++
        value = attrText.slice(vStart, i)
      }
    }

    out.push({ name, value })
  }

  return out
}

/** Нормализует HTML строку для сравнения */
export const normalizeHTML = (str: string) => {
  const dom = canonicalizeViaDOM(str)
  return (
    dom
      // убрать лишние пробелы между тегами
      .replace(/>\s+</g, "><")
      .trim()
      // нормализуем самозакрывающиеся теги
      .replace(/<([^>]+)\/>/g, "<$1>")
      // НОРМАЛИЗАЦИЯ/СОРТИРОВКА АТРИБУТОВ БЕЗ ЛОМА ПРОБЕЛОВ ВНУТРИ КАВЫЧЕК
      .replace(/<([A-Za-z][^\s/>]*)([^<>]*?)>/g, (_m, tagName: string, rawAttrs: string) => {
        // если нет атрибутов — вернем как есть
        if (!rawAttrs || !rawAttrs.trim()) return `<${tagName}>`

        const attrs = tokenizeAttributes(rawAttrs)
        if (!attrs.length) return `<${tagName}>`

        // сортируем по имени для детерминизма
        attrs.sort((a, b) => a.name.localeCompare(b.name))

        // собираем обратно, всегда в двойных кавычках (и экранируем двойные)
        const rebuilt = attrs
          .map(({ name, value }) => {
            if (value == null || value === "") return name
            const safe = String(value).replace(/"/g, "&quot;")
            return `${name}="${safe}"`
          })
          .join(" ")

        return `<${tagName} ${rebuilt}>`
      })
      // схлопнуть множественные пробелы внутри текста
      .replace(/>([^<]+)</g, (_m, text) => {
        const normalizedText = String(text).replace(/\s+/g, " ").trim()
        return ">" + normalizedText + "<"
      })
  )
}

/** Форматирует HTML с помощью prettier */
const formatHTML = async (html: string) => {
  try {
    const result = await prettier.format(html, {
      parser: "html",
      printWidth: 1,
      tabWidth: 2,
      useTabs: false,
      semi: false,
      singleQuote: false,
      quoteProps: "as-needed",
      jsxSingleQuote: false,
      trailingComma: "none",
      bracketSpacing: false,
      bracketSameLine: false,
      arrowParens: "avoid",
      endOfLine: "lf",
    })
    return result
  } catch {
    return html
      .replace(/></g, ">\n<")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
  }
}

/** Создает diff с помощью библиотеки diff */
const createDiff = (received: string, expected: string) => {
  try {
    const differences = diffChars(received, expected)
    let diffOutput = ""

    differences.forEach((part) => {
      if (part.added) {
        diffOutput += `\x1b[32m${part.value}\x1b[0m`
      } else if (part.removed) {
        diffOutput += `\x1b[31m${part.value}\x1b[0m`
      } else {
        diffOutput += part.value
      }
    })

    return diffOutput
  } catch {
    return `Получено: ${received}\nОжидалось: ${expected}`
  }
}

const divider = "\n" + "-".repeat(20) + "\n"

const toMatchStringHTML = async (received: unknown, expected: string) => {
  const normalizedReceived = normalizeHTML(received as string)
  const normalizedExpected = normalizeHTML(expected)
  const pass = normalizedReceived === normalizedExpected

  if (pass) {
    return {
      message: () => `expected ${received} not to match ${expected} ignoring whitespace`,
      pass: true,
    }
  } else {
    try {
      console.log("__DEBUG_NORMALIZED_RECEIVED__:\n", normalizedReceived)
      console.log("__DEBUG_NORMALIZED_EXPECTED__:\n", normalizedExpected)
    } catch {}
    const formattedReceived = await formatHTML(normalizedReceived)
    const formattedExpected = await formatHTML(normalizedExpected)
    const diff = createDiff(formattedReceived, formattedExpected)

    return {
      message: () => `\x1b[1mHTML не совпадает:\x1b[0m${divider}${diff}${divider}`,
      pass: false,
    }
  }
}

expect.extend({
  /** Проверяет, что строка соответствует ожидаемой строке, игнорируя пробельные символы. */
  toMatchStringHTML,
})
