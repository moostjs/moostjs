# Custom Adapters — moost

> How to build a custom event adapter implementing `TMoostAdapter`, using `defineMoostEventHandler` to bridge any event source into Moost's DI, interceptor, and pipe systems. Includes real-world examples from HTTP, WebSocket, and Workflow adapters.

## Concepts

An **adapter** connects an external event source to Moost. When an event arrives (HTTP request, WebSocket message, CLI command, cron tick, queue message, etc.), the adapter creates an event context and delegates to Moost's unified handler pipeline:

```
Event Source → Adapter.bindHandler() → defineMoostEventHandler() → [scope → DI → interceptors → pipes → handler → cleanup]
```

### The Adapter Contract

Every adapter implements `TMoostAdapter<H>` where `H` is the **handler metadata type** — a type describing what extra metadata your decorators attach to handler methods (e.g., HTTP method + path, WS event name, cron schedule).

### How Moost Calls Your Adapter

During `app.init()`, Moost iterates every registered controller and every decorated method. For each method that has `handlers` metadata (set by decorators via `getMoostMate().decorate('handlers', {...}, true)`), Moost calls `adapter.bindHandler()` on **every** attached adapter. Your adapter must:

1. **Filter** — Only process handlers matching your adapter's type string
2. **Wrap** — Call `defineMoostEventHandler()` to create a composable handler function
3. **Register** — Register that function with your underlying event engine
4. **Report** — Call `opts.logHandler()` and `opts.register()` for logging and overview tracking

## API Reference

### `TMoostAdapter<H>` (interface)

```ts
import type { TMoostAdapter } from 'moost'

interface TMoostAdapter<H> {
  name: string
  bindHandler: <T extends object = object>(
    options: TMoostAdapterOptions<H, T>,
  ) => void | Promise<void>
  onInit?: (moost: Moost) => void | Promise<void>
  getProvideRegistry?: () => TProvideRegistry
}
```

| Member | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Unique string identifying the adapter (e.g., `'http'`, `'ws'`, `'workflow'`, `'cron'`) |
| `bindHandler` | Yes | Called once per controller method per controller. Filter by handler type, register routes |
| `onInit` | No | Called after all controllers are bound. Use to finalize setup, store Moost reference |
| `getProvideRegistry` | No | Return DI providers so controllers can inject adapter-specific services |

### `TMoostAdapterOptions<H, T>` (interface)

The options object passed to `bindHandler()`:

```ts
interface TMoostAdapterOptions<H, T> {
  prefix: string                                              // Combined controller prefix
  fakeInstance: T                                             // Prototype instance for reading metadata
  getInstance: () => Promise<T> | T                           // Factory for real controller instance
  method: keyof T                                             // Handler method name
  handlers: TMoostHandler<H>[]                                // All handler decorators on this method
  getIterceptorHandler: () => InterceptorHandler | undefined  // Factory for interceptor chain
  resolveArgs?: () => Promise<unknown[]> | unknown[]          // Factory for argument resolution
  controllerName?: string                                     // Class name (for logging)
  logHandler: (eventName: string) => void                     // Call to log route registration
  register: (handler: TMoostHandler<TEmpty>, path: string, args: string[]) => void  // Track registration
}
```

**Key points:**
- `handlers` is an **array** — a single method can have multiple handler decorators (e.g., both `@Get()` and `@Post()`)
- Each handler has a `type` field (string) set by the decorator — use this to filter
- `fakeInstance` is created via `Object.create(constructor.prototype)` — used only for metadata reads, never for handler execution
- `getInstance` returns the real DI-resolved controller instance (may be async for `FOR_EVENT` scope)

### `TMoostHandler<H>` (type)

```ts
type TMoostHandler<H> = {
  type: string     // Your adapter's handler type identifier (e.g., 'HTTP', 'WS_MESSAGE', 'CRON')
  path?: string    // Optional path/route set by the decorator
} & H              // Merged with your custom handler metadata
```

### `defineMoostEventHandler<T>(options)` (function)

Creates a **composable handler function** that runs inside a Wooks event context. This is the core bridge between your event source and Moost's handler pipeline.

