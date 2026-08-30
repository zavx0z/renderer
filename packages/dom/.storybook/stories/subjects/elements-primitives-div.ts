import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_basic_background = defineOwnerStory("elements/primitives/div/basic/background", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/div/basic/background"))
})

export const story_basic_border = defineOwnerStory("elements/primitives/div/basic/border", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/div/basic/border"))
})

export const story_basic_padding = defineOwnerStory("elements/primitives/div/basic/padding", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/div/basic/padding"))
})

export const story_basic_z_index = defineOwnerStory("elements/primitives/div/basic/z-index", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/div/basic/z-index"))
})

export const story_overflow_nested = defineOwnerStory("elements/primitives/div/overflow/nested", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/div/overflow/nested"))
})

export const story_scroll_vertical = defineOwnerStory("elements/primitives/div/scroll/vertical", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/div/scroll/vertical"))
})

export const story_scroll_horizontal = defineOwnerStory("elements/primitives/div/scroll/horizontal", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/div/scroll/horizontal"))
})

export const story_scroll_both = defineOwnerStory("elements/primitives/div/scroll/both", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/div/scroll/both"))
})
