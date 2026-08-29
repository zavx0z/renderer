import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_mutation_default = defineOwnerStory("dom/interfaces/document-fragment/mutation/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "DocumentFragment",
    title: "DocumentFragment · Мутация",
    route: "dom/interfaces/document-fragment/mutation/default",
  }), domInterfaceStoryCss)
})