```ts
import { defineMoostEventHandler } from 'moost'

const handler = defineMoostEventHandler({
  contextType: 'MY_EVENT',         // Event type identifier for filtering
  loggerTitle: 'my-adapter',       // Logger topic prefix
  getIterceptorHandler,            // From TMoostAdapterOptions
  getControllerInstance: getInstance, // From TMoostAdapterOptions
  controllerMethod: method,        // From TMoostAdapterOptions
  controllerName,                  // From TMoostAdapterOptions
  resolveArgs,                     // From TMoostAdapterOptions
  targetPath: '/my/route',         // Full resolved path (for logging/tracing)
  handlerType: 'MY_TYPE',         // Handler type string (for context injection)
  // Optional:
  manualUnscope: false,            // If true, YOU must call unscope() manually
  logErrors: false,                // If true, logs errors to context logger
  hooks: {                         // Lifecycle hooks around the handler
    init: ({ unscope, scopeId, logger }) => { /* runs first */ },
    end: ({ getResponse }) => { /* runs after cleanup */ },
  },
})

// handler is a function: () => unknown
// Call it inside a Wooks event context
```

#### Options Reference

```ts
interface TMoostEventHandlerOptions<T> {
  contextType?: string | string[]   // Marks event context type (used by interceptors to filter)
  loggerTitle: string               // Topic name for the scoped logger
  getIterceptorHandler: () => InterceptorHandler | undefined
  getControllerInstance: () => Promise<T> | T | undefined
  controllerMethod?: keyof T
  controllerName?: string
  callControllerMethod?: (args: unknown[]) => unknown  // Override: custom invocation logic
  resolveArgs?: () => Promise<unknown[]> | unknown[]
  logErrors?: boolean               // Log errors to event logger (default: false)
  manualUnscope?: boolean           // If true, adapter handles DI scope cleanup (default: false)
  hooks?: {
    init?: (opts: TMoostEventHandlerHookOptions<T>) => unknown
    end?: (opts: TMoostEventHandlerHookOptions<T>) => unknown
  }
  targetPath: string                // Resolved path (for tracing spans)
  handlerType: string               // Type identifier (for context injection hooks)
}
```

#### Handler Lifecycle (what happens inside the returned function)

```
1. Get current event context        → current()
2. Generate scope ID                → useScopeId()
3. Create scoped logger             → useLogger().topic(loggerTitle)
4. Register DI scope                → registerEventScope(scopeId)
5. Run init hook                    → hooks.init?.()
6. Resolve controller instance      → getControllerInstance()
7. Set controller context           → setControllerContext()
8. Run interceptor before phase     → interceptorHandler.before()
   └─ If returns value → skip to cleanup (short-circuit)
9. Resolve arguments                → resolveArgs()
10. Call handler method              → instance[method](...args)
11. Run interceptor after phase     → interceptorHandler.fireAfter(response)
12. Unregister DI scope             → unscope() (unless manualUnscope)
13. Run end hook                    → hooks.end?.()
14. Return response or throw error
```

### `createProvideRegistry(...entries)` (function)

Creates a DI provide registry for `getProvideRegistry()`. Each entry maps a token to a factory.

```ts
import { createProvideRegistry } from 'moost'

// Entries: [Token, () => instance]
createProvideRegistry(
  [MyService, () => this.getService()],
  ['MyService', () => this.getService()],   // String token alternative
)
```

### `getMoostMate()` (function)

Returns the singleton Mate instance for reading/writing decorator metadata. Used by decorators and by `bindHandler` to read handler-specific metadata.

```ts
import { getMoostMate } from 'moost'

const mate = getMoostMate()
const methodMeta = mate.read(fakeInstance, methodName)
// methodMeta.handlers → TMoostHandler[] array
```

## Common Patterns

### Pattern: Minimal Custom Adapter

The simplest possible adapter — handles a single event type with no extra features.

