# Custom Adapters — moost

> TMoostAdapter interface, defineMoostEventHandler lifecycle, handler metadata, DI integration, and patterns for building event source adapters.

## Concepts

An adapter bridges an external event source (HTTP, CLI, WebSocket, queue, etc.) to Moost's handler system. Each adapter implements `TMoostAdapter<H>` where `H` describes the adapter-specific handler metadata shape.

The adapter lifecycle:
1. User calls `app.adapter(myAdapter)` — adapter is registered
2. During `app.init()`, Moost calls `adapter.bindHandler()` for each handler method that has matching metadata
3. After all handlers are bound, Moost calls `adapter.onInit(moost)` for post-init setup
4. The adapter starts listening for events (adapter-specific, e.g., `listen()`)

When an event arrives, the adapter creates a Wooks event context and calls the handler function returned by `defineMoostEventHandler()`.

## API Reference

### TMoostAdapter\<H\>

The interface every adapter must implement:

```ts
interface TMoostAdapter<H> {
  // Unique adapter name
  name: string

  // Called for each handler method during init
  bindHandler: <T extends object>(
    options: TMoostAdapterOptions<H, T>,
  ) => void | Promise<void>

  // Called after all handlers are bound (optional)
  onInit?: (moost: Moost) => void | Promise<void>

  // Provide DI entries (optional)
  getProvideRegistry?: () => TProvideRegistry
}
```

### TMoostAdapterOptions\<H, T\>

Options passed to `bindHandler()` for each controller method:

```ts
interface TMoostAdapterOptions<H, T> {
  // Computed prefix from controller hierarchy
  prefix: string

  // Prototype-based fake instance for metadata reading
  fakeInstance: T

  // Factory returning the real controller instance (respects DI scopes)
  getInstance: () => Promise<T> | T

  // Method name on the controller
  method: keyof T

  // All handler entries on this method (filter by your adapter's type)
  handlers: TMoostHandler<H>[]

  // Factory returning the InterceptorHandler for this method
  getIterceptorHandler: () => InterceptorHandler | undefined

  // Argument resolver function (runs pipes for all parameters)
  resolveArgs?: () => Promise<unknown[]> | unknown[]

  // Controller class name (for logging)
  controllerName?: string

  // Log a bound handler
  logHandler: (eventName: string) => void

  // Register handler for overview/introspection
  register: (handler: TMoostHandler<any>, path: string, args: string[]) => void
}
```

### TMoostHandler\<T\>

Metadata entry stored on a method by handler decorators:

```ts
type TMoostHandler<T> = {
  type: string    // e.g., 'HTTP', 'CLI', 'WF_STEP', 'MY_EVENT'
  path?: string   // route path, command path, event name, etc.
} & T             // adapter-specific fields (e.g., HTTP method)
```

### defineMoostEventHandler\<T\>(options)

Create the complete event handler lifecycle processor. Returns a function that, when called within a Wooks event context, executes:

1. Scope registration and logger setup
2. Init hook (optional)
3. Controller resolution (DI)
4. Interceptor before phase
5. Argument resolution via pipes
6. Handler method execution
7. Interceptor after/onError phase
8. Scope cleanup
9. End hook (optional)

