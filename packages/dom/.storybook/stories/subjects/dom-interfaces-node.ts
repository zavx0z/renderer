import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_hierarchy_default = defineOwnerStory("dom/interfaces/node/hierarchy/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "Node",
    title: "Node · Иерархия",
    route: "dom/interfaces/node/hierarchy/default",
  }), domInterfaceStoryCss)
})
