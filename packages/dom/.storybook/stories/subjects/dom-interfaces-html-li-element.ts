import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_item_default = defineOwnerStory("dom/interfaces/html-li-element/item/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLLIElement",
    title: "HTMLLIElement · Элемент",
    route: "dom/interfaces/html-li-element/item/default",
  }), domInterfaceStoryCss)
})
