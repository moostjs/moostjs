---
name: moostjs
description: >-
  Use this skill when working with the Moost framework (moost, @moostjs/event-http,
  @moostjs/event-cli, @moostjs/event-wf, @moostjs/event-ws, @moostjs/swagger,
  @moostjs/otel, @moostjs/arbac) — to create decorator-driven applications handling HTTP, CLI,
  WebSocket, or Workflow events. Covers decorators (@Controller, @Get, @Post, @Put,
  @Delete, @Patch, @Cli, @Message, @Connect, @Disconnect, @Step, @Workflow, @Body,
  @Query, @Header, @Param, @Intercept, @Pipe, @Injectable, @Inject, @Provide,
  @Resolve, @Authenticate, @SetStatus, @SetHeader, @SetCookie, @CliOption,
  @WorkflowSchema, @WorkflowParam, @MessageData, @ConnectionId), composables
  (useLogger, useWfState, useWsConnection, useWsRooms, useWsMessage, useWsServer,
  useControllerContext), DI scopes, interceptor lifecycle, pipe pipeline, adapter
  pattern, multi-adapter setup, auth guards, controller registration, and scaffolding
  with create-moost.
---

# Moost

Moost is a metadata-driven event processing framework for TypeScript. It uses decorators and a composable architecture powered by Wooks to handle HTTP, CLI, WebSocket, and Workflow events. Each event type has an adapter — no module abstraction exists; controllers register directly with the Moost instance. DI, interceptors, and pipes are shared across all adapters.

## Scaffolding

```bash
npm create moost@latest
```

Options: `--http` (HTTP web app), `--cli` (CLI app), `--ws` (WebSocket app), `--ssr` (Vue SSR), `--wf` (add workflows to HTTP), `--oxc` (add oxlint+oxfmt).

The scaffolder creates a ready-to-run project with the chosen adapter(s), a sample controller, and build/dev scripts. Multi-adapter combinations (e.g., `--http --ws --wf`) produce a single app with all adapters attached.

## Architecture

### Decorator system
All decorators go through `getMoostMate()` — a singleton `Mate` instance from `@prostojs/mate` operating in the `'moost'` metadata workspace. Metadata is stored on classes/methods/params and read at bind time.

### Dependency injection
Powered by `@prostojs/infact`. Two scopes: `SINGLETON` (one instance for the app lifetime) and `FOR_EVENT` (fresh instance per event). `@Controller` implicitly sets `@Injectable`. The DI container resolves constructor params, property injections, and `@Provide`/`@Inject` bindings.

### Adapter pattern
Each event type implements `TMoostAdapter<H>`. Adapters are attached via `app.adapter(instance)` and implement `bindHandler()` to register routes/commands with their underlying Wooks engine. The core knows nothing about HTTP/CLI/WS specifics.

### Interceptor lifecycle
Priority levels execute in order: `BEFORE_ALL` > `BEFORE_GUARD` > `GUARD` > `AFTER_GUARD` > `INTERCEPTOR` > `CATCH_ERROR` > `AFTER_ALL`. Each interceptor has phases: `before` (can reply early) > handler execution > `after`/`onError`. After/onError phases run in LIFO (onion) order.

### Pipe pipeline
Pipes transform/resolve/validate handler arguments in priority order:
`BEFORE_RESOLVE` > `RESOLVE` > `AFTER_RESOLVE` > `BEFORE_TRANSFORM` > `TRANSFORM` > `AFTER_TRANSFORM` > `BEFORE_VALIDATE` > `VALIDATE` > `AFTER_VALIDATE`.
The built-in resolve pipe invokes resolver functions set by param decorators (`@Param`, `@Body`, `@Query`, etc.).

### Event handler lifecycle (`defineMoostEventHandler`)
1. Scope registration and logger setup
2. Controller resolution (DI)
3. Argument resolution via pipes
4. Interceptor before phase (can short-circuit with `reply()`)
5. Handler method execution
6. Interceptor after/onError phase
7. Scope cleanup

## How to use this skill

Read the domain file that matches the task. Do not load all files — only what you need.

