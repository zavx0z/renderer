import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_pointer_default = defineOwnerStory("dom/interfaces/mouse-event/pointer/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "MouseEvent",
    title: "MouseEvent · Указатель",
    route: "dom/interfaces/mouse-event/pointer/default",
  }))
})
