import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_container_default = defineOwnerStory("dom/interfaces/html-div-element/container/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLDivElement",
    title: "HTMLDivElement · Контейнер",
    route: "dom/interfaces/html-div-element/container/default",
  }), domInterfaceStoryCss)
})
