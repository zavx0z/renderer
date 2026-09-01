import {describe, expect, it} from "bun:test"
import {
  HTMLElement,
  HTMLHeadingElement,
  HTMLLIElement,
  HTMLParagraphElement,
  HTMLTableCellElement,
  HTMLTableElement,
  HTMLTableRowElement,
  HTMLTableSectionElement,
  HTMLUListElement,
  createDocument
} from "../src/index.ts"

describe("structural HTML element factories", () => {
  it("maps standard HTMLElement-only tags to the exact generic prototype", () => {
    const document = createDocument()
    for (const tagName of [
      "aside",
      "code",
      "footer",
      "header",
      "nav",
      "section",
      "strong"
    ] as const) {
      const element = document.createElement(tagName)
      expect(Object.getPrototypeOf(element)).toBe(HTMLElement.prototype)
      expect(element.localName).toBe(tagName)
    }
  })

  it("creates exact list, heading and paragraph prototypes", () => {
    const document = createDocument()
    const ul = document.createElement("ul")
    const li = document.createElement("li")
    const paragraph = document.createElement("p")

    expect(ul).toBeInstanceOf(HTMLUListElement)
    expect(li).toBeInstanceOf(HTMLLIElement)
    expect(paragraph).toBeInstanceOf(HTMLParagraphElement)
    expect(ul).toBeInstanceOf(HTMLElement)
    expect(li.localName).toBe("li")
    expect(paragraph.tagName).toBe("P")

    for (const tagName of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
      const heading = document.createElement(tagName)
      expect(heading).toBeInstanceOf(HTMLHeadingElement)
      expect(heading).toBeInstanceOf(HTMLElement)
      expect(heading.localName).toBe(tagName)
    }
    expect(document.createElement("H1")).toBeInstanceOf(HTMLHeadingElement)
  })

  it("creates the shared exact table-family prototypes for every supported tag", () => {
    const document = createDocument()
    const table = document.createElement("table")
    const row = document.createElement("tr")
    const head = document.createElement("thead")
    const body = document.createElement("tbody")
    const foot = document.createElement("tfoot")
    const headerCell = document.createElement("th")
    const dataCell = document.createElement("td")

    expect(table).toBeInstanceOf(HTMLTableElement)
    expect(row).toBeInstanceOf(HTMLTableRowElement)
    for (const [section, localName] of [
      [head, "thead"],
      [body, "tbody"],
      [foot, "tfoot"]
    ] as const) {
      expect(section).toBeInstanceOf(HTMLTableSectionElement)
      expect(section.localName).toBe(localName)
    }
    for (const [cell, localName] of [
      [headerCell, "th"],
      [dataCell, "td"]
    ] as const) {
      expect(cell).toBeInstanceOf(HTMLTableCellElement)
      expect(cell.localName).toBe(localName)
    }
  })

  it("preserves exact identity in ordinary semantic composition", () => {
    const document = createDocument()
    const table = document.createElement("table")
    const head = document.createElement("thead")
    const headRow = document.createElement("tr")
    const header = document.createElement("th")
    const body = document.createElement("tbody")
    const bodyRow = document.createElement("tr")
    const cell = document.createElement("td")
    const list = document.createElement("ul")
    const item = document.createElement("li")
    const heading = document.createElement("h2")
    const paragraph = document.createElement("p")

    headRow.append(header)
    head.append(headRow)
    bodyRow.append(cell)
    body.append(bodyRow)
    table.append(head, body)
    item.append(heading, paragraph)
    list.append(item)
    document.append(table)

    expect(table.firstElementChild).toBe(head)
    expect(head.firstElementChild).toBe(headRow)
    expect(headRow.firstElementChild).toBe(header)
    expect(table.lastElementChild).toBe(body)
    expect(bodyRow.firstElementChild).toBe(cell)
    expect(list.firstElementChild).toBe(item)
    expect(item.childNodes).toEqual([heading, paragraph])
  })
})

describe("HTMLTableCellElement reflections", () => {
  it("reflects colSpan and rowSpan with standard defaults and getter clamps", () => {
    const cell = createDocument().createElement("td")

    expect(cell.colSpan).toBe(1)
    expect(cell.rowSpan).toBe(1)
    cell.setAttribute("colspan", "0")
    cell.setAttribute("rowspan", "0")
    expect(cell.colSpan).toBe(1)
    expect(cell.rowSpan).toBe(0)

    cell.colSpan = 5000
    cell.rowSpan = 70000
    expect(cell.getAttribute("colspan")).toBe("5000")
    expect(cell.getAttribute("rowspan")).toBe("70000")
    expect(cell.colSpan).toBe(1000)
    expect(cell.rowSpan).toBe(65534)

    cell.setAttribute("colspan", "999999999999999999999999999999")
    cell.setAttribute("rowspan", "999999999999999999999999999999")
    expect(cell.colSpan).toBe(1000)
    expect(cell.rowSpan).toBe(65534)
    cell.setAttribute("colspan", "-2")
    cell.setAttribute("rowspan", "-0")
    expect(cell.colSpan).toBe(1)
    expect(cell.rowSpan).toBe(1)

    cell.colSpan = -1
    cell.rowSpan = -1
    expect(cell.getAttribute("colspan")).toBe("1")
    expect(cell.getAttribute("rowspan")).toBe("1")
  })

  it("reflects scope limited to the standard known values", () => {
    const document = createDocument()
    const header = document.createElement("th")
    const dataCell = document.createElement("td")

    expect(header.scope).toBe("")
    header.scope = "ROW"
    expect(header.getAttribute("scope")).toBe("ROW")
    expect(header.scope).toBe("row")
    for (const scope of ["col", "rowgroup", "colgroup"]) {
      header.setAttribute("scope", scope)
      expect(header.scope).toBe(scope)
    }
    header.scope = "invalid"
    expect(header.getAttribute("scope")).toBe("invalid")
    expect(header.scope).toBe("")

    dataCell.scope = "col"
    expect(dataCell.scope).toBe("col")
  })

  it("does not fabricate table collections or algorithms", () => {
    const document = createDocument()
    const table = document.createElement("table")
    const section = document.createElement("tbody")
    const row = document.createElement("tr")
    const cell = document.createElement("td")
    const item = document.createElement("li")

    expect("rows" in table).toBe(false)
    expect("insertRow" in table).toBe(false)
    expect("tBodies" in table).toBe(false)
    expect("rows" in section).toBe(false)
    expect("insertRow" in section).toBe(false)
    expect("cells" in row).toBe(false)
    expect("insertCell" in row).toBe(false)
    expect("cellIndex" in cell).toBe(false)
    expect("value" in item).toBe(false)
  })
})
