import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_mode_regular = defineOwnerStory("elements/primitives/list/mode/regular", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/list/mode/regular"), elementDomStoryCss)
})

export const story_mode_dense = defineOwnerStory("elements/primitives/list/mode/dense", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/list/mode/dense"), elementDomStoryCss)
})

export const story_mode_interactive = defineOwnerStory("elements/primitives/list/mode/interactive", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/list/mode/interactive"), elementDomStoryCss)
})

export const story_mode_scroll = defineOwnerStory("elements/primitives/list/mode/scroll", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/list/mode/scroll"), elementDomStoryCss)
})
