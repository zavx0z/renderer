import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_state_closed = defineOwnerStory("elements/primitives/popover/state/closed", async (document) => {
  const {createPopoverDomStory} = await import("../helpers/popover-dom-story.ts")
  return routeStory(createPopoverDomStory(document, "elements/primitives/popover/state/closed"))
})

export const story_state_open = defineOwnerStory("elements/primitives/popover/state/open", async (document) => {
  const {createPopoverDomStory} = await import("../helpers/popover-dom-story.ts")
  return routeStory(createPopoverDomStory(document, "elements/primitives/popover/state/open"))
})
