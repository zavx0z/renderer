import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_content_left = defineOwnerStory("elements/primitives/span/content/left", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/span/content/left"), elementDomStoryCss)
})

export const story_content_center = defineOwnerStory("elements/primitives/span/content/center", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/span/content/center"), elementDomStoryCss)
})

export const story_content_right = defineOwnerStory("elements/primitives/span/content/right", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/span/content/right"), elementDomStoryCss)
})
