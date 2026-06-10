# Moost Flavors

Moost is event-agnostic by design. The core — controllers, DI, interceptors, pipes — works the same regardless of what triggered the event. On top of this core, Moost provides **adapters** for specific event domains, each wrapping the corresponding [Wooks](https://wooks.moost.org/wooks/what) adapter with a decorator layer.

## HTTP

**Package:** `@moostjs/event-http`

Build REST APIs and web servers with decorator-based routing, automatic parameter extraction, and the full Wooks HTTP composable set.

```ts
import { MoostHttp, Get, Post, Body } from '@moostjs/event-http'
import { Moost, Controller, Param } from 'moost'

@Controller('api')
class ApiController {
  @Get('hello/:name')
  greet(@Param('name') name: string) {
    return `Hello, ${name}!`
  }

  @Post('users')
  createUser(@Body() user: { name: string }) {
    return { created: user.name }
  }
}

const app = new Moost()
const http = new MoostHttp()
app.adapter(http)
app.registerControllers(ApiController).init()
http.listen(3000)
```

Comes with Swagger generation, body parsing, static file serving, and reverse proxy support.

[Get started with HTTP &rarr;](/webapp/)

## WebSocket

**Package:** `@moostjs/event-ws`

Build real-time WebSocket servers with routed message handlers (`@Message`, `@Connect`, `@Disconnect`), rooms, broadcasting, and composable state. Integrates with the HTTP adapter for upgrade handling — declare an `@Upgrade()` handler to control where connections are accepted, and HTTP composables keep working inside WS handlers via the upgrade request context.

[Get started with WebSocket &rarr;](/wsapp/)

## CLI

**Package:** `@moostjs/event-cli`

Build command-line applications with decorator-based command routing (`@Cli`), typed options (`@CliOption`), and auto-generated help. Commands use the same route-style patterns as HTTP, and options are parsed automatically.

[Get started with CLI &rarr;](/cliapp/)

## Workflows

**Package:** `@moostjs/event-wf`

Build multi-step pipelines with decorator-based step definitions (`@Step`), flow schemas (`@Workflow` + `@WorkflowSchema`), state management, and conditional branching. Workflows are **interruptible** — when a step needs input, the workflow pauses and returns serializable state; resume it with the input minutes or days later.

[Get started with Workflows &rarr;](/wf/)

## Multiple Adapters

Moost supports registering multiple adapters at once. Each adapter operates independently — controllers are registered once and each adapter picks up only the decorators it understands, so one controller class can serve both an HTTP route and a CLI command.

Register each adapter with its own `app.adapter()` call:

```ts
const app = new Moost()
app.adapter(new MoostHttp())
app.adapter(new MoostCli())
app.registerControllers(AppController).init()
```

::: warning
`app.adapter()` returns the **adapter instance**, not the Moost app — so you can chain adapter methods like `app.adapter(new MoostHttp()).listen(3000)`, but you cannot chain a second `.adapter()` call onto it.
:::

## Custom Adapters

You can build your own adapter for any event-driven scenario — job queues, message brokers, custom protocols. All adapters implement the `TMoostAdapter` interface and share the same controller, DI, interceptor, and pipe infrastructure. Inside `bindHandler()`, adapters wrap each event with the `defineMoostEventHandler()` helper from `moost`, which runs the full lifecycle — DI scope, interceptors, argument pipes, and handler invocation.
