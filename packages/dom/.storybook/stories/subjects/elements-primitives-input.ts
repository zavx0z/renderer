import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_state_inactive = defineOwnerStory("elements/primitives/input/state/inactive", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/input/state/inactive"), elementDomStoryCss)
})

export const story_state_active = defineOwnerStory("elements/primitives/input/state/active", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/input/state/active"), elementDomStoryCss)
})

export const story_state_disabled = defineOwnerStory("elements/primitives/input/state/disabled", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/input/state/disabled"), elementDomStoryCss)
})
