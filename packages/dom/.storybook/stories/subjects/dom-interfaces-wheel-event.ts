import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_delta_default = defineOwnerStory("dom/interfaces/wheel-event/delta/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "WheelEvent",
    title: "WheelEvent · Delta",
    route: "dom/interfaces/wheel-event/delta/default",
  }))
})
