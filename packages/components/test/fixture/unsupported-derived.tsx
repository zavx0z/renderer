import {useState} from "@zavx0z/dom-components"

export function UnsupportedDerived() {
  const [count, setCount] = useState(1)
  const doubled = count * 2
  return <button onClick={() => setCount(value => value + 1)}>{doubled}</button>
}
