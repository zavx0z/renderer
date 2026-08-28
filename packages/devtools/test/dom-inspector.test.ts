import {describe, expect, it} from "bun:test"
import {createDocument} from "@zavx0z/dom"
import {createDocumentRenderer} from "@zavx0z/renderer"
import {createDomInspector, type DomInspectorSnapshot} from "../src/index.ts"

describe("DOM inspector identity and snapshots", () => {
  it("assigns stable realm-local IDs and returns an immutable serializable tree", () => {
    const document = createDocument()
    const root = document.createElement("button")
    const text = document.createTextNode("Output")
    const comment = document.createComment("anchor")
    document.appendChild(root)
    root.setAttribute("id", "output")
    root.setAttribute("data-empty", "")
    root.appendChild(text)
    root.appendChild(comment)
    const inspector = createDomInspector({document})

    const rootId = inspector.idForNode(root)
    const textId = inspector.idForNode(text)
    expect(inspector.idForNode(root)).toBe(rootId)
    expect(inspector.nodeForId(rootId)).toBe(root)
    expect(inspector.nodeForId(textId)).toBe(text)
    expect(inspector.nodeForId(0)).toBeNull()

    const snapshot = inspector.snapshot(root)
    const rootRecord = record(snapshot, rootId)
    const textRecord = record(snapshot, textId)

    expect(snapshot.root).toBe(rootId)
    expect(snapshot.mutationVersion).toBe(document.version)
    expect(snapshot.stateVersion).toBe(document.stateVersion)
    expect(snapshot.nodes.map(({nodeName}) => nodeName)).toEqual([
      "BUTTON",
      "#text",
      "#comment",
    ])
    expect(rootRecord).toEqual({
      id: rootId,
      nodeType: 1,
      nodeName: "BUTTON",
      localName: "button",
      nodeValue: null,
      attributes: [
        {name: "id", value: "output"},
        {name: "data-empty", value: ""},
      ],
      parent: null,
      children: [textId, inspector.idForNode(comment)],
      state: {focused: false, scrollLeft: 0, scrollTop: 0},
    })
    expect(textRecord).toMatchObject({
      nodeType: 3,
      nodeName: "#text",
      localName: null,
      nodeValue: "Output",
      parent: rootId,
      children: [],
    })
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.nodes)).toBe(true)
    expect(Object.isFrozen(rootRecord)).toBe(true)
    expect(Object.isFrozen(rootRecord.attributes)).toBe(true)
    expect(Object.isFrozen(rootRecord.attributes[0])).toBe(true)
    expect(Object.isFrozen(rootRecord.children)).toBe(true)

    const otherDocument = createDocument()
    const foreign = otherDocument.createElement("div")
    expect(() => inspector.idForNode(foreign)).toThrow("another Document")
    expect(() => inspector.snapshot(foreign)).toThrow("another Document")
    inspector.dispose()
  })

  it("emits compact changed IDs, releases removed reverse refs and restores IDs on reinsert", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const branch = document.createElement("span")
    const text = document.createTextNode("Before")
    document.appendChild(root)
    root.appendChild(branch)
    branch.appendChild(text)
    const inspector = createDomInspector({document})
    inspector.snapshot(document)
    const rootId = inspector.idForNode(root)
    const branchId = inspector.idForNode(branch)
    const textId = inspector.idForNode(text)
    const changes: Array<{
      kind: "mutation" | "state"
      mutationVersion: number
      stateVersion: number
      ids: readonly number[]
    }> = []
    let branchVisibleDuringRemoval = false
    const unsubscribe = inspector.subscribe((change) => {
      changes.push({
        kind: change.kind,
        mutationVersion: change.mutationVersion,
        stateVersion: change.stateVersion,
        ids: change.changedNodeIds,
      })
      if (!document.contains(branch) && change.changedNodeIds.includes(branchId))
        branchVisibleDuringRemoval = inspector.nodeForId(branchId) === branch
      expect(Object.isFrozen(change)).toBe(true)
      expect(Object.isFrozen(change.changedNodeIds)).toBe(true)
    })

    document.transaction(() => {
      root.setAttribute("data-state", "updated")
      text.data = "After"
    })
    expect(changes.at(-1)).toEqual({
      kind: "mutation",
      mutationVersion: document.version,
      stateVersion: document.stateVersion,
      ids: [rootId, textId],
    })
    expect(record(inspector.snapshot(root), textId).nodeValue).toBe("After")

    root.removeChild(branch)
    expect(changes.at(-1)?.ids).toEqual([rootId, branchId])
    expect(branchVisibleDuringRemoval).toBe(true)
    expect(inspector.nodeForId(branchId)).toBeNull()
    expect(inspector.nodeForId(textId)).toBeNull()

    root.appendChild(branch)
    expect(inspector.idForNode(branch)).toBe(branchId)
    expect(inspector.idForNode(text)).toBe(textId)
    expect(inspector.nodeForId(branchId)).toBe(branch)
    expect(inspector.nodeForId(textId)).toBe(text)

    const second = document.createElement("div")
    root.appendChild(second)
    second.appendChild(branch)
    expect(inspector.nodeForId(branchId)).toBe(branch)
    expect(inspector.idForNode(branch)).toBe(branchId)
    unsubscribe()
    inspector.dispose()
  })
})