```ts
import { defineMoostEventHandler } from 'moost'

const handler = defineMoostEventHandler({
  // Event context type identifier(s)
  contextType: 'MY_EVENT',

  // Logger topic for this handler
  loggerTitle: 'my-adapter',

  // InterceptorHandler factory
  getIterceptorHandler: opts.getIterceptorHandler,

  // Controller instance factory
  getControllerInstance: opts.getInstance,

  // Method to call on the controller
  controllerMethod: opts.method,

  // Controller class name (for tracing)
  controllerName: opts.controllerName,

  // Custom handler invocation (overrides default method call)
  callControllerMethod: undefined,

  // Argument resolver
  resolveArgs: opts.resolveArgs,

  // Log errors to the context logger
  logErrors: false,

  // If true, adapter manages scope cleanup manually
  manualUnscope: false,

  // Lifecycle hooks
  hooks: {
    init: ({ scopeId, logger, unscope, reply }) => {
      // runs before everything, can set up adapter-specific state
    },
    end: ({ scopeId, logger, unscope, getResponse, reply }) => {
      // runs after everything, for cleanup
    },
  },

  // Full target path (prefix + handler path)
  targetPath: '/api/users/:id',

  // Controller prefix
  controllerPrefix: '/api',

  // Handler type string
  handlerType: 'MY_EVENT',
})

// Call within a Wooks event context
const result = handler()
```

#### TMoostEventHandlerOptions\<T\> — Full Options Reference

| Option                  | Type                               | Required | Description                                                                |
| ----------------------- | ---------------------------------- | -------- | -------------------------------------------------------------------------- |
| `contextType`           | `string \| string[]`               | No       | Event type identifier(s) for context filtering                             |
| `loggerTitle`           | `string`                           | Yes      | Logger topic name                                                          |
| `getIterceptorHandler`  | `() => InterceptorHandler \| undefined` | Yes | Factory for the interceptor chain                                          |
| `getControllerInstance` | `() => Promise<T> \| T \| undefined`   | Yes | Factory returning the controller instance                                  |
| `controllerMethod`      | `keyof T`                          | No       | Method to invoke on the controller                                         |
| `controllerName`        | `string`                           | No       | Controller class name for tracing                                          |
| `callControllerMethod`  | `(args: unknown[]) => unknown`     | No       | Custom invocation (overrides default)                                      |
| `resolveArgs`           | `() => Promise<unknown[]> \| unknown[]` | No  | Argument resolver (from pipes)                                             |
| `logErrors`             | `boolean`                          | No       | Log errors to context logger                                               |
| `manualUnscope`         | `boolean`                          | No       | If true, adapter calls `unscope()` manually                                |
| `hooks.init`            | `(opts) => unknown`                | No       | Pre-processing hook                                                        |
| `hooks.end`             | `(opts) => unknown`                | No       | Post-processing hook                                                       |
| `targetPath`            | `string`                           | Yes      | Full handler path                                                          |
| `controllerPrefix`      | `string`                           | No       | Controller prefix for context                                              |
| `handlerType`           | `string`                           | Yes      | Handler type string                                                        |

#### TMoostEventHandlerHookOptions\<T\>

Available in `hooks.init` and `hooks.end`:

```ts
interface TMoostEventHandlerHookOptions<T> {
  scopeId: string          // DI scope identifier
  logger: Logger           // scoped logger
  unscope: () => void      // cleanup DI scope
  instance?: T             // controller instance (only in end hook)
  method?: keyof T         // handler method name
  getResponse: () => unknown  // get current response
  reply: (r: unknown) => void // replace response
}
```

### defineMoostEventHandler Lifecycle Detail

```
┌─ Event arrives (adapter creates Wooks context)
├─ Scope registration (useScopeId + registerEventScope)
├─ Logger setup (useLogger with topic)
├─ hooks.init (if provided)
├─ Controller resolution (getControllerInstance)
├─ setControllerContext (controller, method, path, prefix)
├─ Interceptor before phase
│   └─ If reply() called → skip to cleanup
├─ Argument resolution (resolveArgs → pipe pipeline)
├─ Handler method execution
├─ Interceptor after/onError phase
├─ Scope cleanup (unscope, unless manualUnscope)
├─ hooks.end (if provided)
└─ Return response or throw error
```

### createProvideRegistry(...entries)

Create a DI provide registry for adapter services:

```ts
import { createProvideRegistry } from 'moost'

getProvideRegistry() {
  return createProvideRegistry(
    [MyAdapterEngine, () => this.engine],
    ['ADAPTER_CONFIG', () => this.config],
  )
}
```

