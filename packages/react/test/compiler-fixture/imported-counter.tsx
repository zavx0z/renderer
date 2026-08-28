import {useState} from "@zavx0z/react"

export function ImportedCounter({label}: Readonly<{label: string}>) {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(value => value + 1)}>{label}: {count}</button>
}
