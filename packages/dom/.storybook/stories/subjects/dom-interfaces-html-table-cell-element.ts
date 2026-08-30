import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_cell_default = defineOwnerStory("dom/interfaces/html-table-cell-element/cell/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "HTMLTableCellElement",
    title: "HTMLTableCellElement · Ячейка",
    route: "dom/interfaces/html-table-cell-element/cell/default",
  }))
})
