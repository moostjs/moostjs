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

## Several Apps in One Process

An adapter created without a Wooks app of its own (`new MoostHttp()`, `new MoostCli()`, …)
routes through the process-wide global Wooks. Every adapter of one app shares it on purpose.
Two **apps** in one process, typical in tests, then register their routes into one router.
A request on a route both apps register runs the first app's handler chain. When that chain
throws (a guard's 429, say), the error is swallowed and the second app's chain answers instead.

When the second app's `init()` binds into a Wooks instance another app already uses, Moost logs
a warning, once per Wooks instance (moost 0.7.5 or later). Apps that share a Wooks app you pass
in yourself (`new MoostHttp(wooksHttp)`) are sharing on purpose and get no warning. To give each
app its own router, call `clearGlobalWooks()` before creating each app:

```ts
import { clearGlobalWooks, Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'

beforeEach(() => {
  clearGlobalWooks() // the next `new MoostHttp()` gets a fresh Wooks
})

async function createTestApp() {
  const app = new Moost()
  const http = app.adapter(new MoostHttp())
  app.registerControllers(AppController)
  await app.init()
  return http // http.request('/path') in the test
}
```

The app created before the call keeps its own Wooks. `app.dispose()` does not remove an app's
routes, so dispose alone doesn't separate two apps. Re-initialising the same app doesn't warn,
and neither does a [`@moostjs/vite`](/webapp/vite) dev reload: it clears the global Wooks
before the entry runs again.

::: tip Passing an app instead
`createHttpApp(opts, new Wooks())` (`Wooks` from `wooks`) also gives an app its own router, but
`MoostHttp` uses a `WooksHttp` you pass in as is: it loses MoostHttp's error-body translation and
`Accept-Language` negotiation ([Locale and Translation](/moost/i18n)). Prefer `clearGlobalWooks()`.
:::

## Custom Adapters

You can build your own adapter for any event-driven scenario — job queues, message brokers, custom protocols. All adapters implement the `TMoostAdapter` interface and share the same controller, DI, interceptor, and pipe infrastructure. Inside `bindHandler()`, adapters wrap each event with the `defineMoostEventHandler()` helper from `moost`, which runs the full lifecycle — DI scope, interceptors, argument pipes, and handler invocation.

If your adapter routes through a Wooks instance, call `claimWooks()` from `moost` in its
`onInit` (moost 0.7.5 or later). It warns once when another app already bound the same adapter's
handlers into that Wooks ([Several Apps in One Process](#several-apps-in-one-process)). Pass
`created: true` when the adapter created its Wooks app itself and so landed on the global Wooks.
Without it, sharing is treated as deliberate and only an adapter that did create its app warns:

```ts
onInit(moost: Moost) {
  claimWooks(moost, this.wooksApp.getWooks(), this.name, { created: !this.passedApp })
}
```
