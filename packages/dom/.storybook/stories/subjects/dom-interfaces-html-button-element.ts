import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_activation_default = defineOwnerStory("dom/interfaces/html-button-element/activation/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLButtonElement",
    title: "HTMLButtonElement · Активация",
    route: "dom/interfaces/html-button-element/activation/default",
  }))
})