```ts
import type { Moost, TMoostAdapter, TMoostAdapterOptions, TObject } from 'moost'
import { defineMoostEventHandler } from 'moost'

// 1. Define your handler metadata type
interface TCronHandlerMeta {
  schedule: string  // cron expression
}

// 2. Define your context type identifier
const HANDLER_TYPE = 'CRON'

// 3. Implement the adapter
class MoostCron implements TMoostAdapter<TCronHandlerMeta> {
  public readonly name = 'cron'
  protected moost?: Moost
  private jobs: Array<{ schedule: string; handler: () => unknown }> = []

  onInit(moost: Moost) {
    this.moost = moost
    // Start all registered cron jobs
    for (const job of this.jobs) {
      scheduleCron(job.schedule, job.handler)
    }
  }

  bindHandler<T extends TObject>(opts: TMoostAdapterOptions<TCronHandlerMeta, T>): void {
    for (const handler of opts.handlers) {
      // CRITICAL: Filter — only process handlers meant for this adapter
      if (handler.type !== HANDLER_TYPE) {
        continue
      }

      // Build the target path for logging/tracing
      const path = handler.path || (opts.method as string)
      const targetPath = `${opts.prefix || ''}/${path}`.replaceAll(/\/\/+/g, '/')

      // Create the Moost event handler (composable)
      const fn = defineMoostEventHandler({
        contextType: HANDLER_TYPE,
        loggerTitle: 'moost-cron',
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        controllerName: opts.controllerName,
        resolveArgs: opts.resolveArgs,
        targetPath,
        handlerType: HANDLER_TYPE,
      })

      // Store for registration during onInit
      this.jobs.push({
        schedule: handler.schedule,
        handler: fn,  // fn is a composable — call it inside an event context
      })

      // Log the registration
      opts.logHandler(`(cron:${handler.schedule})${targetPath}`)
      opts.register(handler, targetPath, [])
    }
  }
}
```

### Pattern: Decorator for Your Custom Adapter

Every adapter needs at least one method decorator that stores handler metadata.

```ts
import type { TEmpty, TMoostMetadata } from 'moost'
import { getMoostMate } from 'moost'

// Decorator that marks a method as a cron handler
function Cron(schedule: string, path?: string): MethodDecorator {
  return getMoostMate<TEmpty, TMoostMetadata<{ schedule: string }>>().decorate(
    'handlers',                              // metadata key (always 'handlers')
    { schedule, path, type: 'CRON' },        // merged into TMoostHandler<TCronHandlerMeta>
    true,                                    // array mode — accumulates, doesn't overwrite
  )
}

// Usage:
@Controller('tasks')
class TaskController {
  @Cron('0 * * * *', 'cleanup')  // every hour
  runCleanup() {
    // handler logic
  }
}
```

**Key rules for decorators:**
- Always use `getMoostMate().decorate('handlers', {...}, true)` — the `true` enables array accumulation
- Always include a `type` field — this is how your adapter filters its handlers in `bindHandler()`
- The `path` field is optional but conventional — it becomes the handler identifier

### Pattern: Adapter with Event Context (Wooks Integration)

If your event source uses Wooks (like HTTP, CLI, WS do), the event context is already set up. If not, you need to create one via `createEventContext()`.

```ts
import { createEventContext } from 'moost'

class MoostCron implements TMoostAdapter<TCronHandlerMeta> {
  // ...

  onInit(moost: Moost) {
    this.moost = moost
    for (const job of this.jobs) {
      scheduleCron(job.schedule, () => {
        // Create a Wooks event context for each cron tick
        return createEventContext(
          { logger: moost.getLogger('cron') },
          () => job.handler(),
        )
      })
    }
  }
}
```

If your adapter wraps a Wooks engine (like `WooksHttp`, `WooksWs`), the engine creates the event context automatically — you just register `fn` directly.

### Pattern: Manual Scope Cleanup (Long-lived Events)

For events that outlive a single function call (HTTP streaming, WebSocket connections, workflows), use `manualUnscope: true` and clean up the DI scope explicitly.

```ts
// HTTP adapter: scope lives until request ends
const fn = defineMoostEventHandler({
  // ...
  manualUnscope: true,
  hooks: {
    init: ({ unscope }) => {
      const { raw } = useRequest()
      raw.on('end', unscope)  // Clean up when request stream ends
    },
  },
})

// Workflow adapter: scope cleaned up by the workflow engine
const fn = defineMoostEventHandler({
  // ...
  manualUnscope: true,
})
// Then in start()/resume():
wfApp.start(schemaId, ctx, {
  cleanup: () => {
    getMoostInfact().unregisterScope(useScopeId())
  },
})
```

**Rule:** If `manualUnscope` is `false` (default), the scope is cleaned up automatically after the handler returns. Use `true` only when the event's lifetime extends beyond the handler function.

### Pattern: DI Provider Registry

Expose adapter-specific services for controller injection.

