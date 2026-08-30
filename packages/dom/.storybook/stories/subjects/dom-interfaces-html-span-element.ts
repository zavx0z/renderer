import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_inline_default = defineOwnerStory("dom/interfaces/html-span-element/inline/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLSpanElement",
    title: "HTMLSpanElement · Строка",
    route: "dom/interfaces/html-span-element/inline/default",
  }))
})
