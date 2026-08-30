import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_title_default = defineOwnerStory("dom/interfaces/html-element/title/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLElement",
    title: "HTMLElement · title",
    route: "dom/interfaces/html-element/title/default",
  }))
})
