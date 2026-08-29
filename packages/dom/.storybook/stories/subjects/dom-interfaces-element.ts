import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_attributes_default = defineOwnerStory("dom/interfaces/element/attributes/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "Element",
    title: "Element · Атрибуты",
    route: "dom/interfaces/element/attributes/default",
  }), domInterfaceStoryCss)
})
