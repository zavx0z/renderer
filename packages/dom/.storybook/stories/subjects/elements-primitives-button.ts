import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_state_default = defineOwnerStory("elements/primitives/button/state/default", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/button/state/default"), elementDomStoryCss)
})

export const story_state_disabled = defineOwnerStory("elements/primitives/button/state/disabled", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/button/state/disabled"), elementDomStoryCss)
})

export const story_state_clickable = defineOwnerStory("elements/primitives/button/state/clickable", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/button/state/clickable"), elementDomStoryCss)
})
