import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_key_default = defineOwnerStory("dom/interfaces/keyboard-event/key/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "KeyboardEvent",
    title: "KeyboardEvent · Клавиша",
    route: "dom/interfaces/keyboard-event/key/default",
  }))
})
