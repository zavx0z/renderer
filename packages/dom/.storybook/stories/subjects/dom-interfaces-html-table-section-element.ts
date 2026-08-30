import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_section_default = defineOwnerStory("dom/interfaces/html-table-section-element/section/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLTableSectionElement",
    title: "HTMLTableSectionElement · Секция",
    route: "dom/interfaces/html-table-section-element/section/default",
  }))
})
