# Custom Adapters — moost

Build an adapter for a new event source (queue, Kafka, MQTT, GraphQL sub, scheduled job…). Power-user territory but supported first-class.

- [TMoostAdapter](#tmoostadapter)
- [TMoostAdapterOptions](#tmoostadapteroptions)
- [defineMoostEventHandler](#definemoosteventhandler)
- [Hook options](#hook-options)
- [Minimal adapter](#minimal-adapter)
- [Handler decorators](#handler-decorators)
- [Scope management](#scope-management)
- [Parameter resolvers](#parameter-resolvers)
- [Custom metadata extension](#custom-metadata-extension)
- [Not-found handler](#not-found-handler)
- [Real-world adapter sketches](#real-world-adapter-sketches)
- [Utility exports](#utility-exports-from-moost)
- [Gotchas](#gotchas)

Adapter flow: `app.adapter(a)` registers → during `app.init()` Moost calls `a.bindHandler(opts)` per controller method → `a.onInit(moost)` at the end → adapter starts receiving events → each event runs inside a Wooks event context, calling the function returned by `defineMoostEventHandler()`.

## TMoostAdapter

`import type { TMoostAdapter, TMoostAdapterOptions } from 'moost'`. An adapter implements four members:

| Member | What you implement |
|---|---|
| `name` (required) | identifying label for the adapter (not currently consumed by the runtime — still required by the interface) |
| `bindHandler(opts)` | called once per controller method during `init()` — filter `opts.handlers` by your type and register routes with your engine (may be async) |
| `onInit?(moost)` | called after ALL controllers are bound and `@MoostInit` hooks ran — start servers/engines here |
| `getProvideRegistry?()` | provide-registry entries merged into DI before binding (expose your engine instances) |

## TMoostAdapterOptions

What `bindHandler(opts)` gives you, and what to do with each field:

| Field | Use |
|---|---|
| `prefix` | computed path prefix from the controller hierarchy — prepend to handler paths |
| `fakeInstance` | `Object.create(ctor.prototype)` — for reading metadata only, never invoke methods |
| `getInstance()` | real DI-resolved controller instance — may return a Promise (`FOR_EVENT`) |
| `method` | the controller method name being bound |
| `handlers` | ALL handler entries on the method (every decorator) — filter by your `handler.type`! |
| `getIterceptorHandler()` | pass through to `defineMoostEventHandler` |
| `resolveArgs?` | pass through to `defineMoostEventHandler`; `undefined` for no-arg methods |
| `controllerName?` | controller class name — feeds tracing span attributes |
| `logHandler(eventName)` | call once per registered route for the init-time route-mapping log |
| `register(handler, path, args)` | report the final mounted path back to the controllers overview (`registeredAs`) |

## defineMoostEventHandler

Returns a function that, when called inside a Wooks event context, runs the full handler lifecycle.

```ts
const fn = defineMoostEventHandler({
  // contextType is deprecated — unused since wooks v0.7; the event kind comes
  // from the wooks adapter (eventTypeKey/defineEventKind). Do not pass it.
  loggerTitle: 'my-adapter',               // required
  getIterceptorHandler: opts.getIterceptorHandler,
  getControllerInstance: opts.getInstance,
  controllerMethod: opts.method,
  controllerName: opts.controllerName,
  callControllerMethod: undefined,         // override default invocation
  resolveArgs: opts.resolveArgs,           // may be undefined for no-arg handlers
  logErrors: false,
  manualUnscope: false,                    // true => adapter calls unscope() manually
  hooks: { init, end },                    // see below
  targetPath: '/api/users/:id',            // full path for logging/tracing
  controllerPrefix: opts.prefix,
  handlerType: handler.type,               // required
})
```

Lifecycle inside `fn()`:

```
scope register (useScopeId + registerEventScope) → logger setup → hooks.init
  → getControllerInstance() → setControllerContext
  → interceptor before (reply() short-circuits)
  → resolveArgs() → handler (or callControllerMethod)
  → interceptor after / onError
  → unscope (skipped if manualUnscope) → hooks.end → return
```

## Hook options

`hooks.init` and `hooks.end` receive the same `TMoostEventHandlerHookOptions<T>` object (`import type { TMoostEventHandlerHookOptions } from 'moost'`):

| Field | Notes |
|---|---|
| `scopeId` | the event's DI scope ID |
| `logger` | event logger |
| `unscope()` | cleans up the DI scope — call it yourself when `manualUnscope: true` |
| `method?` | the controller method name — available in BOTH `init` and `end` |
| `instance?` | exists on the type but is NEVER populated by `defineMoostEventHandler` — to reach the controller instance in `hooks.end`, capture it via `getControllerInstance()` or `useControllerContext().getController()` |
| `getResponse()` | current response value (set after the handler/interceptors ran) |
| `reply(r)` | overwrite the response |

## Minimal adapter

```ts
import type { TMoostAdapter, TMoostAdapterOptions } from 'moost'
import { defineMoostEventHandler } from 'moost'
import { createEventContext } from '@wooksjs/event-core'

interface TMyHandlerMeta { eventName: string }

class MyAdapter implements TMoostAdapter<TMyHandlerMeta> {
  name = 'my-adapter'
  private handlers = new Map<string, () => unknown>()

  bindHandler<T extends object>(opts: TMoostAdapterOptions<TMyHandlerMeta, T>) {
    for (const h of opts.handlers) {
      if (h.type !== 'MY_EVENT') continue
      const targetPath = `${opts.prefix}/${h.path || (opts.method as string)}`.replaceAll(/\/\/+/g, '/')

      const fn = defineMoostEventHandler({
        loggerTitle: 'my-adapter',
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        controllerName: opts.controllerName,
        resolveArgs: opts.resolveArgs,
        targetPath,
        controllerPrefix: opts.prefix,
        handlerType: h.type,
      })

      this.handlers.set(h.eventName, fn)
      opts.logHandler(`(${h.type}) ${h.eventName}`)
      opts.register(h, targetPath, [])
    }
  }

  async dispatch(eventName: string) {
    const fn = this.handlers.get(eventName)
    if (!fn) throw new Error(`No handler for event: ${eventName}`)
    return createEventContext({ logger: console }, () => fn())
  }
}
```

## Handler decorators

Type the mate with your handler meta — with bare `getMoostMate()` the extra fields (`eventName` here) fail TS excess-property checking:

```ts
import type { TEmpty, TMoostMetadata } from 'moost'
import { getMoostMate } from 'moost'

interface TMyHandlerMeta { eventName: string }

function MyEvent(name: string): MethodDecorator {
  return getMoostMate<TEmpty, TMoostMetadata<TMyHandlerMeta>>().decorate('handlers', {
    type: 'MY_EVENT',
    path: name,
    eventName: name,
  }, true)  // true = push to array
}
```

(This mirrors `@moostjs/event-http`'s `HttpMethod` decorator.)

## Scope management

`manualUnscope: false` (default) — DI scope auto-cleans after handler returns. Good for request-scoped handlers that complete synchronously.

`manualUnscope: true` — adapter controls scope lifetime. Required for:
- Long-lived connections (WebSocket, SSE)
- Streaming responses
- Workflows that pause/resume

```ts
const fn = defineMoostEventHandler({
  manualUnscope: true,
  hooks: {
    init: ({ unscope }) => {
      const { raw } = useRequest()
      raw.on('end', unscope)   // cleanup on request end (MoostHttp's pattern)
    },
  },
  // …
})
```

## Parameter resolvers

```ts
import { Resolve, globalKey } from 'moost'
import { current } from '@wooksjs/event-core'

// Use moost's `globalKey` (not event-core's bare `key`) for adapter context keys:
// it interns the slot by name across duplicate module loads (dual ESM/CJS, or a
// duplicated install), so set/get can't desync into a "Key ... is not set" 500.
const eventDataKey = globalKey<unknown>('my-adapter.data')
function setEventData(data: unknown) { current().set(eventDataKey, data) }

function EventData(field?: string): ParameterDecorator & PropertyDecorator {
  return Resolve(() => {
    const data = current().get(eventDataKey)
    return field ? (data as Record<string, unknown>)?.[field] : data
  }, field || 'eventData')
}
```

## Custom metadata extension

Two patterns — see [decorators.md → Custom metadata extension](decorators.md#custom-metadata-extension) for the full picture.

- **Adapter-private state** (read only by your adapter, never by other moost tooling) — use a separate `Mate` workspace; no augmentation, no collision surface.
- **Public extension** (typed library/framework metadata you want to read with full IDE support) — augment `TMoostMetadata` / `TMoostParamsMetadata` and ship a typed `get<LibName>Mate()` wrapper around `getMoostMate()`. Eliminates magic strings and `as` casts. This is the right choice when other moost-aware code (your own readers, swagger, otel) should see the metadata.

Adapter-private quick form:

```ts
import { Mate } from '@prostojs/mate'
interface TMyAdapterMeta { myOption?: string; myTimeout?: number }
const myMate = new Mate<TMyAdapterMeta, TMyAdapterMeta>('my-adapter')

function MyOption(value: string): MethodDecorator {
  return myMate.decorate('myOption', value)
}

// in bindHandler:
const myMeta = myMate.read(opts.fakeInstance, opts.method as string)
```

## Not-found handler

Run the global interceptor chain when no handler matches:

```ts
class MyAdapter implements TMoostAdapter<TMeta> {
  private moost?: Moost
  onInit(m: Moost) { this.moost = m }

  async onNotFound() {
    return defineMoostEventHandler({
      loggerTitle: 'my-adapter',
      getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
      getControllerInstance: () => this.moost,
      callControllerMethod: () => new Error('Handler not found'),
      targetPath: '',
      handlerType: '__SYSTEM__',
    })()
  }
}
```

## Real-world adapter sketches

### HTTP (MoostHttp)

- `manualUnscope: true`, `unscope` hooked to request `'end'` (keeps scope alive for streaming).
- `getProvideRegistry()` exposes `WooksHttp`, `'WooksHttp'`, `HttpServer`, `HttpsServer`.

### CLI (MoostCli)

- Strips leading slashes from targetPath.
- Calls `cliApp.run()` in `onInit()`.

### Workflow (MoostWf)

- `manualUnscope: true`.
- `WF_STEP` handlers: `wfApp.step(path, { handler })`.
- `WF_FLOW` handlers: `wfApp.flow(path, schema, prefix, handler)`.
- Scope cleanup via `cleanup` callback in `start`/`resume`:
  ```ts
  this.wfApp.start(schemaId, context, {
    input,
    cleanup: () => getMoostInfact().unregisterScope(useScopeId()),
  })
  ```

## Utility exports (from `moost`)

Small helpers adapter authors may need:

- `getInstanceOwnMethods(instance)` / `getInstanceOwnProps(instance)` — enumerate a controller's method/property names including inherited ones (what Moost itself scans during binding)
- `isThenable(v)` — type guard for `PromiseLike`; use it to keep your dispatch sync-first like `defineMoostEventHandler` does
- `mergeSorted(a, b)` — merges arrays of `{ priority }` items into one priority-sorted list (how pipe/interceptor levels combine)
- `getGlobalWooks()` / `clearGlobalWooks()` — access/reset the global Wooks app registry (re-exported from `wooks`; `clearGlobalWooks` is useful between tests or on HMR cleanup)
- `ContextInjector`, `getContextInjector()`, `replaceContextInjector()`, `resetContextInjector()` — the tracing hook (re-exported from `@wooksjs/event-core`); `defineMoostEventHandler` wraps lifecycle stages through the active injector, and `@moostjs/otel` installs its span injector via `replaceContextInjector`

## Gotchas

- `opts.fakeInstance` is `Object.create(ctor.prototype)` — read metadata only, don't invoke methods.
- `opts.getInstance()` may return a Promise for `FOR_EVENT` controllers.
- `bindHandler()` fires per method regardless of handler type — always filter by `handler.type`.
- Hook options never carry the controller instance — `instance` exists on the type but is not populated in either hook; `method` IS available in both. Capture the instance via `getControllerInstance()`/`useControllerContext()` if a hook needs it.
- If `callControllerMethod` is set, it replaces the default method invocation entirely — `resolveArgs` still runs, but the method isn't called.
- Scope ID is a monotonic counter, not a UUID — deterministic within a process.
- `opts.resolveArgs` may be `undefined` if the method has no parameters.
- Handler type strings are conventions only — pick something unique (`HTTP`, `CLI`, `WF_STEP`, `WS_MESSAGE`, etc. are taken).
- Global interceptors run for not-found too — wire them via `getGlobalInterceptorHandler()`.
- Every handler invocation must be inside a Wooks event context; if you dispatch yourself, wrap in `createEventContext({ logger }, () => fn())`.