```ts
import { createProvideRegistry } from 'moost'

class MoostCron implements TMoostAdapter<TCronHandlerMeta> {
  // ...

  getProvideRegistry() {
    return createProvideRegistry(
      [MoostCron, () => this],           // Inject by class
      ['MoostCron', () => this],         // Inject by string token
      [CronEngine, () => this.engine],   // Expose underlying engine
    )
  }
}

// Now controllers can inject it:
@Controller()
class TaskController {
  constructor(private cron: MoostCron) {}
  // or
  constructor(@Inject('MoostCron') private cron: MoostCron) {}
}
```

### Pattern: Not-Found Handler

Adapters that support "catch-all" or "not found" scenarios can use `defineMoostEventHandler` with `callControllerMethod` to run the global interceptor chain (CORS, logging, etc.) even for unmatched routes.

```ts
async onNotFound() {
  return defineMoostEventHandler({
    loggerTitle: 'my-adapter',
    getIterceptorHandler: () => this.moost?.getGlobalInterceptorHandler(),
    getControllerInstance: () => this.moost,
    callControllerMethod: () => new MyError(404, 'Not Found'),
    targetPath: '',
    handlerType: '__SYSTEM__',
  })()
}
```

### Pattern: Parameter Resolver Decorators

Create parameter decorators that inject event-specific data using `@Resolve()`.

```ts
import { Resolve } from 'moost'

// Resolve using composables from your event engine
function CronSchedule() {
  return Resolve(() => useCronContext().schedule, 'cron-schedule')
}

function CronTick() {
  return Resolve(() => useCronContext().tickNumber, 'cron-tick')
}

// Usage:
@Cron('*/5 * * * *')
handle(@CronSchedule() schedule: string, @CronTick() tick: number) {
  console.log(`Tick ${tick} for schedule ${schedule}`)
}
```

## Real-World Adapter Examples

### HTTP Adapter (MoostHttp)

Source: `@moostjs/event-http` — wraps `@wooksjs/event-http` (WooksHttp).

**Handler metadata type:**
```ts
interface THttpHandlerMeta {
  method: string  // 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | '*' | 'UPGRADE'
  path: string
}
```

**Key `bindHandler` implementation:**
```ts
bindHandler<T extends object>(opts: TMoostAdapterOptions<THttpHandlerMeta, T>): void {
  for (const handler of opts.handlers) {
    if (handler.type !== 'HTTP') continue  // Filter

    const path = typeof handler.path === 'string' ? handler.path : (opts.method as string)
    const targetPath = `${opts.prefix || ''}/${path}`.replaceAll(/\/\/+/g, '/')

    const fn = defineMoostEventHandler({
      contextType: 'HTTP',
      loggerTitle: 'moost-http',
      getIterceptorHandler: opts.getIterceptorHandler,
      getControllerInstance: opts.getInstance,
      controllerMethod: opts.method,
      controllerName: opts.controllerName,
      resolveArgs: opts.resolveArgs,
      manualUnscope: true,          // Scope lives until request ends
      hooks: {
        init: ({ unscope }) => {
          useRequest().raw.on('end', unscope)  // Cleanup on request end
        },
      },
      targetPath,
      handlerType: handler.type,
    })

    // Register with WooksHttp router
    if (handler.method === 'UPGRADE') {
      this.httpApp.upgrade(targetPath, fn)
    } else {
      this.httpApp.on(handler.method, targetPath, fn)
    }

    opts.logHandler(`(${handler.method})${targetPath}`)
    opts.register(handler, targetPath, routerBinding.getArgs())
  }
}
```

**Decorators:**
```ts
// HttpMethod stores { method, path, type: 'HTTP' } in handlers metadata
const Get = (path?: string) => HttpMethod('GET', path)
const Post = (path?: string) => HttpMethod('POST', path)
```

**Why `manualUnscope: true`:** HTTP requests can stream — the response may be sent long after the handler returns. The DI scope must survive until the Node.js request stream emits `'end'`.

---

### WebSocket Adapter (MoostWs)

Source: `@moostjs/event-ws` — wraps `@wooksjs/event-ws` (WooksWs).

**Handler metadata type (union):**
```ts
interface TWsMessageHandlerMeta { event: string; path: string }
interface TWsConnectHandlerMeta { /* no extra fields */ }
type TWsHandlerMeta = TWsMessageHandlerMeta | TWsConnectHandlerMeta
```

