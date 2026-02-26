# What is Moost?

Moost is a metadata-driven event processing framework for TypeScript. It wraps [Wooks](https://wooks.moost.org/wooks/what) with a decorator layer — controllers, dependency injection, interceptors, and pipes — so you can build HTTP servers, CLI tools, WebSocket apps, and workflow engines using a single, familiar pattern.

## Decorators and Metadata

Moost uses TypeScript decorators to declare everything: routing, DI scope, validation, access control. Under the hood, all decorators write to a shared metadata store powered by [`@prostojs/mate`](https://github.com/prostojs/mate). This makes it easy to create custom decorators and read metadata at any point in the lifecycle.

```ts
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller('api')
export class AppController {
  @Get('hello/:name')
  greet(@Param('name') name: string) {
    return `Hello, ${name}!`
  }
}
```

Decorators are the entry point — but they don't do magic. They store metadata that Moost reads at init time to wire up routes, resolve dependencies, and build interceptor chains.

## Dependency Injection

Moost provides DI through [`@prostojs/infact`](https://github.com/prostojs/infact) — no modules, no providers arrays, no `forRoot()`. Mark a class `@Injectable()` and Moost manages its lifecycle:

- **Singleton** — one instance for the entire app
- **For Event** — a fresh instance per event (HTTP request, CLI command, etc.)

```ts
import { Injectable } from 'moost'

@Injectable('FOR_EVENT')
export class RequestLogger {
  log(msg: string) { /* ... */ }
}
```

Dependencies are resolved automatically by constructor type. Use `@Provide()` / `@Inject()` to swap implementations without changing consumer code.

## Controllers

Controllers group related handlers under a shared prefix. Nest them with `@ImportController()` to build hierarchical route trees:

```ts
import { Controller, ImportController } from 'moost'

@Controller('admin')
@ImportController(UsersController)
@ImportController(SettingsController)
export class AdminController { }
```

Each adapter reads controller metadata and registers only the handlers it understands — `@Get()` goes to HTTP, `@Cli()` goes to CLI, `@Message()` goes to WebSocket. A single controller can serve multiple adapters.

## Interceptors and Pipes

**Interceptors** wrap handlers with lifecycle hooks: `init`, `before`, `after`, `onError`. Use them for auth guards, logging, error handling, or response transformation. Priority levels control execution order.

**Pipes** process handler arguments in a defined sequence: resolve, transform, validate. The built-in resolve pipe extracts route params, query strings, and body data. Plug in validation (e.g., Atscript) to reject bad input before the handler runs.

## Built on Wooks

Moost doesn't replace Wooks — it builds on top of it. Every Wooks composable works inside a Moost handler:

```ts
import { Get } from '@moostjs/event-http'
import { useRequest, useCookies } from '@wooksjs/event-http'
import { Controller } from 'moost'

@Controller()
export class AppController {
  @Get('profile')
  profile() {
    const { method, url } = useRequest()
    const cookies = useCookies()
    return { method, url, session: cookies.get('session') }
  }
}
```

Moost adds structure (decorators, DI, interceptors) while Wooks provides the composable runtime. You choose how deep to go with each.

## Package Structure

| Package | Role |
|---------|------|
| `moost` | Core: Moost class, decorators, DI, pipes, interceptors |
| `@moostjs/event-http` | HTTP adapter wrapping `@wooksjs/event-http` |
| `@moostjs/event-ws` | WebSocket adapter wrapping `@wooksjs/event-ws` |
| `@moostjs/event-cli` | CLI adapter wrapping `@wooksjs/event-cli` |
| `@moostjs/event-wf` | Workflow adapter wrapping `@wooksjs/event-wf` |
| `@moostjs/swagger` | Swagger/OpenAPI integration |
| `@moostjs/otel` | OpenTelemetry tracing |