### getMoostMate()

Read handler metadata in `bindHandler()`:

```ts
import { getMoostMate } from 'moost'

const mate = getMoostMate()
const methodMeta = mate.read(opts.fakeInstance, opts.method as string)
// methodMeta.description, methodMeta.params, etc.
```

## Patterns

### Minimal Adapter

The simplest possible adapter:

```ts
import type { TMoostAdapter, TMoostAdapterOptions } from 'moost'
import { defineMoostEventHandler } from 'moost'
import { createEventContext } from '@wooksjs/event-core'

interface TMyHandlerMeta {
  eventName: string
}

class MyAdapter implements TMoostAdapter<TMyHandlerMeta> {
  name = 'my-adapter'

  private handlers = new Map<string, () => unknown>()

  bindHandler<T extends object>(opts: TMoostAdapterOptions<TMyHandlerMeta, T>) {
    for (const handler of opts.handlers) {
      if (handler.type !== 'MY_EVENT') continue

      const targetPath = `${opts.prefix}/${handler.path || opts.method as string}`
        .replaceAll(/\/\/+/g, '/')

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
        handlerType: handler.type,
      })

      this.handlers.set(handler.eventName, fn)
      opts.logHandler(`(${handler.type}) ${handler.eventName}`)
      opts.register(handler, targetPath, [])
    }
  }

  async dispatch(eventName: string, data?: unknown): Promise<unknown> {
    const fn = this.handlers.get(eventName)
    if (!fn) throw new Error(`No handler for event: ${eventName}`)

    return createEventContext(
      { logger: console },
      () => fn(),
    )
  }
}
```

### Handler Decorator Creation

Create decorators that push to the `handlers` metadata array:

```ts
import { getMoostMate } from 'moost'

function MyEvent(name: string): MethodDecorator {
  return getMoostMate().decorate('handlers', {
    type: 'MY_EVENT',
    path: name,
    eventName: name,
  }, true)  // true = push to array
}

// Usage
class MyController {
  @MyEvent('user.created')
  onUserCreated() { /* ... */ }
}
```

### Wooks Integration

Integrate with an existing Wooks application for routing:

```ts
import { createHttpApp } from '@wooksjs/event-http'

class MyHttpAdapter implements TMoostAdapter<TMyHandlerMeta> {
  name = 'my-http'
  private app = createHttpApp()

  bindHandler<T extends object>(opts: TMoostAdapterOptions<TMyHandlerMeta, T>) {
    for (const handler of opts.handlers) {
      if (handler.type !== 'MY_HTTP') continue

      const targetPath = `${opts.prefix}/${handler.path || ''}`
        .replaceAll(/\/\/+/g, '/')

      const fn = defineMoostEventHandler({
        contextType: 'HTTP',
        loggerTitle: 'my-http',
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        controllerName: opts.controllerName,
        resolveArgs: opts.resolveArgs,
        manualUnscope: true,
        hooks: {
          init: ({ unscope }) => {
            const { raw } = useRequest()
            raw.on('end', unscope)
          },
        },
        targetPath,
        controllerPrefix: opts.prefix,
        handlerType: handler.type,
      })

      this.app.on(handler.method, targetPath, fn)
      opts.logHandler(`(${handler.method}) ${targetPath}`)
    }
  }

  listen(port: number) {
    return this.app.listen(port)
  }
}
```

### Manual Scope Cleanup

For long-lived connections (WebSocket, SSE), manage DI scope lifetime manually:

```ts
const fn = defineMoostEventHandler({
  // ...
  manualUnscope: true,
  hooks: {
    init: ({ unscope }) => {
      // Store unscope for later cleanup
      connection.on('close', unscope)
    },
  },
  // ...
})
```

### DI Providers

Expose adapter services to the DI container:

