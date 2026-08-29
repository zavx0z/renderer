export type CompatibilityStatus = "supported" | "unsupported"

export type CapabilityStatus = "implemented" | "partial" | "unsupported" | "not-applicable" | "unverified"

const compatibilityData = {
  "package": "@zavx0z/react",
  "reference": "React 19.2 complete reference profile",
  "compilerOwner": "@zavx0z/template",
  "runtimeModel": "compiled-static-template",
  "reactPackageAlias": false,
  "npmReactDependency": false,
  "fiber": false,
  "virtualDom": false,
  "reactDomHost": false,
  "featureCount": 146,
  "statistics": {
    "specEntries": 217,
    "mappedEntries": 217,
    "implemented": 28,
    "partial": 50,
    "unsupported": 70,
    "not-applicable": 35,
    "unverified": 34,
    "missing": 0
  },
  "features": {
    "createRoot": "supported",
    "functionComponents": "supported",
    "nestedComponents": "supported",
    "memo": "supported",
    "keyedCollections": "supported",
    "conditionalRanges": "supported",
    "customHooks": "supported",
    "contextConsumer": "unsupported",
    "jsxContextProvider": "unsupported",
    "lowLevelContextProviders": "supported",
    "debugValueInspection": "unsupported",
    "effectEventCallsiteValidation": "unsupported",
    "governedReactImports": "unsupported",
    "templateCompilerAbi": "supported",
    "templateCompilerIntegration": "supported",
    "compilerExport": "unsupported",
    "tsxAuthoring": "supported",
    "browserTargetBuild": "supported",
    "browserExecution": "unsupported",
    "gpuInstancing": "unsupported",
    "passivePaintScheduling": "unsupported",
    "serverExternalStoreSnapshots": "unsupported",
    "sourceMaps": "unsupported",
    "staticTemplateIdentity": "supported",
    "strictModeEffectReplay": "unsupported"
  },
  "hooks": {
    "unstable_useCacheRefresh": "unsupported",
    "use": "unsupported",
    "useActionState": "unsupported",
    "useCallback": "supported",
    "useContext": "supported",
    "useDebugValue": "supported",
    "useDeferredValue": "unsupported",
    "useEffect": "supported",
    "useEffectEvent": "supported",
    "useId": "supported",
    "useImperativeHandle": "supported",
    "useInsertionEffect": "supported",
    "useLayoutEffect": "supported",
    "useMemo": "supported",
    "useOptimistic": "unsupported",
    "useReducer": "supported",
    "useRef": "supported",
    "useState": "supported",
    "useSyncExternalStore": "supported",
    "useTransition": "unsupported"
  },
  "capabilities": {
    "react.apis.react.act": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.apis.react.cache": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.apis.react.cachesignal": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.apis.react.captureownerstack": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.apis.react.createcontext": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Implemented as a compiled runtime adaptation, not an npm React implementation."
    },
    "react.apis.react.lazy": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.apis.react.memo": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Implemented as a compiled runtime adaptation, not an npm React implementation."
    },
    "react.apis.react.starttransition": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.apis.react.version": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.compiler-runtime.react-compiler-runtime.c": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.components.react.activity": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.components.react.fragment": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.components.react.profiler": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.components.react.strictmode": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.components.react.suspense": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.directives.use-client": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.directives.use-memo": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.directives.use-no-memo": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.directives.use-server": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.hooks.react.unstable_usecacherefresh": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The reference hook is absent or exported only as an explicit UnsupportedReactFeatureError path."
    },
    "react.hooks.react.use": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The reference hook is absent or exported only as an explicit UnsupportedReactFeatureError path."
    },
    "react.hooks.react.useactionstate": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The reference hook is absent or exported only as an explicit UnsupportedReactFeatureError path."
    },
    "react.hooks.react.usecallback": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
    },
    "react.hooks.react.usecontext": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
    },
    "react.hooks.react.usedebugvalue": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Debug values are retained, but no inspection integration exposes them."
    },
    "react.hooks.react.usedeferredvalue": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The reference hook is absent or exported only as an explicit UnsupportedReactFeatureError path."
    },
    "react.hooks.react.useeffect": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Commit ordering is bounded and synchronous; passive effects are not browser-after-paint and StrictMode replay is absent."
    },
    "react.hooks.react.useeffectevent": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
    },
    "react.hooks.react.useid": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
    },
    "react.hooks.react.useimperativehandle": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
    },
    "react.hooks.react.useinsertioneffect": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Commit ordering is bounded and synchronous; passive effects are not browser-after-paint and StrictMode replay is absent."
    },
    "react.hooks.react.uselayouteffect": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Commit ordering is bounded and synchronous; passive effects are not browser-after-paint and StrictMode replay is absent."
    },
    "react.hooks.react.usememo": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
    },
    "react.hooks.react.useoptimistic": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The reference hook is absent or exported only as an explicit UnsupportedReactFeatureError path."
    },
    "react.hooks.react.usereducer": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
    },
    "react.hooks.react.useref": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
    },
    "react.hooks.react.usestate": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Slot/order/identity behavior is implemented in a synchronous compiled runtime without Fiber, concurrency, StrictMode replay, or server semantics."
    },
    "react.hooks.react.usesyncexternalstore": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "Client subscription identity is implemented, but getServerSnapshot/SSR behavior is not."
    },
    "react.hooks.react.usetransition": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The reference hook is absent or exported only as an explicit UnsupportedReactFeatureError path."
    },
    "react.jsx-runtime.react-jsx-dev-runtime.fragment": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.jsx-runtime.react-jsx-dev-runtime.jsxdev": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.jsx-runtime.react-jsx-runtime.fragment": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.jsx-runtime.react-jsx-runtime.jsx": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.jsx-runtime.react-jsx-runtime.jsxs": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.legacy.react.children": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.legacy.react.cloneelement": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.legacy.react.component": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.legacy.react.createelement": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.legacy.react.createref": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.legacy.react.forwardref": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.legacy.react.isvalidelement": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.legacy.react.purecomponent": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "The React 19.2 public reference API is not implemented by @zavx0z/react."
    },
    "react.react-dom.react-dom-client.createroot": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-client.hydrateroot": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-client.version": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-server.rendertopipeablestream": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-server.rendertoreadablestream": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-server.rendertostaticmarkup": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-server.rendertostring": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-server.resume": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-server.resumetopipeablestream": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-server.version": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-static.prerender": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-static.prerendertonodestream": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-static.resumeandprerender": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-static.resumeandprerendertonodestream": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-static.version": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom-test-utils.act": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.createportal": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.flushsync": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.preconnect": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.prefetchdns": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.preinit": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.preinitmodule": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.preload": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.preloadmodule": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.requestformreset": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.unstable_batchedupdates": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.useformstate": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.useformstatus": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.react-dom.react-dom.version": {
      "status": "not-applicable",
      "conformance": "none",
      "limitation": null
    },
    "react.semantics.architecture-fiber": {
      "status": "implemented",
      "conformance": "extension",
      "limitation": null
    },
    "react.semantics.architecture-npm-react-dependency": {
      "status": "implemented",
      "conformance": "extension",
      "limitation": null
    },
    "react.semantics.architecture-react-dom-host": {
      "status": "implemented",
      "conformance": "extension",
      "limitation": null
    },
    "react.semantics.architecture-react-package-alias": {
      "status": "implemented",
      "conformance": "extension",
      "limitation": null
    },
    "react.semantics.architecture-virtual-dom": {
      "status": "implemented",
      "conformance": "extension",
      "limitation": null
    },
    "react.semantics.batching": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.browser-execution": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.browser-execution-evidence": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.browser-target-build": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.callback-refs": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.children": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.children-api": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.class-components": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.cleanup": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.clone-element": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.commit-phases": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.compiler-export": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.component-identity": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.concurrency": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.conditional-ranges": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.context": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.context-consumer": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.create-element": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.create-root": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.custom-hooks": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.debug-value-inspection": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.default-props": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.directives-actions": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.effect-event-callsite-validation": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.error-boundaries": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.failed-render-isolation": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.forward-ref": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.fragments": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.function-components": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.governed-react-imports": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.gpu-instancing": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.hydration": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.is-valid-element": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.jsx-context-provider": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.keys": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.lazy": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.low-level-context-providers": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.memo": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.nested-components": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.object-refs": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.passive-paint-scheduling": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.portals": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.props": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.render-phase-updates": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.render-update": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.scheduling": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.server-components": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.server-external-store-snapshots": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.server-rendering": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.source-maps": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.static-template-identity": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.strict-mode": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.strict-mode-effect-replay": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.strict-mode-replay": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.suspense": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.template-compiler-abi": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.template-compiler-integration": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.transitions": {
      "status": "unsupported",
      "conformance": "none",
      "limitation": "This React 19.2 reference behavior is not part of the current compiled runtime."
    },
    "react.semantics.tsx-authoring": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    },
    "react.semantics.unmount": {
      "status": "partial",
      "conformance": "adapted",
      "limitation": "The public authoring shape is familiar, but execution is synchronous, fixed-slot, non-Fiber, and compiled without React elements/VDOM."
    }
  }
} as const

export const reactCompatibility = Object.freeze({
  ...compatibilityData,
  features: Object.freeze(compatibilityData.features),
  hooks: Object.freeze(compatibilityData.hooks),
  capabilities: Object.freeze(compatibilityData.capabilities),
})

export type ReactCompatibilityManifest = typeof reactCompatibility
