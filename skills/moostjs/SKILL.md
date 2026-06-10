---
name: moostjs
description: >-
  Use when working with the Moost framework (moost, @moostjs/event-http/cli/wf/ws,
  @moostjs/swagger, @moostjs/otel, @moostjs/vite, create-moost) to
  build decorator-driven TypeScript apps for HTTP, CLI, WebSocket, Workflow events,
  or custom adapters. Covers controllers, handler/parameter/response decorators, DI,
  interceptors, pipes, auth guards, framework errors, common metadata decorators,
  Wooks composables, adapter authoring, quick apps, workflow outlets/state
  strategies, WebSocket rooms/testing, logging, app-init hooks (@MoostInit), the
  Vite plugin (dev/build, middleware, SSR/SPA, deployment), event
  context/scoping, Swagger/OpenAPI generation, and OTel tracing/metrics. Not for
  plain @wooksjs/* apps without Moost decorators (use the wooksjs skill), nor
  auth/RBAC — @moostjs/arbac is deprecated; use the aooth packages
  (@aooth/auth-moost, @aooth/arbac-moost) and their own docs/skill.
---

# Moost

Metadata-driven event processing framework for TypeScript. Decorators + composables (via Wooks) handle HTTP, CLI, WebSocket, Workflow events. Each event type = one adapter. No module abstraction — controllers register directly on `Moost`. DI, interceptors, pipes are shared across all adapters. A single controller can expose `@Get`, `@Cli`, `@Message` methods simultaneously; each adapter binds only its own handler type.

Powered by: `@prostojs/mate` (metadata), `@prostojs/infact` (DI), `@wooksjs/event-core` (async event context), `@prostojs/dye` (compile-time terminal colors).

## Domain map — load only what you need

| Domain | File | Load when |
|---|---|---|
| Core concepts, Moost class, lifecycle, registration, app init | [core.md](references/core.md) | New project, multi-adapter setup, `app.init()`, `@MoostInit`/`@InjectMoost`, boot-time setup, Moost subclass |
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
| Vite plugin: dev/build, middleware, SSR/SPA, deploy | [vite.md](references/vite.md) | `moostVite`, `vite.config.ts`, `createSSRServer`, `ssrEntry`/`serverEntry`, `ssr.noExternal`, `dist/server`, HMR, "undefined `useRequest()` in prod" |
| Swagger/OpenAPI | [swagger.md](references/swagger.md) | SwaggerController, Swagger* decorators, OpenAPI spec generation, spec.json/UI serving, securitySchemes |
| OpenTelemetry | [otel.md](references/otel.md) | `enableOtelForMoost`, spans/tracing, `@OtelIgnoreSpan`/`@OtelIgnoreMeter`, span processors, `useOtelContext`/`useSpan`/`withSpan`, `moost.event.duration` metrics |
| RBAC/ABAC access control | `@aooth/arbac-moost` ([aooth docs](https://aooth.moost.org)) | auth, roles/scopes, authorize guards — NOT part of this repo; `@moostjs/arbac` is deprecated, superseded by aooth |

## Scaffold

```bash
npm create moost@latest [name] -- [--http|--cli|--ws|--ssr] [--wf] [--oxc] [--force]
```

Pass at most ONE project-type flag (`--http --ws` is the exception: HTTP app + WebSocket add-on). Flags pre-select add-ons and skip the corresponding interactive toggles. Details: [core.md](references/core.md#scaffold).

## Quick start

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'

const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
app.registerControllers(AppController)
await app.init()
```

Other entry points:
- CLI: `new CliApp().controllers(AppController).useHelp({ name: 'my-cli' }).start()` — sugar over Moost + MoostCli ([event-cli.md](references/event-cli.md))
- Standalone WS: `await new WsApp().controllers(ChatController).start(3000)` ([event-ws.md](references/event-ws.md))
- Multi-adapter sharing one HTTP server: capture the adapter first — `const http = app.adapter(new MoostHttp())`, then `http.listen(3000)` and `app.adapter(new MoostWs({ httpApp: http.getHttpApp() }))` ([event-ws.md](references/event-ws.md))
- A `Moost` subclass is itself a controller — decorate its methods directly ([core.md](references/core.md#patterns))

## Cross-cutting facts

**DI scopes** — `@Injectable()` / `@Injectable(true)` / `@Injectable('SINGLETON')` = one instance for app lifetime. `@Injectable('FOR_EVENT')` = fresh instance per event. `@Controller()` implicitly sets `@Injectable(true)` (SINGLETON). Use `'FOR_EVENT'` when class properties hold per-request state or when using property-level ref/resolver decorators. FOR_EVENT requires an active event context (composables don't work in SINGLETON constructors).

**Wooks composables work inside handlers** — All `@wooksjs/*` composables (e.g., `useRequest`, `useResponse`, `useHeaders`) work directly in Moost handlers; they run in the same event context.

**Logging** — composable: `useLogger('topic')` (from `moost`, re-exported from `@wooksjs/event-core`). Property: `@InjectEventLogger()` (per-event) / `@InjectMoostLogger('topic')` (app-level, falls back to `@LoggerTopic`, then class `@Id`). Standalone: `createLogger({ transports: [loggerConsoleTransport] })` — `loggerConsoleTransport` is an already-constructed transport constant; pass it, don't call it.

**Re-exports** — `moost` re-exports `current`, `useLogger`, `key`, `cached`, `eventTypeKey`, `createEventContext`, `run` from `@wooksjs/event-core`, plus `createProvideRegistry`/`createReplaceRegistry` from `@prostojs/infact`. `moost` also exports its own `globalKey(name)` — a duplication-safe context-key factory (interns the slot by name via `globalThis`); use it instead of `key` for any moost-owned context key so set/get can't desync when moost is loaded more than once (dual ESM/CJS, or a duplicated install). `@moostjs/event-http` re-exports `httpKind`, `HttpError`, `useHttpContext`. `@moostjs/event-cli` re-exports `cliKind`, and `Param`/`Controller`/`Intercept`/`Description`/`Optional`/`defineBeforeInterceptor`/`defineAfterInterceptor`/`defineInterceptor` from `moost` (note: `defineErrorInterceptor` is NOT re-exported — import from `moost`). `@moostjs/event-wf` re-exports `wfKind`, `useWfState`, `StepRetriableError`, outlet primitives. `@moostjs/event-ws` re-exports `wsConnectionKind`/`wsMessageKind`, `WsError`, all `useWs*` composables, `currentConnection`, `prepareTestWs*`.

## Architecture pointers

- **Decorator system** — all decorators go through `getMoostMate()` (singleton `Mate`, `'moost'` workspace); metadata read at bind time: [decorators.md](references/decorators.md)
- **Interceptor priorities & phases** — [interceptors.md](references/interceptors.md#priority)
- **Pipe priority order & scope levels** — [pipes.md](references/pipes.md#pipeline-order)
- **Event handler lifecycle** (`defineMoostEventHandler`) — [custom-adapters.md](references/custom-adapters.md#definemoosteventhandler)
- **Adapter pattern** — each adapter implements `TMoostAdapter<H>`, attached via `app.adapter(a)`, filters `opts.handlers` by its own `handler.type`: [custom-adapters.md](references/custom-adapters.md)
