# Core Concepts & Setup — moost

> Moost application lifecycle, controller registration, adapter attachment, and the mental model for event-driven TypeScript applications.

## Scaffolding

Create a new project with `npm create moost@latest`. The CLI prompts for project name and template.

Available templates:
- `--http` — HTTP server with `@moostjs/event-http`
- `--cli` — CLI application with `@moostjs/event-cli`
- `--ws` — WebSocket server with `@wooksjs/event-ws`
- `--ssr` — SSR application with `@moostjs/vite`
- `--wf` — Workflow engine with `@moostjs/event-wf`
- `--oxc` — Pre-configured with oxlint + oxfmt tooling

```sh
npm create moost@latest my-app -- --http
```

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

## API Reference

### Moost (class)

```ts
import { Moost } from 'moost'
const app = new Moost({ globalPrefix?: string, logger?: TConsoleBase })
```

- `globalPrefix` — Prefix prepended to all event paths across all adapters (e.g., `'api/v1'` makes all routes start with `/api/v1/`).
- `logger` — Custom logger instance (defaults to a console-based logger).

#### app.adapter\<T\>(a: T): T

Attach an event adapter. Returns the adapter for chaining.

```ts
const http = app.adapter(new MoostHttp())
http.listen(3000)
```

#### app.registerControllers(...controllers)

Register one or more controller classes or instances. Accepts class constructors, instances, or `[prefix, controller]` tuples to override the controller's own prefix.

```ts
app.registerControllers(UserController, OrderController)
app.registerControllers(['api/v2', UserControllerV2])
```

#### app.init(): Promise\<void\>

Initialize the application: bind all controllers to all adapters, then call each adapter's `onInit()`.

#### app.applyGlobalInterceptors(...interceptors)

Register global interceptors that apply to all handlers. Accepts class constructors, `TInterceptorDef` objects, or `TInterceptorData` entries.

```ts
app.applyGlobalInterceptors(authGuard, cliHelpInterceptor())
```

#### app.applyGlobalPipes(...pipes)

Register global pipes that apply to all parameter/property resolution.

#### app.getLogger(topic?: string)

Return a logger instance, optionally scoped to a topic.

```ts
const logger = app.getLogger('MyApp')
logger.info('Server started')
```

#### app.setProvideRegistry(provide)

Register DI provide entries. Use `createProvideRegistry()` from `@prostojs/infact`.

#### app.setReplaceRegistry(replace)

Register DI class replacements. Use `createReplaceRegistry()` from `@prostojs/infact`.

### @Controller(prefix?: string)

Class decorator marking a class as a controller. The optional prefix is prepended to all handler paths. Auto-sets `@Injectable` if not already present.

### @ImportController(ctrl, opts?)

Register a nested controller within another controller, inheriting its prefix. Supports lazy loading with `() => ControllerClass`.

```ts
@Controller('api')
@ImportController(UsersController)
@ImportController('v2', UsersControllerV2)
class AppController {}
```

## Common Patterns

### Extending Moost

For simple apps, extend `Moost` directly and add handler methods:

```ts
class MyApp extends Moost {
  @Get('hello/:name')
  hello(@Param('name') name: string) {
    return `Hello, ${name}!`
  }
}

const app = new MyApp()
app.adapter(new MoostHttp()).listen(3000)
await app.init()
```

### Multi-Adapter Application

Attach multiple adapters to handle different event sources:

```ts
const app = new Moost()
const http = app.adapter(new MoostHttp())
const cli = app.adapter(new MoostCli())
app.registerControllers(AppController)
await app.init()
http.listen(3000)
```

### Controller-Only Registration

The same controller can respond to both HTTP and CLI events:

```ts
@Controller('greet')
class GreetController {
  @Get(':name')
  @Cli(':name')
  greet(@Param('name') name: string) {
    return `Hello, ${name}!`
  }
}
```

## Best Practices

- Call `app.init()` after registering all controllers and adapters
- Start listening before or after `init()` — adapter buffers requests
- Use `@Controller(prefix)` to namespace related handlers
- Keep controllers focused — one per feature area
- Extend Moost for simple apps; use `registerControllers()` for larger projects
- Use `createProvideRegistry()` to supply adapter-specific services to DI

## Gotchas

- `app.init()` must be awaited — it is async
- Handler methods are bound to all attached adapters but each adapter filters by handler type
- The order of `adapter()` calls does not matter for functionality
- Moost itself is a controller — methods decorated with `@Get()` etc. directly on a `Moost` subclass become handlers
- `@Controller` auto-sets `@Injectable` — no need to add both decorators
- Singleton controllers are instantiated in a synthetic event context during `init()`
