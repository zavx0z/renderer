import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_state_default = defineOwnerStory("elements/primitives/button/state/default", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/button/state/default"))
})

export const story_state_disabled = defineOwnerStory("elements/primitives/button/state/disabled", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/button/state/disabled"))
})

export const story_state_clickable = defineOwnerStory("elements/primitives/button/state/clickable", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/button/state/clickable"))
})
