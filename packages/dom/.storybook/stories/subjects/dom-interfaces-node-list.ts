import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_snapshot_default = defineOwnerStory("dom/interfaces/node-list/snapshot/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "NodeList",
    title: "NodeList · Snapshot",
    route: "dom/interfaces/node-list/snapshot/default",
  }), domInterfaceStoryCss)
})
