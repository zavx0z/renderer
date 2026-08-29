import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_detail_default = defineOwnerStory("dom/interfaces/ui-event/detail/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "UIEvent",
    title: "UIEvent · Detail",
    route: "dom/interfaces/ui-event/detail/default",
  }), domInterfaceStoryCss)
})
