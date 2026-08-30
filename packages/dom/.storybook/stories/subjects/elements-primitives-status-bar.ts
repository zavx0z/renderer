import {defineOwnerStory, routeStory} from "../story-types.ts"

export const story_content_statistics = defineOwnerStory("elements/primitives/status-bar/content/statistics", async (document) => {
  const {createElementDomStory} = await import("../helpers/element-dom-story.ts")
  return routeStory(createElementDomStory(document, "elements/primitives/status-bar/content/statistics"))
})
