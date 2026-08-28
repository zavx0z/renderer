import {createDocument} from "@zavx0z/dom"
import {createRoot} from "@zavx0z/react"
import {ImportedCounter} from "./imported-counter.tsx"

export const document = createDocument()
export const host = document.createElement("main")
document.appendChild(host)
export const root = createRoot(host)
root.render(<ImportedCounter label="Imported" />)
