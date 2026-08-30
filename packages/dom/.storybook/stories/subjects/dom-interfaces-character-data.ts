import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_data_default = defineOwnerStory("dom/interfaces/character-data/data/default", async (document) => {
  const {createDomInterfaceStory} = await import("../helpers/dom-interface-story.ts")
  return routeStory(createDomInterfaceStory(document, {
    apiName: "CharacterData",
    title: "CharacterData · Данные",
    route: "dom/interfaces/character-data/data/default",
  }))
})
