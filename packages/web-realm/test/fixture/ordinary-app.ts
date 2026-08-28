export const card = document.createElement("div")
export const button = document.createElement("button")
export const label = document.createTextNode("Ready")
export let activationCount = 0
export let standardEventSeen = false

card.setAttribute(
  "style",
  "display:flex; width:180px; height:40px; padding:4px; background:#111827",
)
button.setAttribute(
  "style",
  "width:96px; height:24px; background:#2563eb; color:#ffffff",
)
button.appendChild(label)
button.addEventListener("click", event => {
  standardEventSeen = event instanceof Event
  activationCount += 1
  label.data = `Clicked ${activationCount}`
})
card.appendChild(button)
document.documentElement!.appendChild(card)

export const standardElementSeen = button instanceof HTMLElement
export const realmDocument = document