**Multiple handler types in one adapter:**
```ts
bindHandler<T extends object>(opts: TMoostAdapterOptions<TWsHandlerMeta, T>): void {
  for (const handler of opts.handlers) {
    if (handler.type === 'WS_MESSAGE') {
      this.bindMessageHandler(opts, handler)
    } else if (handler.type === 'WS_CONNECT') {
      this.bindConnectHandler(opts)
    } else if (handler.type === 'WS_DISCONNECT') {
      this.bindDisconnectHandler(opts)
    }
  }
}

// Message handler — routed by event + path
protected bindMessageHandler(opts, handler) {
  const fn = defineMoostEventHandler({
    contextType: 'WS_MESSAGE',
    loggerTitle: 'moost-ws',
    // ...standard opts pass-through...
    targetPath,
    handlerType: 'WS_MESSAGE',
  })
  this.wsApp.onMessage(handler.event, targetPath, fn)
}

// Connect handler — no routing, fires for all connections
protected bindConnectHandler(opts) {
  const fn = defineMoostEventHandler({
    contextType: 'WS_CONNECT',
    // ...
    targetPath: '__ws_connect__',
    handlerType: 'WS_CONNECT',
  })
  this.wsApp.onConnect(fn)
}
```

**Decorators:**
```ts
const Message = (event: string, path?: string) =>
  getMoostMate().decorate('handlers', { event, path, type: 'WS_MESSAGE' }, true)

const Connect = () =>
  getMoostMate().decorate('handlers', { type: 'WS_CONNECT' }, true)

const Disconnect = () =>
  getMoostMate().decorate('handlers', { type: 'WS_DISCONNECT' }, true)
```

**Key insight:** A single adapter can handle multiple handler types. Use different `type` strings for each and dispatch in `bindHandler`.

---

### Workflow Adapter (MoostWf)

Source: `@moostjs/event-wf` — wraps `@wooksjs/event-wf` (WooksWf).

**Handler metadata type:**
```ts
interface TWfHandlerMeta { path: string }
```

**Deferred registration pattern:**
```ts
class MoostWf implements TMoostAdapter<TWfHandlerMeta> {
  protected toInit: (() => void)[] = []

  bindHandler<T extends object>(opts: TMoostAdapterOptions<TWfHandlerMeta, T>): void {
    for (const handler of opts.handlers) {
      if (!['WF_STEP', 'WF_FLOW'].includes(handler.type)) continue

      const fn = defineMoostEventHandler({
        contextType: 'WF',
        manualUnscope: true,  // Workflows span multiple steps
        // ...
      })

      if (handler.type === 'WF_STEP') {
        // Steps register immediately
        this.wfApp.step(targetPath, { handler: fn })
      } else {
        // Flows defer to onInit — they need schema metadata
        const wfSchema = getWfMate().read(opts.fakeInstance, opts.method)?.wfSchema
        this.toInit.push(() => {
          this.wfApp.flow(targetPath, wfSchema || [], opts.prefix, fn)
        })
      }
    }
  }

  onInit(moost: Moost) {
    this.moost = moost
    this.toInit.forEach((fn) => fn())  // Execute deferred registrations
  }
}
```

**Key insight:** When registration requires data that's only available after all controllers are processed, use a deferred queue (`toInit`) and execute it in `onInit()`.

**Decorators:**
```ts
const Step = (path?: string) =>
  getWfMate().decorate('handlers', { path, type: 'WF_STEP' }, true)

const Workflow = (path?: string) =>
  getWfMate().decorate('handlers', { path, type: 'WF_FLOW' }, true)

const WorkflowSchema = (schema) =>
  getWfMate().decorate('wfSchema', schema)  // Non-array metadata (overwrites)
```

## Step-by-Step: Building a Custom Adapter

### Step 1: Define Handler Metadata Type

```ts
// What extra data your decorator stores per handler
interface TMyHandlerMeta {
  channel: string    // e.g., queue name, topic, schedule
}
```

### Step 2: Create Method Decorator(s)

```ts
import { getMoostMate } from 'moost'

function OnEvent(channel: string, path?: string): MethodDecorator {
  return getMoostMate().decorate(
    'handlers',
    { channel, path, type: 'MY_EVENT' },
    true,
  )
}
```

### Step 3: Implement TMoostAdapter

