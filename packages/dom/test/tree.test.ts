import {describe, expect, it} from "bun:test"
import {
  CharacterData,
  Comment,
  Document,
  DocumentFragment,
  Element,
  HTMLButtonElement,
  HTMLDivElement,
  HTMLElement,
  HTMLInputElement,
  HTMLSpanElement,
  Node,
  Text,
  createDocument
} from "../src/index.ts"

describe("DOM hierarchy and factories", () => {
  it("creates the exact public class hierarchy", () => {
    const document = createDocument()
    const div = document.createElement("div")
    const span = document.createElement("span")
    const button = document.createElement("button")
    const custom = document.createElement("panel")
    const input = document.createElement("input")
    const text = document.createTextNode("hello")
    const comment = document.createComment("region:start")
    const fragment = document.createDocumentFragment()

    expect(document).toBeInstanceOf(Document)
    expect(document).toBeInstanceOf(Node)
    expect(div).toBeInstanceOf(HTMLDivElement)
    expect(div).toBeInstanceOf(HTMLElement)
    expect(div).toBeInstanceOf(Element)
    expect(div).toBeInstanceOf(Node)
    expect(span).toBeInstanceOf(HTMLSpanElement)
    expect(button).toBeInstanceOf(HTMLButtonElement)
    expect(custom).toBeInstanceOf(HTMLElement)
    expect(input).toBeInstanceOf(HTMLInputElement)
    expect(input).toBeInstanceOf(HTMLElement)
    expect(text).toBeInstanceOf(Text)
    expect(comment).toBeInstanceOf(Comment)
    expect(comment).toBeInstanceOf(CharacterData)
    expect(comment).toBeInstanceOf(Node)
    expect(comment.nodeType).toBe(Node.COMMENT_NODE)
    expect(comment.COMMENT_NODE).toBe(8)
    expect(comment.nodeName).toBe("#comment")
    expect(fragment).toBeInstanceOf(DocumentFragment)
    expect(div.ownerDocument).toBe(document)
    expect(document.ownerDocument).toBeNull()
  })
})

describe("ordered tree mutation", () => {
  it("preserves identity and exact parent/sibling relationships", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = document.createElement("span")
    const second = document.createElement("button")
    const third = document.createElement("span")

    document.appendChild(root)
    root.appendChild(first)
    root.appendChild(third)
    root.insertBefore(second, third)

    expect(document.documentElement).toBe(root)
    expect(root.childNodes).toEqual([first, second, third])
    expect(root.children).toEqual([first, second, third])
    expect(root.firstChild).toBe(first)
    expect(root.lastChild).toBe(third)
    expect(first.nextSibling).toBe(second)
    expect(second.previousSibling).toBe(first)
    expect(second.nextSibling).toBe(third)
    expect(third.previousSibling).toBe(second)
    expect(second.parentNode).toBe(root)
    expect(second.parentElement).toBe(root)
    expect(second.getRootNode()).toBe(document)
    expect(second.isConnected).toBe(true)

    root.appendChild(first)
    expect(root.childNodes).toEqual([second, third, first])
    expect(root.lastChild).toBe(first)

    expect(root.removeChild(third)).toBe(third)
    expect(third.parentNode).toBeNull()
    expect(third.previousSibling).toBeNull()
    expect(third.nextSibling).toBeNull()
    expect(third.isConnected).toBe(false)
  })

  it("preserves focus and listeners when a node is reparented inside one Document", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = document.createElement("div")
    const second = document.createElement("div")
    const button = document.createElement("button")
    let clicks = 0
    button.addEventListener("click", () => { clicks += 1 })
    document.appendChild(root)
    root.append(first, second)
    first.appendChild(button)
    button.focus()

    second.appendChild(button)
    button.click()

    expect(button.parentNode).toBe(second)
    expect(button.ownerDocument).toBe(document)
    expect(document.activeElement).toBe(button)
    expect(clicks).toBe(1)

    const detached = document.createElement("div")
    detached.appendChild(button)
    expect(document.activeElement).toBeNull()
  })

  it("splices DocumentFragment children and replaces in place", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const before = document.createElement("span")
    const replaced = document.createElement("button")
    const after = document.createElement("span")
    const fragment = document.createDocumentFragment()
    const one = document.createElement("div")
    const two = document.createTextNode("two")

    document.appendChild(root)
    root.appendChild(before)
    root.appendChild(replaced)
    root.appendChild(after)
    fragment.appendChild(one)
    fragment.appendChild(two)

    expect(root.replaceChild(fragment, replaced)).toBe(replaced)
    expect(fragment.childNodes).toEqual([])
    expect(root.childNodes).toEqual([before, one, two, after])
    expect(one.parentNode).toBe(root)
    expect(two.previousSibling).toBe(one)
    expect(replaced.parentNode).toBeNull()
  })

  it("keeps Comment identity as an ordered region anchor", () => {
    const document = createDocument()
    const beforeRoot = document.createComment("document")
    const root = document.createElement("div")
    const start = document.createComment("region:start")
    const value = document.createTextNode("value")
    const end = document.createComment("region:end")

    document.appendChild(beforeRoot)
    document.appendChild(root)
    root.appendChild(start)
    root.appendChild(end)
    root.insertBefore(value, end)

    expect(document.documentElement).toBe(root)
    expect(document.children).toEqual([root])
    expect(root.childNodes).toEqual([start, value, end])
    expect(start.nextSibling).toBe(value)
    expect(end.previousSibling).toBe(value)
    expect(root.removeChild(value)).toBe(value)
    expect(root.childNodes).toEqual([start, end])
    expect(root.firstChild).toBe(start)
    expect(root.lastChild).toBe(end)
  })

  it("rejects cycles and invalid Document children", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("span")
    document.appendChild(root)
    root.appendChild(child)

    expect(() => child.appendChild(root)).toThrow()
    expect(() => document.appendChild(document.createElement("span"))).toThrow()
    expect(() => document.appendChild(document.createTextNode("invalid"))).toThrow()

    try {
      child.appendChild(root)
    } catch (error) {
      expect((error as Error).name).toBe("HierarchyRequestError")
    }
  })

  it("adopts a moved subtree into the destination Document", () => {
    const source = createDocument()
    const destination = createDocument()
    const root = source.createElement("div")
    const text = source.createTextNode("owned")
    root.appendChild(text)
    source.appendChild(root)

    destination.appendChild(root)

    expect(source.documentElement).toBeNull()
    expect(destination.documentElement).toBe(root)
    expect(root.ownerDocument).toBe(destination)
    expect(text.ownerDocument).toBe(destination)
  })
})

