import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_anchors_default = defineOwnerStory("dom/interfaces/comment/anchors/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "Comment",
    title: "Comment · Якоря",
    route: "dom/interfaces/comment/anchors/default",
  }), domInterfaceStoryCss)
})
