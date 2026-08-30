import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_control_default = defineOwnerStory("dom/interfaces/html-label-element/control/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLLabelElement",
    title: "HTMLLabelElement · Control",
    route: "dom/interfaces/html-label-element/control/default",
  }))
})
