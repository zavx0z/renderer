import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_samples_default = defineOwnerStory("dom/interfaces/pointer-event/samples/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "PointerEvent",
    title: "PointerEvent · Samples",
    route: "dom/interfaces/pointer-event/samples/default",
  }))
})