| Domain | File | Load when... |
|--------|------|------------|
| Core concepts & setup | [core.md](references/core.md) | Starting a new project, Moost class, controller registration, adapters |
| Decorators & metadata | [decorators.md](references/decorators.md) | Creating/using decorators, reading metadata, getMoostMate() |
| Dependency injection | [di.md](references/di.md) | DI scopes, @Injectable, @Inject, @Provide, @Circular |
| Interceptors | [interceptors.md](references/interceptors.md) | Creating interceptors, priority levels, guards, @Intercept |
| Pipes & resolvers | [pipes.md](references/pipes.md) | @Pipe, @Resolve, validation/transform, argument resolution |
| Custom adapters | [custom-adapters.md](references/custom-adapters.md) | Building a new adapter, TMoostAdapter, defineMoostEventHandler |
| HTTP: setup & routing | [event-http.md](references/event-http.md) | MoostHttp, route decorators, controllers, handler returns |
| HTTP: request data | [http-request.md](references/http-request.md) | @Query, @Header, @Cookie, @Body, @Authorization, @Ip |
| HTTP: response control | [http-response.md](references/http-response.md) | @SetStatus, @SetHeader, @SetCookie, refs, body limits, HttpError |
| HTTP: authentication | [http-auth.md](references/http-auth.md) | Auth guards, defineAuthGuard, AuthGuard, @Authenticate |
| CLI application | [event-cli.md](references/event-cli.md) | CliApp, @Cli, @CliOption, help system, controllers |
| Workflow engine | [event-wf.md](references/event-wf.md) | @Step, @Workflow, schemas, pause/resume, outlets, spies |
| WebSocket: core | [event-ws.md](references/event-ws.md) | MoostWs, @Message, @Connect, handlers, protocol, WsError |
| WebSocket: rooms | [ws-rooms.md](references/ws-rooms.md) | Room management, broadcasting, useWsRooms, scaling |
| WebSocket: testing | [ws-testing.md](references/ws-testing.md) | Unit testing WS handlers, prepareTestWsMessageContext |
| Swagger / OpenAPI | `@moostjs/swagger` ([npm](https://www.npmjs.com/package/@moostjs/swagger)) | SwaggerController, @SwaggerTag, @SwaggerResponse, OpenAPI spec |
| OpenTelemetry | `@moostjs/otel` ([npm](https://www.npmjs.com/package/@moostjs/otel)) | Automatic spans, tracing, metrics |
| RBAC / ABAC | `@moostjs/arbac` ([npm](https://www.npmjs.com/package/@moostjs/arbac)) | Role/attribute-based access control |

## Quick reference

### moost (core)

```ts
// Core
import { Moost, Controller, ImportController, Param, Params } from 'moost'
// DI
import { Injectable, Inject, Provide, Replace, Circular } from 'moost'
import { InjectFromScope, InjectScopeVars } from 'moost'
import { createProvideRegistry, createReplaceRegistry } from 'moost'
// Interceptors & pipes
import { Intercept, Pipe, Resolve, Const, ConstFactory } from 'moost'
import { defineBeforeInterceptor, defineAfterInterceptor, defineInterceptor } from 'moost'
import { defineErrorInterceptor, definePipeFn } from 'moost'
// Common decorators
import { Description, Optional, Required, Label, Value, Id } from 'moost'
import { ApplyDecorators, LoggerTopic } from 'moost'
// Loggers
import { InjectEventLogger, InjectMoostLogger } from 'moost'
import { createLogger, loggerConsoleTransport } from 'moost'
// Metadata & adapter utilities
import { getMoostMate, getMoostInfact, defineMoostEventHandler } from 'moost'
import type { TMoostAdapter, TMoostAdapterOptions, TMoostMetadata } from 'moost'
// Composables (re-exported from @wooksjs/event-core)
import { current, useLogger, key, cached, run, createEventContext, eventTypeKey } from 'moost'
import { useControllerContext } from 'moost'
import type { Logger, EventContext } from 'moost'
```

### @moostjs/event-http

```ts
// Route decorators
import { MoostHttp, Get, Post, Put, Delete, Patch, All, HttpMethod, Upgrade } from '@moostjs/event-http'
// Request data
import { Query, Header, Cookie, Body, RawBody, Authorization } from '@moostjs/event-http'
import { Url, Method, Req, Res, ReqId, Ip, IpList } from '@moostjs/event-http'
// Response control
import { SetHeader, SetCookie, SetStatus } from '@moostjs/event-http'
import { StatusRef, HeaderRef, CookieRef, CookieAttrsRef } from '@moostjs/event-http'
import { BodySizeLimit, CompressedBodySizeLimit, BodyReadTimeoutMs } from '@moostjs/event-http'
// Auth & errors
import { Authenticate, AuthGuard, defineAuthGuard, HttpError } from '@moostjs/event-http'
import { httpKind, enableLocalFetch } from '@moostjs/event-http'
```

### @moostjs/event-cli

```ts
import { CliApp, MoostCli, Cli, CliOption, CliAlias, CliExample } from '@moostjs/event-cli'
import { CliGlobalOption, cliHelpInterceptor, CliHelpInterceptor } from '@moostjs/event-cli'
import { cliKind } from '@moostjs/event-cli'
```

### @moostjs/event-wf

```ts
import { MoostWf, Step, Workflow, WorkflowSchema, WorkflowParam } from '@moostjs/event-wf'
import { StepRetriableError, useWfState, wfKind } from '@moostjs/event-wf'
import { outlet, outletHttp, outletEmail } from '@moostjs/event-wf'
import { handleWfOutletRequest, createOutletHandler, createHttpOutlet, createEmailOutlet } from '@moostjs/event-wf'
import { useWfOutlet, useWfFinished } from '@moostjs/event-wf'
import type { TFlowOutput, TWorkflowSchema } from '@moostjs/event-wf'
```

### @moostjs/event-ws

```ts
import { MoostWs, WsApp, WooksWs } from '@moostjs/event-ws'
import { Message, Connect, Disconnect } from '@moostjs/event-ws'
import { MessageData, RawMessage, MessageId, MessageType, MessagePath, ConnectionId } from '@moostjs/event-ws'
import { useWsConnection, useWsMessage, useWsRooms, useWsServer, currentConnection } from '@moostjs/event-ws'
import { WsError, WsRoomManager } from '@moostjs/event-ws'
import { prepareTestWsMessageContext, prepareTestWsConnectionContext } from '@moostjs/event-ws'
import type { WsClientMessage, WsReplyMessage, WsPushMessage, WsBroadcastTransport } from '@moostjs/event-ws'
```

### @moostjs/swagger

```ts
import { SwaggerController, getSwaggerMate } from '@moostjs/swagger'
// Decorators
import {
  SwaggerTag, SwaggerResponse, SwaggerRequestBody, SwaggerParam,
  SwaggerPublic, SwaggerDeprecated, SwaggerOperationId, SwaggerExternalDocs,
  SwaggerExclude, SwaggerDescription, SwaggerExample, SwaggerSecurity,
  SwaggerSecurityAll, SwaggerLink, SwaggerCallback,
} from '@moostjs/swagger'
```

### @moostjs/otel

```ts
import { initMoostOtel } from '@moostjs/otel'
// Composables & decorators available after init
```

### @moostjs/arbac

```ts
import { MoostArbac } from '@moostjs/arbac'
// RBAC/ABAC access control adapter
```

### Quick-start patterns

```ts
// HTTP app
const app = new Moost()
app.adapter(new MoostHttp({ port: 3000 }))
app.registerControllers(AppController)
await app.init()

// CLI app
new CliApp()
  .controllers(AppController)
  .useHelp({ name: 'my-cli' })
  .start()

// Multi-adapter (HTTP + WS + CLI)
const app = new Moost()
app.adapter(new MoostHttp({ port: 3000 }))
app.adapter(new MoostWs())
app.registerControllers(AppController)
await app.init()
```

## Cross-cutting patterns

### Multi-adapter setup

All adapters share one Moost instance. Controllers can have handlers for different event types — a single controller can define `@Get()` methods, `@Cli()` methods, and `@Message()` methods. Each adapter only binds the handlers it recognizes.

```ts
const app = new Moost()
app.adapter(new MoostHttp({ port: 3000 }))
app.adapter(new MoostWs())
app.adapter(new MoostWf())
app.registerControllers(SharedController)
await app.init()
```

### Using Wooks composables inside Moost handlers

Moost handlers run inside a Wooks event context. All `@wooksjs/*` composables work directly:

```ts
import { useRequest, useResponse } from '@wooksjs/event-http'
import { useLogger } from 'moost'

@Get('status')
status() {
  const { url } = useRequest()
  const logger = useLogger('status')
  logger.info(url())
  return { ok: true }
}
```

### DI scopes

```ts
@Injectable('SINGLETON')  // one instance for app lifetime (default)
class DbService {}

@Injectable('FOR_EVENT')  // fresh instance per event
class RequestContext {}
```

`@Controller()` implicitly sets `@Injectable('FOR_EVENT')`. Singleton controllers are instantiated once during init; FOR_EVENT controllers are created per request/command/message.

### Logging

```ts
// Composable (inside event handler)
const logger = useLogger('topic')

// Decorator injection
class MyController {
  @InjectEventLogger('topic')  // scoped to current event
  logger!: Logger

  @InjectMoostLogger('topic')  // app-level logger
  appLogger!: Logger
}

// Standalone logger
import { createLogger, loggerConsoleTransport } from 'moost'
const logger = createLogger({ transports: [loggerConsoleTransport()] })
```

### Controller as Moost subclass

Moost itself is a controller. Decorate methods on a Moost subclass directly:

```ts
class MyApp extends Moost {
  @Get('health')
  health() { return 'ok' }
}

const app = new MyApp()
app.adapter(new MoostHttp({ port: 3000 }))
await app.init()
```
