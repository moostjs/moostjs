---
name: moostjs
description: >-
  Use when working with the Moost framework (moost, @moostjs/event-http/cli/wf/ws,
  @moostjs/swagger, @moostjs/otel, @moostjs/arbac, @moostjs/vite, create-moost) to
  build decorator-driven TypeScript apps for HTTP, CLI, WebSocket, Workflow events,
  or custom adapters. Covers controllers, handler/parameter/response decorators, DI,
  interceptors, pipes, auth guards, framework errors, common metadata decorators,
  Wooks composables, adapter authoring, quick apps, workflow outlets/state
  strategies, WebSocket rooms/testing, logging, and event context/scoping.
---

# Moost

Metadata-driven event processing framework for TypeScript. Decorators + composables (via Wooks) handle HTTP, CLI, WebSocket, Workflow events. Each event type = one adapter. No module abstraction — controllers register directly on `Moost`. DI, interceptors, pipes are shared across all adapters. A single controller can expose `@Get`, `@Cli`, `@Message` methods simultaneously; each adapter binds only its own handler type.

Powered by: `@prostojs/mate` (metadata), `@prostojs/infact` (DI), `@wooksjs/event-core` (async event context), `@prostojs/dye` (compile-time terminal colors).

## Domain map — load only what you need

| Domain | File | Load when |
|---|---|---|
| Core concepts, Moost class, lifecycle, registration | [core.md](references/core.md) | New project, multi-adapter setup, `app.init()`, Moost subclass |
| Decorators, metadata, custom decorators, Mate | [decorators.md](references/decorators.md) | Creating/using decorators, reading metadata |
| DI scopes, @Injectable, @Inject, @Provide, @Circular | [di.md](references/di.md) | Services, scoping, providers, replacements |
| Interceptors: priority, @Intercept, guards, class-based | [interceptors.md](references/interceptors.md) | Auth/logging/error cross-cutting |
| Pipes: @Pipe, @Resolve, TRANSFORM/VALIDATE | [pipes.md](references/pipes.md) | Validation, transformation, custom param decorators |
| Custom adapter: TMoostAdapter, defineMoostEventHandler | [custom-adapters.md](references/custom-adapters.md) | Build an adapter for a new event source |
| HTTP setup/routing | [event-http.md](references/event-http.md) | MoostHttp, route decorators, handler returns, fetch/SSR |
| HTTP request data | [http-request.md](references/http-request.md) | @Query/@Header/@Cookie/@Body/@Req/@Res/@Ip |
| HTTP response control | [http-response.md](references/http-response.md) | @SetStatus/@SetHeader/@SetCookie, refs, body limits, HttpError |
| HTTP auth guards | [http-auth.md](references/http-auth.md) | defineAuthGuard, AuthGuard, @Authenticate |
| CLI | [event-cli.md](references/event-cli.md) | CliApp, @Cli/@CliOption, help, CLI interceptors |
| Workflow | [event-wf.md](references/event-wf.md) | @Step/@Workflow/@WorkflowSchema, pause/resume, outlets, state strategies |
| WebSocket core | [event-ws.md](references/event-ws.md) | MoostWs/WsApp, @Message/@Connect/@Disconnect, wire protocol |
| WebSocket rooms | [ws-rooms.md](references/ws-rooms.md) | useWsRooms, broadcasting, WsBroadcastTransport |
| WebSocket testing | [ws-testing.md](references/ws-testing.md) | prepareTestWsMessageContext / prepareTestWsConnectionContext |
| Swagger/OpenAPI | `@moostjs/swagger` ([npm](https://www.npmjs.com/package/@moostjs/swagger)) | SwaggerController, Swagger* decorators |
| OpenTelemetry | `@moostjs/otel` ([npm](https://www.npmjs.com/package/@moostjs/otel)) | `initMoostOtel`, spans, tracing |
| RBAC/ABAC | `@moostjs/arbac` ([npm](https://www.npmjs.com/package/@moostjs/arbac)) | `MoostArbac` adapter |

## Scaffold

```bash
npm create moost@latest [name] -- [--http] [--cli] [--ws] [--wf] [--ssr] [--oxc] [--force]
```

`--wf` adds workflows to `--http`. Combinations (e.g. `--http --ws`) produce one app with both adapters. See [core.md](references/core.md) for details.

## Quick-start patterns

```ts
// HTTP
const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
app.registerControllers(AppController)
await app.init()

// CLI (CliApp is sugar over Moost + MoostCli + cliHelpInterceptor)
new CliApp().controllers(AppController).useHelp({ name: 'my-cli' }).start()

// Standalone WS (WsApp is sugar over Moost + MoostWs)
await new WsApp().controllers(ChatController).start(3000)

// Multi-adapter
const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
app.adapter(new MoostWs({ httpApp: http.getHttpApp() }))  // share HTTP server
app.adapter(new MoostWf())
app.registerControllers(AppController)
await app.init()

// Moost subclass as root controller
class MyApp extends Moost {
  @Get('health') health() { return 'ok' }
}
```

## Cross-cutting facts

**DI scopes** — `@Injectable()` / `@Injectable(true)` / `@Injectable('SINGLETON')` = one instance for app lifetime. `@Injectable('FOR_EVENT')` = fresh instance per event. `@Controller()` implicitly sets `@Injectable(true)` (SINGLETON). Use `'FOR_EVENT'` when class properties hold per-request state or when using property-level ref/resolver decorators. FOR_EVENT requires an active event context (composables don't work in SINGLETON constructors).

**Wooks composables work inside handlers** — All `@wooksjs/*` composables (e.g., `useRequest`, `useResponse`, `useHeaders`) work directly in Moost handlers; they run in the same event context.

**Logging** — composable: `useLogger('topic')` (from `moost`, re-exported from `@wooksjs/event-core`). Property: `@InjectEventLogger('topic')` (per-event) / `@InjectMoostLogger('topic')` (app-level, uses `@LoggerTopic` or class `@Id` as fallback). Standalone: `createLogger({ transports: [loggerConsoleTransport()] })`.

**Re-exports** — `moost` re-exports `current`, `useLogger`, `key`, `cached`, `eventTypeKey`, `createEventContext`, `run` from `@wooksjs/event-core`, plus `createProvideRegistry`/`createReplaceRegistry` from `@prostojs/infact`. `@moostjs/event-http` re-exports `httpKind`, `HttpError`, `useHttpContext`. `@moostjs/event-cli` re-exports `cliKind`, and `Param`/`Controller`/`Intercept`/`Description`/`Optional`/`defineBeforeInterceptor`/`defineAfterInterceptor`/`defineInterceptor` from `moost` (note: `defineErrorInterceptor` is NOT re-exported — import from `moost`). `@moostjs/event-wf` re-exports `wfKind`, `useWfState`, `StepRetriableError`, outlet primitives. `@moostjs/event-ws` re-exports `wsConnectionKind`/`wsMessageKind`, `WsError`, all `useWs*` composables, `currentConnection`, `prepareTestWs*`.

## Architecture in one page

**Decorator system.** All decorators go through `getMoostMate()` — singleton `Mate` in the `'moost'` workspace. Metadata read at bind time. Class-level, method-level, property-level, parameter-level. Details: [decorators.md](references/decorators.md).

**Interceptor lifecycle.** Priority order (lower first in `before`): `BEFORE_ALL` < `BEFORE_GUARD` < `GUARD` < `AFTER_GUARD` < `INTERCEPTOR` < `CATCH_ERROR` < `AFTER_ALL`. Phases per interceptor: `before` (can `reply()` early) → handler → `after`/`onError` (LIFO onion). Details: [interceptors.md](references/interceptors.md).

**Pipe pipeline.** Priority order: `BEFORE_RESOLVE` < `RESOLVE` (built-in resolve pipe; calls resolver set by `@Param`/`@Body`/`@Query`/`@Resolve`) < `AFTER_RESOLVE` < `BEFORE_TRANSFORM` < `TRANSFORM` < `AFTER_TRANSFORM` < `BEFORE_VALIDATE` < `VALIDATE` < `AFTER_VALIDATE`. Scopes: global / class / method / parameter — merged & sorted. Details: [pipes.md](references/pipes.md).

**Event handler lifecycle** (`defineMoostEventHandler`). Scope + logger setup → `hooks.init` → resolve controller (DI) → set controller context → interceptor `before` → resolve args (pipes) → handler → interceptor `after`/`onError` → scope cleanup (unless `manualUnscope`) → `hooks.end`. Details: [custom-adapters.md](references/custom-adapters.md).

**Adapter pattern.** Each adapter implements `TMoostAdapter<H>`; attached via `app.adapter(a)`; `bindHandler()` registers one handler. Adapters filter `opts.handlers` by their own `handler.type`. Details: [custom-adapters.md](references/custom-adapters.md).
