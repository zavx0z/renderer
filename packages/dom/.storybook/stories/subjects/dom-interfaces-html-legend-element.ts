import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_caption_default = defineOwnerStory("dom/interfaces/html-legend-element/caption/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLLegendElement",
    title: "HTMLLegendElement · Заголовок",
    route: "dom/interfaces/html-legend-element/caption/default",
  }), domInterfaceStoryCss)
})
