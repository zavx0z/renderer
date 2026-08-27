import {describe, expect, it} from "bun:test"
import type {MutationBatch} from "../src/index.ts"
import {Text, createDocument} from "../src/index.ts"

describe("ParentNode convenience mutation", () => {
  it("converts strings to Text and batches append, prepend and replaceChildren", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const stable = document.createElement("span")
    const batches: MutationBatch[] = []
    document.append(root)
    document.subscribeMutations(batch => batches.push(batch))

    root.append("before", stable, "after")
    expect(root.childNodes[0]).toBeInstanceOf(Text)
    expect(root.childNodes).toEqual([
      root.childNodes[0]!,
      stable,
      root.childNodes[2]!
    ])
    expect(root.textContent).toBe("beforeafter")
    expect(batches).toHaveLength(1)

    batches.length = 0
    const first = document.createElement("button")
    root.prepend(first, "lead")
    expect(root.firstChild).toBe(first)
    expect(root.childNodes[1]?.textContent).toBe("lead")
    expect(batches).toHaveLength(1)

    batches.length = 0
    root.replaceChildren(stable, "tail")
    expect(root.childNodes[0]).toBe(stable)
    expect(root.childNodes[1]).toBeInstanceOf(Text)
    expect(root.textContent).toBe("tail")
    expect(first.parentNode).toBeNull()
    expect(batches).toHaveLength(1)
  })

  it("implements ParentNode methods on DocumentFragment and validates Document replacement", () => {
    const document = createDocument()
    const fragment = document.createDocumentFragment()
    const child = document.createElement("span")
    fragment.append("a", child)
    fragment.prepend("start")
    expect(fragment.textContent).toBe("starta")
    expect(fragment.childNodes[2]).toBe(child)

    fragment.replaceChildren(child, "end")
    expect(fragment.childNodes[0]).toBe(child)
    expect(fragment.textContent).toBe("end")

    const root = document.createElement("div")
    document.append(root)
    const first = document.createElement("span")
    const second = document.createElement("button")
    expect(() => document.replaceChildren(first, second)).toThrow()
    expect(document.documentElement).toBe(root)
  })
})

describe("ChildNode convenience mutation", () => {
  it("uses viable siblings when the receiver is also an argument", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const before = document.createElement("span")
    const subject = document.createElement("button")
    const after = document.createElement("span")
    document.append(root)
    root.append(before, subject, after)

    subject.before(subject, "one")
    const one = root.childNodes[2]!
    expect(root.childNodes).toEqual([before, subject, one, after])
    expect(one.textContent).toBe("one")

    subject.after("two", subject)
    const two = root.childNodes[1]!
    expect(root.childNodes).toEqual([before, two, subject, one, after])
    expect(two.textContent).toBe("two")
    expect(root.lastChild).toBe(after)

    subject.replaceWith("three", subject)
    const three = root.childNodes[2]!
    expect(root.childNodes).toEqual([before, two, three, subject, one, after])
    expect(three.textContent).toBe("three")
    expect(root.lastChild).toBe(after)
    expect(subject.parentNode).toBe(root)
  })

  it("supports CharacterData methods and detached remove as a no-op", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const text = document.createTextNode("middle")
    const comment = document.createComment("anchor")
    root.append(text, comment)

    text.before("before")
    comment.after("after")
    expect(root.textContent).toBe("beforemiddleafter")

    text.replaceWith("replacement")
    expect(text.parentNode).toBeNull()
    comment.remove()
    comment.remove()
    expect(comment.parentNode).toBeNull()
    expect(root.textContent).toBe("beforereplacementafter")
  })
})
