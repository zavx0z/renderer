import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_row_default = defineOwnerStory("dom/interfaces/html-table-row-element/row/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLTableRowElement",
    title: "HTMLTableRowElement · Строка",
    route: "dom/interfaces/html-table-row-element/row/default",
  }))
})
