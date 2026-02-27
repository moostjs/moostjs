# What is Moost?

Moost is a TypeScript framework for building HTTP servers, CLI tools, WebSocket apps, and workflow engines. If you've used NestJS, the shape will feel familiar — controllers, dependency injection, interceptors, pipes — but without the module ceremony. Under the hood, it's powered by [Wooks](https://wooks.moost.org/wooks/what) composables.

## A Quick Look

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

Decorators declare your routes, DI scopes, validation rules, and access control. They write to a shared metadata store ([`@prostojs/mate`](https://github.com/prostojs/mate)) that Moost reads at startup to wire everything together. Creating your own decorators is just a few lines of typed code.

## Dependency Injection

Mark a class `@Injectable()` and Moost handles the rest — no modules, no providers arrays, no `forRoot()`. Two scopes:

- **Singleton** — one instance for the entire app
- **For Event** — a fresh instance per request, command, or message

```ts
import { Injectable } from 'moost'

@Injectable('FOR_EVENT')
export class RequestLogger {
  log(msg: string) { /* ... */ }
}
```

Dependencies are resolved by constructor type. Use `@Provide()` / `@Inject()` when you need to swap implementations.

## Controllers

Controllers group handlers under a shared prefix. Nest them to build route hierarchies:

```ts
import { Controller, ImportController } from 'moost'

@Controller('admin')
@ImportController(UsersController)
@ImportController(SettingsController)
export class AdminController { }
```

A single controller can serve multiple event types at once — `@Get()` registers an HTTP route, `@Cli()` a CLI command, `@Message()` a WebSocket handler. Each adapter picks up only what it understands.

## Interceptors and Pipes

**Interceptors** wrap your handlers with lifecycle hooks — `before`, `after`, `error`. Great for auth guards, logging, or response transformation. Priority levels let you control the order.

**Pipes** process handler arguments step by step: resolve, transform, validate. Route params, query strings, and body data are extracted automatically. Add a validation layer (e.g., Atscript) to reject bad input before your handler even runs.

## Wooks Composables

Every Wooks composable works inside a Moost handler, so you can reach for typed request data whenever you need it:

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

Moost adds structure on top; Wooks provides the composable runtime underneath. You decide how much of each you want to use.

## Packages

| Package | What it does |
|---------|------|
| `moost` | Core framework — decorators, DI, pipes, interceptors |
| `@moostjs/event-http` | HTTP adapter (wraps `@wooksjs/event-http`) |
| `@moostjs/event-ws` | WebSocket adapter (wraps `@wooksjs/event-ws`) |
| `@moostjs/event-cli` | CLI adapter (wraps `@wooksjs/event-cli`) |
| `@moostjs/event-wf` | Workflow adapter (wraps `@wooksjs/event-wf`) |
| `@moostjs/swagger` | Swagger / OpenAPI generation |
| `@moostjs/otel` | OpenTelemetry tracing |
