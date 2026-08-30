import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_value_default = defineOwnerStory("dom/interfaces/html-text-area-element/value/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLTextAreaElement",
    title: "HTMLTextAreaElement · Значение",
    route: "dom/interfaces/html-text-area-element/value/default",
  }))
})