describe("DOM inspector renderer projection", () => {
  it("serializes Image display identity without texture or Engine state", () => {
    const document = createDocument()
    const image = document.createElement("img")
    document.appendChild(image)
    image.src = "/assets/preview.png"
    image.width = 80
    image.height = 40
    const renderer = createDocumentRenderer({
      document,
      root: image,
      viewport: {width: 160, height: 90},
    })
    const inspector = createDomInspector({document, renderer})

    const snapshot = inspector.snapshot(image)
    expect(record(snapshot, inspector.idForNode(image)).display).toEqual([
      {key: "image", kind: "image"},
    ])
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    inspector.dispose()
    renderer.dispose()
  })

  it("projects current box, hit and display identity without Node references", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    const text = document.createTextNode("Output")
    document.appendChild(root)
    root.appendChild(button)
    button.appendChild(text)
    root.setAttribute(
      "style",
      "width:100px; height:50px; overflow:hidden; background:#222222",
    )
    button.setAttribute(
      "style",
      "width:60px; height:20px; padding:0; background:#333333",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 50},
    })
    const inspector = createDomInspector({document, renderer})
    const snapshot = inspector.snapshot(root)
    const rootRecord = record(snapshot, inspector.idForNode(root))
    const buttonRecord = record(snapshot, inspector.idForNode(button))
    const textRecord = record(snapshot, inspector.idForNode(text))

    expect(rootRecord.box).toMatchObject({width: 100, height: 50})
    expect(rootRecord.hit).toMatchObject({interactive: false, role: null, clips: []})
    expect(rootRecord.display).toEqual([{key: "background", kind: "rect"}])
    expect(buttonRecord.box).toMatchObject({width: 60, height: 20})
    expect(buttonRecord.hit).toMatchObject({
      interactive: true,
      disabled: false,
      role: "button",
    })
    expect(buttonRecord.hit?.clips).toHaveLength(1)
    expect(buttonRecord.display).toEqual([{key: "background", kind: "rect"}])
    expect(textRecord.display).toEqual([{key: "text", kind: "text"}])
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(Object.isFrozen(buttonRecord.box)).toBe(true)
    expect(Object.isFrozen(buttonRecord.box?.border)).toBe(true)
    expect(Object.isFrozen(buttonRecord.hit?.clips)).toBe(true)

    button.setAttribute(
      "style",
      "width:70px; height:24px; padding:0; background:#333333",
    )
    text.data = "Changed"
    const updated = inspector.snapshot(root)
    expect(record(updated, inspector.idForNode(button)).box).toMatchObject({
      width: 70,
      height: 24,
    })
    expect(record(updated, inspector.idForNode(text)).nodeValue).toBe("Changed")
    expect(updated.mutationVersion).toBe(document.version)
    expect(updated.stateVersion).toBe(document.stateVersion)

    const semanticOnly = createDomInspector({document})
    const semanticRecord = record(
      semanticOnly.snapshot(root),
      semanticOnly.idForNode(button),
    )
    expect("box" in semanticRecord).toBe(false)
    expect("hit" in semanticRecord).toBe(false)
    expect("display" in semanticRecord).toBe(false)
    semanticOnly.dispose()
    inspector.dispose()
    renderer.dispose()
  })

  it("rejects a renderer from another DOM realm", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const otherDocument = createDocument()
    const otherRoot = otherDocument.createElement("div")
    otherDocument.appendChild(otherRoot)
    const renderer = createDocumentRenderer({
      document: otherDocument,
      root: otherRoot,
      viewport: {width: 1, height: 1},
    })

    expect(() => createDomInspector({document, renderer})).toThrow(
      "another Document",
    )
    renderer.dispose()
  })
})

