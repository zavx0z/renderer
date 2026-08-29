import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_state_inactive = defineOwnerStory("elements/primitives/select/state/inactive", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/select/state/inactive"), elementDomStoryCss)
})

export const story_state_active = defineOwnerStory("elements/primitives/select/state/active", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/select/state/active"), elementDomStoryCss)
})

export const story_state_open = defineOwnerStory("elements/primitives/select/state/open", async (document) => {
  const {createPopoverDomStory, popoverDomStoryCss} = await import("../helpers/popover-dom-story.ts")
  return routeStory(createPopoverDomStory(document, "elements/primitives/select/state/open"), popoverDomStoryCss)
})

export const story_state_header = defineOwnerStory("elements/primitives/select/state/header", async (document) => {
  const {createPopoverDomStory, popoverDomStoryCss} = await import("../helpers/popover-dom-story.ts")
  return routeStory(createPopoverDomStory(document, "elements/primitives/select/state/header"), popoverDomStoryCss)
})

export const story_state_flipped = defineOwnerStory("elements/primitives/select/state/flipped", async (document) => {
  const {createPopoverDomStory, popoverDomStoryCss} = await import("../helpers/popover-dom-story.ts")
  return routeStory(createPopoverDomStory(document, "elements/primitives/select/state/flipped"), popoverDomStoryCss)
})

export const story_state_disabled = defineOwnerStory("elements/primitives/select/state/disabled", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/select/state/disabled"), elementDomStoryCss)
})
