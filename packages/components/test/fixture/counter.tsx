import {useState} from "@zavx0z/dom-components"

export type CounterProps = Readonly<{
  initial: number
  label: string
  step: number
}>

export function Counter(props: CounterProps) {
  const [count, setCount] = useState(props.initial)
  return <button
    data-component="counter"
    onClick={() => setCount(value => value + props.step)}
    style={{
      display: "flex",
      width: 180,
      height: 40,
      padding: 6,
      background: "#2563eb",
      color: "#ffffff",
    }}
  >{props.label}: {count}</button>
}
