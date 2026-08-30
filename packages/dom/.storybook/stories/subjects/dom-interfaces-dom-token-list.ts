import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_classes_default = defineOwnerStory("dom/interfaces/dom-token-list/classes/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "DOMTokenList",
    title: "DOMTokenList · Классы",
    route: "dom/interfaces/dom-token-list/classes/default",
  }))
})
