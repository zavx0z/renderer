import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_list_default = defineOwnerStory("dom/interfaces/html-u-list-element/list/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLUListElement",
    title: "HTMLUListElement · Список",
    route: "dom/interfaces/html-u-list-element/list/default",
  }), domInterfaceStoryCss)
})
