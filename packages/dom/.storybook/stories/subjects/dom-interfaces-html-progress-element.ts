import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_value_default = defineOwnerStory("dom/interfaces/html-progress-element/value/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLProgressElement",
    title: "HTMLProgressElement · Прогресс",
    route: "dom/interfaces/html-progress-element/value/default",
  }))
})
