import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_heading_default = defineOwnerStory("dom/interfaces/html-heading-element/heading/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLHeadingElement",
    title: "HTMLHeadingElement · Заголовок",
    route: "dom/interfaces/html-heading-element/heading/default",
  }))
})
