import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_selectedness_default = defineOwnerStory("dom/interfaces/html-option-element/selectedness/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLOptionElement",
    title: "HTMLOptionElement · Выбор",
    route: "dom/interfaces/html-option-element/selectedness/default",
  }))
})
