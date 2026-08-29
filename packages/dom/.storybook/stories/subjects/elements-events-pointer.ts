import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_state_idle = defineOwnerStory("elements/events/pointer/state/idle", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/events/pointer/state/idle"), elementDomStoryCss)
})

export const story_state_hover = defineOwnerStory("elements/events/pointer/state/hover", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/events/pointer/state/hover"), elementDomStoryCss)
})

export const story_state_press = defineOwnerStory("elements/events/pointer/state/press", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/events/pointer/state/press"), elementDomStoryCss)
})

export const story_state_release = defineOwnerStory("elements/events/pointer/state/release", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/events/pointer/state/release"), elementDomStoryCss)
})

export const story_state_click = defineOwnerStory("elements/events/pointer/state/click", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/events/pointer/state/click"), elementDomStoryCss)
})

export const story_state_disabled = defineOwnerStory("elements/events/pointer/state/disabled", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/events/pointer/state/disabled"), elementDomStoryCss)
})