```ts
class MyAdapter implements TMoostAdapter<TMyMeta> {
  name = 'my-adapter'
  private engine = new MyEngine()

  getProvideRegistry() {
    return createProvideRegistry(
      [MyEngine, () => this.engine],
      ['MY_ENGINE', () => this.engine],
    )
  }

  // ...
}

// Controllers can now inject MyEngine
class MyController {
  constructor(private engine: MyEngine) {}
}
```

### Not-Found Handler

Handle unmatched events through the global interceptor chain:

```ts
class MyAdapter implements TMoostAdapter<TMyMeta> {
  private moost?: Moost

  onInit(moost: Moost) {
    this.moost = moost
  }

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

  // ...
}
```

### Parameter Resolvers

Create adapter-specific parameter decorators:

```ts
import { Resolve } from 'moost'
import { current, key } from '@wooksjs/event-core'

// Store event data in context
const eventDataKey = key<unknown>('my-adapter.data')

function setEventData(data: unknown) {
  current().set(eventDataKey, data)
}

// Parameter decorator to read event data
function EventData(field?: string): ParameterDecorator & PropertyDecorator {
  return Resolve(() => {
    const data = current().get(eventDataKey)
    return field ? (data as Record<string, unknown>)?.[field] : data
  }, field || 'eventData')
}

// Usage
class MyController {
  @MyEvent('user.created')
  onUserCreated(@EventData('userId') userId: string) { /* ... */ }
}
```

### Custom Metadata Extension

Extend handler metadata with adapter-specific fields using a separate Mate instance:

```ts
import { Mate } from '@prostojs/mate'

interface TMyAdapterMeta {
  myOption?: string
  myTimeout?: number
}

const myMate = new Mate<TMyAdapterMeta, TMyAdapterMeta>('my-adapter')

function getMyMate() {
  return myMate
}

// Decorator using custom mate
function MyOption(value: string): MethodDecorator {
  return getMyMate().decorate('myOption', value)
}

// Read in bindHandler
bindHandler(opts) {
  const myMeta = getMyMate().read(opts.fakeInstance, opts.method as string)
  // myMeta?.myOption
}
```

## Real-World Adapter Examples

### HTTP Adapter (MoostHttp)

Key patterns from `@moostjs/event-http`:

```ts
class MoostHttp implements TMoostAdapter<THttpHandlerMeta> {
  name = 'http'
  private httpApp: WooksHttp

  bindHandler<T extends object>(opts: TMoostAdapterOptions<THttpHandlerMeta, T>) {
    for (const handler of opts.handlers) {
      if (handler.type !== 'HTTP') continue

      const targetPath = `${opts.prefix}/${handler.path || opts.method as string}`
        .replaceAll(/\/\/+/g, '/')

      const fn = defineMoostEventHandler({
        contextType: 'HTTP',
        loggerTitle: 'moost-http',
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        controllerName: opts.controllerName,
        resolveArgs: opts.resolveArgs,
        manualUnscope: true, // tied to request lifecycle
        hooks: {
          init: ({ unscope }) => {
            const { raw } = useRequest()
            raw.on('end', unscope) // cleanup on request end
          },
        },
        targetPath,
        controllerPrefix: opts.prefix,
        handlerType: handler.type,
      })

      this.httpApp.on(handler.method, targetPath, fn)
      opts.logHandler(`(${handler.method}) ${targetPath}`)
    }
  }

  getProvideRegistry() {
    return createProvideRegistry(
      [WooksHttp, () => this.httpApp],
    )
  }

  onInit(moost: Moost) {
    this.moost = moost
  }
}
```

Notable: uses `manualUnscope: true` and ties `unscope()` to the request `'end'` event, keeping the DI scope alive for streaming responses.

### CLI Adapter (MoostCli)

Key patterns from `@moostjs/event-cli`:

