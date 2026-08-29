import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_disabled_default = defineOwnerStory("dom/interfaces/html-field-set-element/disabled/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLFieldSetElement",
    title: "HTMLFieldSetElement · Disabled",
    route: "dom/interfaces/html-field-set-element/disabled/default",
  }), domInterfaceStoryCss)
})
