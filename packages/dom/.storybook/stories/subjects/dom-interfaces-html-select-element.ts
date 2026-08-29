import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_selection_default = defineOwnerStory("dom/interfaces/html-select-element/selection/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLSelectElement",
    title: "HTMLSelectElement · Выбор",
    route: "dom/interfaces/html-select-element/selection/default",
  }), domInterfaceStoryCss)
})
