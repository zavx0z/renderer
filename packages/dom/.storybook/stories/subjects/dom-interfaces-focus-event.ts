import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_related_target_default = defineOwnerStory("dom/interfaces/focus-event/related-target/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "FocusEvent",
    title: "FocusEvent · Related target",
    route: "dom/interfaces/focus-event/related-target/default",
  }), domInterfaceStoryCss)
})
