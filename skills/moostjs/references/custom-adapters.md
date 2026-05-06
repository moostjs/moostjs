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
- [Gotchas](#gotchas)

Adapter flow: `app.adapter(a)` registers → during `app.init()` Moost calls `a.bindHandler(opts)` per controller method → `a.onInit(moost)` at the end → adapter starts receiving events → each event runs inside a Wooks event context, calling the function returned by `defineMoostEventHandler()`.

## TMoostAdapter

```ts
interface TMoostAdapter<H> {
  name: string
  bindHandler<T extends object>(opts: TMoostAdapterOptions<H, T>): void | Promise<void>
  onInit?(moost: Moost): void | Promise<void>
  getProvideRegistry?(): TProvideRegistry
}
```

## TMoostAdapterOptions

```ts
interface TMoostAdapterOptions<H, T> {
  prefix: string                                     // computed from controller hierarchy
  fakeInstance: T                                    // Object.create(ctor.prototype) — metadata only
  getInstance: () => Promise<T> | T                  // real DI-resolved instance (may be async)
  method: keyof T
  handlers: TMoostHandler<H>[]                       // ALL handler entries on method — filter!
  getIterceptorHandler: () => InterceptorHandler | undefined
  resolveArgs?: () => Promise<unknown[]> | unknown[]
  controllerName?: string
  logHandler: (eventName: string) => void
  register: (handler: TMoostHandler<any>, path: string, args: string[]) => void
}
```

## defineMoostEventHandler

Returns a function that, when called inside a Wooks event context, runs the full handler lifecycle.

```ts
const fn = defineMoostEventHandler({
  contextType: 'MY_EVENT',                 // string | string[] — used by composables to type-guard
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

```ts
interface TMoostEventHandlerHookOptions<T> {
  scopeId: string
  logger: Logger
  unscope: () => void
  instance?: T           // in `end` only
  method?: keyof T       // in `end` only
  getResponse: () => unknown
  reply: (r: unknown) => void
}
```

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
        contextType: 'MY_EVENT',
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

```ts
function MyEvent(name: string): MethodDecorator {
  return getMoostMate().decorate('handlers', {
    type: 'MY_EVENT',
    path: name,
    eventName: name,
  }, true)  // true = push to array
}
```

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
import { Resolve } from 'moost'
import { current, key } from '@wooksjs/event-core'

const eventDataKey = key<unknown>('my-adapter.data')
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

## Gotchas

- `opts.fakeInstance` is `Object.create(ctor.prototype)` — read metadata only, don't invoke methods.
- `opts.getInstance()` may return a Promise for `FOR_EVENT` controllers.
- `bindHandler()` fires per method regardless of handler type — always filter by `handler.type`.
- `hooks.init` runs before controller resolution — `instance` is not available there; it is in `hooks.end`.
- If `callControllerMethod` is set, it replaces the default method invocation entirely — `resolveArgs` still runs, but the method isn't called.
- Scope ID is a monotonic counter, not a UUID — deterministic within a process.
- `opts.resolveArgs` may be `undefined` if the method has no parameters.
- Handler type strings are conventions only — pick something unique (`HTTP`, `CLI`, `WF_STEP`, `WS_MESSAGE`, etc. are taken).
- Global interceptors run for not-found too — wire them via `getGlobalInterceptorHandler()`.
- Every handler invocation must be inside a Wooks event context; if you dispatch yourself, wrap in `createEventContext({ logger }, () => fn())`.
