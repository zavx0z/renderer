import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_attributes_default = defineOwnerStory("dom/interfaces/html-image-element/attributes/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLImageElement",
    title: "HTMLImageElement · Атрибуты",
    route: "dom/interfaces/html-image-element/attributes/default",
  }), domInterfaceStoryCss)
})
