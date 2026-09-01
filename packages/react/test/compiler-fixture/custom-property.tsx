import {
  createDocument,
  readDocumentCompiledStyleSheets
} from "@zavx0z/dom"
import {
  createDocumentInteractionState,
  createDocumentRenderer,
  type RectDisplayItem
} from "@zavx0z/renderer"
import {createRoot} from "@zavx0z/react"

function HoverButton(props: Readonly<{label: string; hoverColor: string}>) {
  return <button style={css`
    --hover-color: ${props.hoverColor};
    display: block;
    width: 40px;
    height: 20px;
    background: #000000;

    &:hover {
      background: var(--hover-color);
    }
  `}>{props.label}</button>
}

function App(props: Readonly<{first: string; second: string}>) {
  return <main style={css`
    display: flex;
    width: 80px;
    height: 20px;
  `}>
    <HoverButton label="First" hoverColor={props.first} />
    <HoverButton label="Second" hoverColor={props.second} />
  </main>
}

export const document = createDocument()
export const host = document.createElement("div")
document.appendChild(host)
export const root = createRoot(host)
root.render(<App first="#112233" second="#445566" />)
export const interactionState = createDocumentInteractionState(document)
export const renderer = createDocumentRenderer({
  document,
  root: host,
  viewport: {width: 80, height: 20},
  interactionState,
  styleSheets: []
})

export function renderColors(first: string, second: string): void {
  root.render(<App first={first} second={second} />)
}

export function hover(index: number | null): void {
  const buttons = [...host.querySelectorAll("button")]
  interactionState.setHoveredElement(index === null ? null : buttons[index] ?? null)
}

export function backgrounds(): readonly string[] {
  const frame = renderer.flush()
  return [...host.querySelectorAll("button")].map(button => {
    const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
      candidate.kind === "rect" && candidate.node === button && candidate.key === "background"
    )
    if (!item) throw new Error("Compiled HoverButton background is missing")
    return item.color
  })
}

export function styleSheetCount(): number {
  return readDocumentCompiledStyleSheets(document).styleSheets.length
}

export function hoverStyleSheetCount(): number {
  return readDocumentCompiledStyleSheets(document).styleSheets.filter(styleSheet =>
    styleSheet.cssText.includes("var(--hover-color)")
  ).length
}

export function dispose(): void {
  renderer.dispose()
  root.unmount()
}
