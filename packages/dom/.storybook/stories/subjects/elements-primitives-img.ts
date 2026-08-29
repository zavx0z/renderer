import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_fit_cover = defineOwnerStory("elements/primitives/img/fit/cover", async (document) => {
  const {createImageDomStory, imageDomStoryCss} = await import("../helpers/image-dom-story.ts")
  return routeStory(createImageDomStory(document, "elements/primitives/img/fit/cover"), imageDomStoryCss)
})

export const story_fit_contain = defineOwnerStory("elements/primitives/img/fit/contain", async (document) => {
  const {createImageDomStory, imageDomStoryCss} = await import("../helpers/image-dom-story.ts")
  return routeStory(createImageDomStory(document, "elements/primitives/img/fit/contain"), imageDomStoryCss)
})
