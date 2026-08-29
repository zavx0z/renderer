import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_text_default = defineOwnerStory("dom/interfaces/html-paragraph-element/text/default", async (document) => {
  const {createDomInterfaceStory, domInterfaceStoryCss} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLParagraphElement",
    title: "HTMLParagraphElement · Текст",
    route: "dom/interfaces/html-paragraph-element/text/default",
  }), domInterfaceStoryCss)
})
