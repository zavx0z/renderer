import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_padding_default = defineOwnerStory("elements/style/css/padding/default", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/css/padding/default"))
})

export const story_flex_default = defineOwnerStory("elements/style/css/flex/default", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/css/flex/default"))
})

export const story_border_rounded = defineOwnerStory("elements/style/css/border/rounded", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/css/border/rounded"))
})

export const story_border_capsule = defineOwnerStory("elements/style/css/border/capsule", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/css/border/capsule"))
})

export const story_color_default = defineOwnerStory("elements/style/css/color/default", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/css/color/default"))
})

export const story_typography_default = defineOwnerStory("elements/style/css/typography/default", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/style/css/typography/default"))
})
