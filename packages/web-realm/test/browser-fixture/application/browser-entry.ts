// @zavx0z/web-realm no-transform
import * as application from "./ordinary-app.ts"
import {
  nativeDocument,
  nativeHTMLElement,
  nativeWindow,
  renderer,
  semanticDocument,
  semanticRoot,
  webRealm,
} from "./realm-binding.ts"

const firstFrame = renderer.flush()
const geometry = application.card.getBoundingClientRect()
application.button.click()
const secondFrame = renderer.flush()
let storageFailedClosed = false
try {
  void Reflect.get(webRealm.window, "localStorage")
} catch (error) {
  storageFailedClosed = error instanceof Error && error.name === "NotSupportedError"
}

const canvas = nativeDocument.querySelector("#host-canvas")
const checks = {
  delegatedNavigator: webRealm.window.navigator === nativeWindow.navigator,
  delegatedPerformance: webRealm.window.performance === nativeWindow.performance,
  delegatedURL: webRealm.window.URL === nativeWindow.URL,
  geometryFromRenderer: geometry.width > 0 && geometry.height > 0,
  hostCanvasIsNative: canvas instanceof nativeWindow.HTMLCanvasElement,
  mutationReachedRenderer:
    secondFrame.revision === firstFrame.revision + 1 &&
    secondFrame.displayList.some(item =>
      item.kind === "text" && item.node === application.label && item.text === "Clicked 1"
    ),
  nativeDocumentUnchanged: document === nativeDocument,
  nativeHTMLElementUnchanged: HTMLElement === nativeHTMLElement,
  nativeWindowUnchanged: window === nativeWindow,
  realmDocumentIsSemantic:
    application.realmDocument === semanticDocument &&
    webRealm.window.document === semanticDocument &&
    semanticRoot.firstChild === application.card,
  semanticElementIdentity:
    application.standardElementSeen &&
    application.button instanceof webRealm.window.HTMLElement &&
    !(application.button instanceof nativeHTMLElement),
  standardEventMutation:
    application.activationCount === 1 &&
    application.standardEventSeen &&
    application.label.data === "Clicked 1",
  storageFailedClosed,
}
const passed = Object.values(checks).every(Boolean)
const output = nativeDocument.querySelector("#result")
if (!(output instanceof nativeWindow.HTMLElement)) {
  throw new Error("Missing native browser proof output")
}
output.dataset.status = passed ? "pass" : "fail"
output.textContent = `${passed ? "PASS" : "FAIL"}\n${JSON.stringify(checks, null, 2)}`
