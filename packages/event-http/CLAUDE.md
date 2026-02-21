# CLAUDE.md — @moostjs/event-http

## Overview

HTTP adapter for Moost. Bridges Moost's decorator-driven controller system with the Wooks HTTP framework (`@wooksjs/event-http`). Provides HTTP method decorators, request resolver decorators, response-setting decorators, and body limit controls.

## Key Files

- `src/event-http.ts` — `MoostHttp` class implementing `TMoostAdapter<THttpHandlerMeta>`
- `src/decorators/http-method.decorator.ts` — `Get`, `Post`, `Put`, `Delete`, `Patch`, `All`, `HttpMethod`
- `src/decorators/resolve.decorator.ts` — `Body`, `Query`, `Header`, `Cookie`, `Url`, `Method`, `Req`, `Res`, `Authorization`, `StatusHook`, `HeaderHook`, `CookieHook`, etc.
- `src/decorators/set.decorator.ts` — `SetHeader`, `SetCookie`, `SetStatus` (interceptor-based)
- `src/decorators/limits.decorator.ts` — `BodySizeLimit`, `CompressedBodySizeLimit`, `BodyReadTimeoutMs`

## Architecture

```
Moost App → MoostHttp (adapter) → WooksHttp (@wooksjs/event-http) → Node.js http.Server
```

`MoostHttp` wraps a `WooksHttp` instance. On `bindHandler()`, it registers routes via `this.httpApp.on(method, path, handler)`. It provides `WooksHttp`, `HttpServer`, and `HttpsServer` to DI via `getProvideRegistry()`.

## Non-Obvious Patterns

**Manual unscope tied to request lifecycle.** `bindHandler` sets `manualUnscope: true` and hooks `unscope` to the raw request's `'end'` event. The DI scope stays alive for the entire request duration, including streaming.

**Double-slash trailing-slash convention.** A route ending with `//` (e.g., `@Get('api//')`) forces a trailing `/` in the URL pattern.

**Hook decorators work as both param and prop decorators.** `StatusHook`, `HeaderHook`, `CookieHook` check the `level` argument. As param decorators, they return the hook object. As property decorators, they use `attachHook` to proxy the class property to the response state (e.g., `this.status = 201` sets the HTTP status).

**`onNotFound` runs through the interceptor chain.** The 404 handler uses `defineMoostEventHandler` with global interceptors, so CORS, logging, etc. still execute for unmatched routes.

**`Body()` and `Query()` set `paramSource` metadata** (`'BODY'`, `'QUERY'`, `'QUERY_ITEM'`). This is consumed by Moost's validation pipe system and by `@moostjs/swagger` for OpenAPI spec generation.

**Path builders for URL generation.** `MoostHttp` stores `pathBuilders` keyed by handler ID (from `@Id()` or method name), enabling programmatic URL construction with parameter substitution.

**`Query()` with no argument returns `undefined` when empty** (not `{}`), making it safe for optional parameter typing.

**`HEAD` and `OPTIONS` have no convenience wrappers.** Use `HttpMethod('HEAD')` or `HttpMethod('OPTIONS')` directly.