describe("DOM inspector live state", () => {
  it("separates state and mutation versions and snapshots live element properties", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    document.appendChild(root)
    root.appendChild(input)
    input.type = "checkbox"
    const inspector = createDomInspector({document})
    const rootId = inspector.idForNode(root)
    const inputId = inspector.idForNode(input)
    const initial = inspector.snapshot(root)
    const initialMutationVersion = initial.mutationVersion
    const initialStateVersion = initial.stateVersion

    expect(record(initial, rootId).state).toEqual({
      focused: false,
      scrollLeft: 0,
      scrollTop: 0,
    })
    expect(record(initial, inputId).state).toEqual({
      focused: false,
      scrollLeft: 0,
      scrollTop: 0,
      type: "checkbox",
      value: "on",
      checked: false,
      selectionStart: null,
      selectionEnd: null,
      selectionDirection: null,
    })

    input.focus()
    const focused = inspector.snapshot(root)
    expect(focused.stateVersion).toBe(initialStateVersion + 1)
    expect(record(focused, inputId).state).toMatchObject({focused: true})

    const changes: Array<Parameters<Parameters<typeof inspector.subscribe>[0]>[0]> = []
    inspector.subscribe((change) => {
      changes.push(change)
      expect(Object.isFrozen(change)).toBe(true)
      expect(Object.isFrozen(change.changedNodeIds)).toBe(true)
    })
    document.transaction(() => {
      root.scrollTop = 12
      root.scrollLeft = 4
      input.value = "live"
      input.checked = true
    })

    expect(document.version).toBe(initialMutationVersion)
    expect(document.stateVersion).toBe(initialStateVersion + 2)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toEqual({
      kind: "state",
      mutationVersion: initialMutationVersion,
      stateVersion: document.stateVersion,
      changedNodeIds: [rootId, inputId],
    })
    const stateSnapshot = inspector.snapshot(root)
    expect(stateSnapshot).toMatchObject({
      mutationVersion: initialMutationVersion,
      stateVersion: document.stateVersion,
    })
    expect(record(stateSnapshot, rootId).state).toEqual({
      focused: false,
      scrollLeft: 4,
      scrollTop: 12,
    })
    expect(record(stateSnapshot, inputId).state).toEqual({
      focused: true,
      scrollLeft: 0,
      scrollTop: 0,
      type: "checkbox",
      value: "live",
      checked: true,
      selectionStart: null,
      selectionEnd: null,
      selectionDirection: null,
    })
    expect(Object.isFrozen(record(stateSnapshot, inputId).state)).toBe(true)
    expect(record(stateSnapshot, inputId).attributes).toEqual([
      {name: "type", value: "checkbox"},
    ])

    root.scrollTop = 12
    input.value = "live"
    expect(changes).toHaveLength(1)
    root.setAttribute("data-owner", "mutation")
    expect(changes).toHaveLength(2)
    expect(changes[1]).toEqual({
      kind: "mutation",
      mutationVersion: document.version,
      stateVersion: document.stateVersion,
      changedNodeIds: [rootId],
    })
    inspector.dispose()
  })

  it("snapshots input and textarea selection without treating it as attributes", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    const textArea = document.createElement("textarea")
    root.append(input, textArea)
    document.appendChild(root)
    input.value = "output"
    input.setSelectionRange(1, 4, "forward")
    textArea.value = "first\nsecond"
    textArea.setSelectionRange(2, 8, "backward")
    const inspector = createDomInspector({document})

    expect(record(inspector.snapshot(root), inspector.idForNode(input)).state).toMatchObject({
      value: "output",
      selectionStart: 1,
      selectionEnd: 4,
      selectionDirection: "forward",
    })
    expect(record(inspector.snapshot(root), inspector.idForNode(textArea)).state).toMatchObject({
      value: "first\nsecond",
      rows: 2,
      cols: 20,
      selectionStart: 2,
      selectionEnd: 8,
      selectionDirection: "backward",
    })
    expect(record(inspector.snapshot(root), inspector.idForNode(textArea)).attributes).toEqual([])
    inspector.dispose()
  })
})

describe("DOM inspector lifecycle", () => {
  it("dispose is idempotent and releases subscriptions and reverse references", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const inspector = createDomInspector({document})
    const id = inspector.idForNode(root)
    let notifications = 0
    const unsubscribe = inspector.subscribe(() => notifications++)

    inspector.dispose()
    inspector.dispose()
    root.setAttribute("data-after-dispose", "true")
    root.scrollTop = 10

    expect(notifications).toBe(0)
    expect(inspector.nodeForId(id)).toBeNull()
    expect(inspector.nodeForId(Number.NaN)).toBeNull()
    expect(() => inspector.idForNode(root)).toThrow("disposed")
    expect(() => inspector.snapshot(root)).toThrow("disposed")
    expect(() => inspector.subscribe(() => {})).toThrow("disposed")
    expect(unsubscribe).not.toThrow()
  })
})

const record = (snapshot: DomInspectorSnapshot, id: number) => {
  const value = snapshot.nodes.find((node) => node.id === id)
  if (!value) throw new Error(`Missing node ${id}`)
  return value
}
