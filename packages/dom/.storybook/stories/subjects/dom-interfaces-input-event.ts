import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_data_default = defineOwnerStory("dom/interfaces/input-event/data/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "InputEvent",
    title: "InputEvent · Данные",
    route: "dom/interfaces/input-event/data/default",
  }), domInterfaceStoryCss)
})
