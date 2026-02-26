# Core Concepts & Setup — moost

> Moost application lifecycle, controller registration, adapter attachment, and the mental model for event-driven TypeScript applications.

## Concepts

Moost is a **metadata-driven event processing framework**. The core mental model:

1. **Controllers** — Classes decorated with `@Controller()` that contain handler methods
2. **Adapters** — Implementations of `TMoostAdapter<H>` that bridge external event sources (HTTP, CLI, WS, etc.) to Moost's handler system
3. **Handlers** — Methods on controllers decorated with adapter-specific decorators (e.g., `@Get()`, `@Cli()`, `@Message()`) that process events
4. **Pipes** — Transform/resolve/validate method arguments before handler execution
5. **Interceptors** — Cross-cutting logic (auth, logging, error handling) wrapping handler execution

Unlike NestJS, Moost has **no module abstraction** — controllers are registered directly on the Moost instance.

### Lifecycle

```
app.adapter(adapter)           // 1. Attach adapters
app.registerControllers(Ctrl)  // 2. Register controller classes
await app.init()               // 3. Bind all handlers + call adapter.onInit()
adapter.listen(3000)           // 4. Start listening (adapter-specific)
```

During `init()`:
1. Adapter provide registries are merged into DI
2. All controller methods are scanned for handler metadata
3. For each handler, `adapter.bindHandler()` is called with full context
4. Each adapter's `onInit(moost)` hook fires last

## Installation

```bash
npm install moost
# or
pnpm add moost
```

## API Reference

### `Moost` (class)

The main application class. Can be extended or used directly.

```ts
import { Moost } from 'moost'

const app = new Moost()
```

#### `app.adapter<T>(a: T): T`

Attaches an event adapter. Returns the adapter for chaining.

```ts
const http = app.adapter(new MoostHttp())
http.listen(3000)
```

#### `app.registerControllers(...controllers)`

Registers one or more controller classes or instances.

```ts
app.registerControllers(UserController, OrderController)
```

#### `app.init(): Promise<void>`

Initializes the application: binds all controllers to all adapters, then calls each adapter's `onInit()`.

#### `app.interceptor(...interceptors)`

Registers global interceptors that apply to all handlers.

```ts
app.interceptor(myLoggingInterceptor)
```

#### `app.getLogger(topic?: string)`

Returns a logger instance, optionally scoped to a topic.

#### `app.getGlobalInterceptorHandler()`

Returns an `InterceptorHandler` for global interceptors. Used by adapters for 404/not-found handlers.

### `@Controller(prefix?: string)`

Class decorator marking a class as a controller. The optional prefix is prepended to all handler paths.

```ts
@Controller('users')
class UserController {
  @Get(':id')  // resolves to /users/:id
  getUser(@Param('id') id: string) { return { id } }
}
```

### `@ImportController(ctrl, opts?)`

Registers a nested controller within another controller, inheriting its prefix.

```ts
@Controller('api')
@ImportController(UserController)
@ImportController(OrderController)
class ApiController {}
```

## Common Patterns

### Pattern: Extending Moost

Create an application class extending Moost. Handler methods can live directly on it.

```ts
class MyApp extends Moost {
  @Get('health')
  health() { return { ok: true } }
}

const app = new MyApp()
const http = app.adapter(new MoostHttp())
http.listen(3000)
app.init()
```

### Pattern: Multi-adapter application

Attach multiple adapters to handle different event types simultaneously.

```ts
const app = new Moost()
const http = app.adapter(new MoostHttp())
const ws = app.adapter(new MoostWs({ httpApp: http.getHttpApp() }))
const cli = app.adapter(new MoostCli())

app.registerControllers(HttpController, WsController, CliController)
await app.init()
http.listen(3000)
```

Each adapter only processes handlers matching its own type (e.g., HTTP adapter ignores `@Cli()` handlers).

### Pattern: Controller-only registration

Controllers are not tied to a specific adapter. The same controller class can contain handlers for multiple adapters.

```ts
@Controller('app')
class AppController {
  @Get('status')      // handled by HTTP adapter
  httpStatus() { return { up: true } }

  @Cli('status')      // handled by CLI adapter
  cliStatus() { console.log('up') }
}
```

## Best Practices

- Call `app.init()` **after** registering all controllers and adapters
- Start listening (`adapter.listen()`) before or after `init()` — the adapter buffers requests until handlers are bound
- Use `@Controller(prefix)` to namespace related handlers
- Keep controllers focused — one per feature area
- Extend `Moost` for simple apps; use `registerControllers()` for larger projects

## Gotchas

- `app.init()` must be `await`ed — it's async because singleton controllers may need async DI resolution
- Handler methods are bound to **all** attached adapters, but each adapter filters by handler `type` — a `@Get()` decorator is ignored by the CLI adapter
- The order of `adapter()` calls doesn't matter for functionality but affects log output order
