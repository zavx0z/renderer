import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_detail_default = defineOwnerStory("dom/interfaces/custom-event/detail/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "CustomEvent",
    title: "CustomEvent · Detail",
    route: "dom/interfaces/custom-event/detail/default",
  }), domInterfaceStoryCss)
})
