import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_data_default = defineOwnerStory("dom/interfaces/composition-event/data/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "CompositionEvent",
    title: "CompositionEvent · Данные",
    route: "dom/interfaces/composition-event/data/default",
  }))
})
