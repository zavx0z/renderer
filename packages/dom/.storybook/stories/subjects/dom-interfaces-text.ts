import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_data_default = defineOwnerStory("dom/interfaces/text/data/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "Text",
    title: "Text · Данные",
    route: "dom/interfaces/text/data/default",
  }))
})