```ts
class MoostCli implements TMoostAdapter<TCliHandlerMeta> {
  name = 'cli'
  private cliApp: WooksCli

  bindHandler<T extends object>(opts: TMoostAdapterOptions<TCliHandlerMeta, T>) {
    for (const handler of opts.handlers) {
      if (handler.type !== 'CLI') continue

      const targetPath = `${opts.prefix}/${handler.path || opts.method as string}`
        .replaceAll(/\/\/+/g, '/')
        .replaceAll(/^\/+/g, '')

      const fn = defineMoostEventHandler({
        contextType: 'CLI',
        loggerTitle: 'moost-cli',
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        controllerName: opts.controllerName,
        resolveArgs: opts.resolveArgs,
        targetPath,
        controllerPrefix: opts.prefix,
        handlerType: handler.type,
      })

      this.cliApp.cli(targetPath, {
        description: methodMeta?.description || '',
        handler: fn,
      })
    }
  }

  onInit(moost: Moost) {
    this.moost = moost
    this.cliApp.run()  // start processing CLI args
  }
}
```

Notable: CLI strips leading slashes from paths and runs `cliApp.run()` in `onInit()`.

### Workflow Adapter (MoostWf)

Key patterns from `@moostjs/event-wf`:

```ts
class MoostWf implements TMoostAdapter<TWfHandlerMeta> {
  name = 'workflow'
  private wfApp: WooksWf

  bindHandler<T extends object>(opts: TMoostAdapterOptions<TWfHandlerMeta, T>) {
    for (const handler of opts.handlers) {
      if (!['WF_STEP', 'WF_FLOW'].includes(handler.type)) continue

      const targetPath = `${opts.prefix}/${handler.path || opts.method as string}`
        .replaceAll(/\/\/+/g, '/')

      const fn = defineMoostEventHandler({
        contextType: 'WF',
        loggerTitle: 'moost-wf',
        getIterceptorHandler: opts.getIterceptorHandler,
        getControllerInstance: opts.getInstance,
        controllerMethod: opts.method,
        controllerName: opts.controllerName,
        resolveArgs: opts.resolveArgs,
        manualUnscope: true,
        targetPath,
        controllerPrefix: opts.prefix,
        handlerType: handler.type,
      })

      if (handler.type === 'WF_STEP') {
        this.wfApp.step(targetPath, { handler: fn })
      } else {
        this.wfApp.flow(targetPath, schema, opts.prefix, fn)
      }
    }
  }

  async start(schemaId: string, context: T, input?: unknown) {
    return this.wfApp.start(schemaId, context, {
      input,
      cleanup: () => getMoostInfact().unregisterScope(useScopeId()),
    })
  }
}
```

Notable: workflows use `manualUnscope: true` and handle scope cleanup via the `cleanup` callback in `start()`/`resume()`.

## Step-by-Step Guide

### Building a Custom Adapter

1. **Define handler metadata type:**

```ts
interface TMyHandlerMeta {
  eventName: string
  // add adapter-specific fields
}
```

2. **Create handler decorator:**

```ts
function OnMyEvent(name: string): MethodDecorator {
  return getMoostMate().decorate('handlers', {
    type: 'MY_EVENT',
    path: name,
    eventName: name,
  }, true)
}
```

3. **Implement TMoostAdapter:**

```ts
class MyAdapter implements TMoostAdapter<TMyHandlerMeta> {
  name = 'my-adapter'

  bindHandler<T extends object>(opts: TMoostAdapterOptions<TMyHandlerMeta, T>) {
    for (const handler of opts.handlers) {
      if (handler.type !== 'MY_EVENT') continue
      // wire handler to your event source
    }
  }
}
```

4. **Wire with defineMoostEventHandler:**

```ts
const fn = defineMoostEventHandler({
  contextType: 'MY_EVENT',
  loggerTitle: 'my-adapter',
  getIterceptorHandler: opts.getIterceptorHandler,
  getControllerInstance: opts.getInstance,
  controllerMethod: opts.method,
  resolveArgs: opts.resolveArgs,
  targetPath,
  controllerPrefix: opts.prefix,
  handlerType: handler.type,
})
```

