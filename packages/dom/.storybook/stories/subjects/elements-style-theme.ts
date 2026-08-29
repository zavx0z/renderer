import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_tone_cyan = defineOwnerStory("elements/style/theme/tone/cyan", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/theme/tone/cyan"), elementDomStoryCss)
})

export const story_tone_green = defineOwnerStory("elements/style/theme/tone/green", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/theme/tone/green"), elementDomStoryCss)
})

export const story_tone_orange = defineOwnerStory("elements/style/theme/tone/orange", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/theme/tone/orange"), elementDomStoryCss)
})

export const story_tone_red = defineOwnerStory("elements/style/theme/tone/red", async (document) => {
  const {createElementDomStory, elementDomStoryCss} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/theme/tone/red"), elementDomStoryCss)
})
