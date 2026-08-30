import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_value_default = defineOwnerStory("dom/interfaces/html-meter-element/value/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLMeterElement",
    title: "HTMLMeterElement · Диапазон",
    route: "dom/interfaces/html-meter-element/value/default",
  }))
})