5. **Create event context and dispatch:**

```ts
import { createEventContext } from '@wooksjs/event-core'

async dispatch(eventName: string) {
  const fn = this.handlers.get(eventName)
  return createEventContext({ logger: this.logger }, () => fn())
}
```

6. **Create parameter decorators (optional):**

```ts
function MyEventData(): ParameterDecorator {
  return Resolve(() => {
    // read from event context
  }, 'eventData')
}
```

7. **Register and use:**

```ts
const app = new Moost()
const adapter = app.adapter(new MyAdapter())
app.registerControllers(MyController)
await app.init()
adapter.dispatch('user.created')
```

## Integration Notes

### Event Context

Every handler invocation must occur within a Wooks event context. Adapters that use Wooks applications (WooksHttp, WooksCli, etc.) get this automatically. For custom dispatching, wrap calls in `createEventContext()`:

```ts
import { createEventContext } from '@wooksjs/event-core'

createEventContext({ logger }, () => {
  return handler()
})
```

### Context Type Filtering

Set `contextType` in `defineMoostEventHandler` to enable composables to detect the event type:

```ts
import { eventTypeKey, current } from '@wooksjs/event-core'

// In a composable
function useMyEventData() {
  const type = current().get(eventTypeKey)
  if (type !== 'MY_EVENT') throw new Error('Not in MY_EVENT context')
  // ...
}
```

### Scope Management

- **Default** (`manualUnscope: false`): DI scope cleaned up automatically after handler returns
- **Manual** (`manualUnscope: true`): Adapter must call `unscope()` when the event lifecycle ends (e.g., on connection close, request end)

Use manual unscope for:
- Long-lived connections (WebSocket, SSE)
- Streaming responses (HTTP)
- Workflows with pause/resume

### Handler Filtering

Adapters must filter `opts.handlers` by their own handler type. A single method can have multiple handler decorators from different adapters:

```ts
@Get('hello')    // type: 'HTTP'
@Cli('hello')    // type: 'CLI'
hello() {}
```

Each adapter sees all handlers but should only process its own type.

## Best Practices

- Always filter `opts.handlers` by `handler.type` in `bindHandler()`
- Use `defineMoostEventHandler()` — do not re-implement the lifecycle
- Provide adapter services via `getProvideRegistry()` for DI access
- Log bound handlers via `opts.logHandler()` for debugging
- Register handlers via `opts.register()` for overview/introspection
- Use `manualUnscope: true` for long-lived event scopes
- Store the Moost instance in `onInit()` for not-found handler support
- Create adapter-specific parameter decorators using `@Resolve()`
- Use a separate Mate instance for adapter-specific metadata that does not belong in `TMoostMetadata`
- Set `contextType` for composable type safety

## Gotchas

- `bindHandler()` is called once per method per adapter — it fires for all methods, not just ones relevant to your adapter
- `opts.fakeInstance` is `Object.create(constructor.prototype)` — do not call methods on it, only read metadata
- `opts.getInstance()` may return a Promise for `FOR_EVENT` scoped controllers
- `defineMoostEventHandler()` returns a function — call it within a Wooks event context
- The handler function is sync-first: it only returns a Promise when the lifecycle goes async
- `hooks.init` runs before the controller is resolved — `instance` is not available
- `hooks.end` runs after interceptors — `instance` and `getResponse()` are available
- If `callControllerMethod` is provided, it overrides the default method invocation entirely
- The scope ID is deterministic per event context (monotonic counter, not random UUID)
- Global interceptors run even for not-found handlers — use `getGlobalInterceptorHandler()` in your not-found path
- `opts.resolveArgs` may be `undefined` if the method has no parameters — handle this case
- Handler type strings are conventions, not enforced — choose unique names to avoid conflicts with other adapters
