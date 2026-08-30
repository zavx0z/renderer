import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_state_inactive = defineOwnerStory("elements/primitives/select/state/inactive", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/select/state/inactive"))
})

export const story_state_active = defineOwnerStory("elements/primitives/select/state/active", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/select/state/active"))
})

export const story_state_open = defineOwnerStory("elements/primitives/select/state/open", async (document) => {
  const {createPopoverDomStory} = await import("../helpers/popover-dom-story.ts")
  return routeStory(createPopoverDomStory(document, "elements/primitives/select/state/open"))
})

export const story_state_header = defineOwnerStory("elements/primitives/select/state/header", async (document) => {
  const {createPopoverDomStory} = await import("../helpers/popover-dom-story.ts")
  return routeStory(createPopoverDomStory(document, "elements/primitives/select/state/header"))
})

export const story_state_flipped = defineOwnerStory("elements/primitives/select/state/flipped", async (document) => {
  const {createPopoverDomStory} = await import("../helpers/popover-dom-story.ts")
  return routeStory(createPopoverDomStory(document, "elements/primitives/select/state/flipped"))
})

export const story_state_disabled = defineOwnerStory("elements/primitives/select/state/disabled", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/select/state/disabled"))
})