describe("textContent", () => {
  it("reads descendant text and replaces children with stable Text nodes", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const span = document.createElement("span")
    document.appendChild(root)
    root.appendChild(document.createTextNode("one"))
    const anchor = document.createComment("ignored")
    root.appendChild(anchor)
    span.appendChild(document.createTextNode("two"))
    root.appendChild(span)

    expect(root.textContent).toBe("onetwo")
    expect(anchor.textContent).toBe("ignored")
    expect(document.textContent).toBeNull()

    root.textContent = "replacement"
    const replacement = root.firstChild
    expect(replacement).toBeInstanceOf(Text)
    expect(replacement?.textContent).toBe("replacement")
    expect(root.childNodes).toEqual([replacement!])

    root.textContent = ""
    expect(root.childNodes).toEqual([])
  })
})

describe("attributes and reflection", () => {
  it("distinguishes absence from an empty title", () => {
    const document = createDocument()
    const element = document.createElement("div")
    const storage = () => (element as unknown as {
      attributeValues: Map<string, string> | null
    }).attributeValues

    expect(storage()).toBeNull()
    expect(element.hasAttribute("title")).toBe(false)
    expect(element.getAttribute("title")).toBeNull()
    expect(element.title).toBe("")
    expect(storage()).toBeNull()

    element.title = ""
    expect(storage()).toBeInstanceOf(Map)
    expect(element.hasAttribute("TITLE")).toBe(true)
    expect(element.getAttribute("title")).toBe("")

    element.title = "Output"
    expect(element.getAttribute("TITLE")).toBe("Output")
    element.removeAttribute("TiTlE")
    expect(element.hasAttribute("title")).toBe(false)
    expect(element.title).toBe("")
    expect(storage()).toBeNull()
  })

  it("reflects string and boolean attributes by HTML presence rules", () => {
    const document = createDocument()
    const div = document.createElement("div")
    const button = document.createElement("button")

    div.id = "main"
    div.className = "panel active"
    expect(div.getAttributeNames()).toEqual(["id", "class"])
    expect(div.id).toBe("main")
    expect(div.className).toBe("panel active")

    button.setAttribute("disabled", "false")
    expect(button.disabled).toBe(true)
    button.disabled = true
    expect(button.getAttribute("disabled")).toBe("")
    button.disabled = false
    expect(button.hasAttribute("disabled")).toBe(false)
    button.disabled = true
    expect(button.getAttribute("disabled")).toBe("")
  })

  it("reflects hidden and removes hidden owners and descendants from focusability", () => {
    const document = createDocument()
    const owner = document.createElement("div")
    const button = document.createElement("button")
    owner.appendChild(button)
    document.appendChild(owner)

    expect(owner.hidden).toBeFalse()
    owner.hidden = true
    expect(owner.getAttribute("hidden")).toBe("")
    expect(owner.hidden).toBeTrue()
    button.focus()
    expect(document.activeElement).toBeNull()
    owner.hidden = false
    button.focus()
    expect(document.activeElement).toBe(button)
  })
})
