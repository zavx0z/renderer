import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_propagation_default = defineOwnerStory("dom/interfaces/event/propagation/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "Event",
    title: "Event · Распространение",
    route: "dom/interfaces/event/propagation/default",
  }), domInterfaceStoryCss)
})
