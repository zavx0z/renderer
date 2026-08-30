import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_states_default = defineOwnerStory("dom/interfaces/toggle-event/states/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "ToggleEvent",
    title: "ToggleEvent · Состояния",
    route: "dom/interfaces/toggle-event/states/default",
  }))
})
