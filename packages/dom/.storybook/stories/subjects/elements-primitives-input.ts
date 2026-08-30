import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_state_inactive = defineOwnerStory("elements/primitives/input/state/inactive", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/input/state/inactive"))
})

export const story_state_active = defineOwnerStory("elements/primitives/input/state/active", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/input/state/active"))
})

export const story_state_disabled = defineOwnerStory("elements/primitives/input/state/disabled", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/input/state/disabled"))
})