```ts
import type { Moost, TMoostAdapter, TMoostAdapterOptions, TObject } from 'moost'
import { createProvideRegistry, defineMoostEventHandler } from 'moost'

class MyAdapter implements TMoostAdapter<TMyHandlerMeta> {
  public readonly name = 'my-adapter'
  protected moost?: Moost

  constructor(private engine: MyEventEngine) {}

  onInit(moost: Moost) {
    this.moost = moost
  }

  getProvideRegistry() {
    return createProvideRegistry(
      [MyAdapter, () => this],
      [MyEventEngine, () => this.engine],
    )
  }

  bindHandler<T extends TObject>(opts: TMoostAdapterOptions<TMyHandlerMeta, T>) {
    for (const handler of opts.handlers) {
      if (handler.type !== 'MY_EVENT') continue

      const path = handler.path || (opts.method as string)
      const targetPath = `${opts.prefix || ''}/${path}`.replaceAll(/\/\/+/g, '/')

      const fn = defineMoostEventHandler({
        contextType: 'MY_EVENT',
        loggerTitle: 'my-adapter',
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        controllerName: opts.controllerName,
        resolveArgs: opts.resolveArgs,
        targetPath,
        handlerType: handler.type,
      })

      this.engine.subscribe(handler.channel, targetPath, fn)

      opts.logHandler(`(${handler.channel})${targetPath}`)
      opts.register(handler, targetPath, [])
    }
  }
}
```

### Step 4: Create Parameter Resolvers (Optional)

```ts
import { Resolve } from 'moost'

function EventPayload() {
  return Resolve(() => useMyEventContext().payload, 'event-payload')
}

function EventChannel() {
  return Resolve(() => useMyEventContext().channel, 'event-channel')
}
```

### Step 5: Wire It Up

```ts
const app = new Moost()
const myAdapter = app.adapter(new MyAdapter(new MyEventEngine()))

app.registerControllers(MyController)
await app.init()
myAdapter.engine.connect()
```

## Integration

### With Wooks Event Engines

If your event source has a Wooks engine (like `WooksHttp`, `WooksCli`, `WooksWs`), the engine creates event contexts via `createEventContext()` automatically. Your adapter just registers handler functions and the engine calls them in the right context.

If you're building without a Wooks engine, wrap each event dispatch in `createEventContext()`:

```ts
import { createEventContext } from 'moost'

myEngine.on('event', (data) => {
  return createEventContext(
    { logger: this.moost.getLogger('my-adapter') },
    () => registeredHandler(),
  )
})
```

### With Interceptors

`defineMoostEventHandler` automatically runs the interceptor chain from `opts.getIterceptorHandler()`. No extra work needed. Global interceptors (registered via `app.interceptor()`) are included.

### With Pipes

Argument resolution via `opts.resolveArgs` runs the full pipe pipeline (RESOLVE → TRANSFORM → VALIDATE). Your `@Resolve()` decorators for parameter injection integrate automatically.

## Best Practices

- Always filter handlers by `type` in `bindHandler` — other adapters' handlers will be passed to you
- Use `manualUnscope: true` only for long-lived events (streams, connections, multi-step processes)
- Provide both class and string tokens in `getProvideRegistry()` for flexible injection
- Use `opts.logHandler()` with DYE color codes for consistent terminal output: `` opts.logHandler(`${__DYE_CYAN__}(type)${__DYE_GREEN__}${path}`) ``
- Call `opts.register()` for every registered handler — this populates `app.controllersOverview`
- Store a reference to the Moost instance in `onInit()` — you'll need it for `getGlobalInterceptorHandler()` in not-found handlers

## Gotchas

- `bindHandler` is called during `app.init()` **before** `onInit()` — don't rely on `this.moost` being set in `bindHandler`. Use the deferred queue pattern (like MoostWf's `toInit`) if you need the Moost reference during registration
- `defineMoostEventHandler` returns a **function**, not the result — call `fn()` to execute the handler pipeline. When registering with a Wooks engine, pass `fn` directly (the engine calls it)
- The `fakeInstance` in adapter options is **not** a real instance — it's `Object.create(prototype)` for metadata reads only. Never call methods on it
- The `handlers` array may contain entries from **other** adapters — always check `handler.type`
- `contextType` in `defineMoostEventHandler` is used by interceptors to filter which events they apply to — choose a distinctive string
- If your adapter wraps a Wooks engine, the engine handles `createEventContext()` — don't double-wrap
