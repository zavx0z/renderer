import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_listeners_default = defineOwnerStory("dom/interfaces/event-target/listeners/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "EventTarget",
    title: "EventTarget · Слушатели",
    route: "dom/interfaces/event-target/listeners/default",
  }))
})
