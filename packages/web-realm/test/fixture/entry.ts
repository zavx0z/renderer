// @zavx0z/web-realm no-transform
import * as application from "./ordinary-app.ts"
import {
  backend,
  flushPipeline,
  renderer,
  semanticDocument,
  semanticRoot,
  webRealm,
} from "./realm-binding.ts"

export const proof = Object.freeze({
  backend,
  button: application.button,
  card: application.card,
  flushPipeline,
  get activationCount() { return application.activationCount },
  label: application.label,
  realmDocument: application.realmDocument,
  renderer,
  semanticDocument,
  semanticRoot,
  get standardEventSeen() { return application.standardEventSeen },
  standardElementSeen: application.standardElementSeen,
  webRealm,
})
