import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_tree_default = defineOwnerStory("dom/interfaces/document/tree/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "Document",
    title: "Document · Дерево",
    route: "dom/interfaces/document/tree/default",
  }))
})
