import {createDocument} from "@zavx0z/dom"
import {createRoot, memo, useState, type Dispatch, type SetStateAction} from "@zavx0z/react"

type Item = Readonly<{id: string; label: string}>

export let increment: () => void = () => {
  throw new Error("Counter is not mounted")
}

export let setItems: Dispatch<SetStateAction<readonly Item[]>> = () => {
  throw new Error("List is not mounted")
}

function Counter({label}: Readonly<{label: string}>) {
  const [count, setCount] = useState(1)
  const caption = `${label}: ${count * 2}`
  increment = () => setCount(value => value + 1)
  return <button data-kind="counter" onClick={() => setCount(value => value + 1)}>{caption}</button>
}

function Row({item}: Readonly<{item: Item}>) {
  return <li data-id={item.id}>{item.label}</li>
}

const MemoRow = memo(Row, (previous, next) => previous.item === next.item)

function App({label, initial}: Readonly<{label: string; initial: readonly Item[]}>) {
  const [items, updateItems] = useState(initial)
  setItems = updateItems
  return <div style={css`& { display: flex; width: 240px; }`}>
    <Counter label={label} />
    <ul>{items.map(item => <MemoRow key={item.id} item={item} />)}</ul>
  </div>
}

export const semanticDocument = createDocument()
export const semanticRoot = semanticDocument.createElement("main")
semanticDocument.appendChild(semanticRoot)
export const root = createRoot(semanticRoot)
root.render(<App label="Count" initial={[
  {id: "a", label: "Alpha"},
  {id: "b", label: "Beta"},
]} />)
