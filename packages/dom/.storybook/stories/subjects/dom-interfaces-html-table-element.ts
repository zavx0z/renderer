import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_table_default = defineOwnerStory("dom/interfaces/html-table-element/table/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLTableElement",
    title: "HTMLTableElement · Таблица",
    route: "dom/interfaces/html-table-element/table/default",
  }))
})
