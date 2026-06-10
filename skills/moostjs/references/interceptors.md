# Interceptors — moost

Onion-model wrappers around handler execution. Two APIs: functional (`TInterceptorDef`) and class-based (`@Interceptor` + `@Before`/`@After`/`@OnError`).

- [Priority](#priority)
- [Phases](#phases)
- [@Intercept](#intercept)
- [Functional API](#functional-api)
- [Class-based API](#class-based-api)
- [useControllerContext](#usecontrollercontext)
- [Patterns](#patterns)
- [Gotchas](#gotchas)
- [Key imports](#key-imports)
- [See also](#see-also)

## Priority

`TInterceptorPriority`: `BEFORE_ALL`(0) < `BEFORE_GUARD`(1) < `GUARD`(2) < `AFTER_GUARD`(3) < `INTERCEPTOR`(4) < `CATCH_ERROR`(5) < `AFTER_ALL`(6).

- `before` runs lower → higher priority.
- `after` / `onError` run in LIFO (onion): inner first.

Typical use: `GUARD` for auth/authorization, `CATCH_ERROR` for error formatting, `BEFORE_ALL`/`AFTER_ALL` for telemetry.

## Phases

```
before (can reply() to short-circuit)
  → arg resolution
    → handler
  → after (can reply() to replace response) | onError (can reply() to recover)
```

If no `onError` calls `reply()`, the error is re-thrown.

## @Intercept

```ts
@Intercept(handler, priority?, name?)
```

`handler` = class constructor (class-based) or `TInterceptorDef` object. Apply to class or method. The `priority` arg **overrides** the handler's own priority.

```ts
@Intercept(AuthGuard, TInterceptorPriority.GUARD)
@Controller('api')
class ApiController {}

class UserController {
  @Intercept(rateLimiter)
  @Get('search')
  search() {}
}
```

Register globally:

```ts
app.applyGlobalInterceptors(errorHandler, authGuard, cliHelpInterceptor())
```

## Functional API

A `TInterceptorDef` (`import type { TInterceptorDef } from 'moost'`) is a plain object with up to three hooks plus an optional `priority` and `_name`. Hook signatures: `before(reply)`, `after(response, reply)`, `error(error, reply)` — each `void | Promise<void>`; `reply(value)` short-circuits or replaces the response.

### Helper factories (from `moost`)

```ts
const guard = defineBeforeInterceptor((reply) => { /* … */ }, TInterceptorPriority.GUARD)
const wrap  = defineAfterInterceptor((response, reply) => { /* … */ }, TInterceptorPriority.AFTER_ALL)
const catch_= defineErrorInterceptor((error, reply) => { /* … */ }, TInterceptorPriority.CATCH_ERROR)
const multi = defineInterceptor({ before, after }, TInterceptorPriority.INTERCEPTOR)
```

`defineInterceptor(def, priority?)` always overwrites `def.priority` with its second argument (default `INTERCEPTOR`) — set priority via the argument, not inside the def object.

## Class-based API

```ts
@Interceptor(priority?, scope?)   // scope = 'SINGLETON' | 'FOR_EVENT' (default SINGLETON)
class MyInterceptor {
  @Before()
  check(@Overtake() reply: TOvertakeFn) { /* reply(…) to short-circuit */ }

  @After()
  transform(@Response() response: unknown, @Overtake() reply: TOvertakeFn) {}

  @OnError()
  handle(@Response() error: Error, @Overtake() reply: TOvertakeFn) {}
}
```

- `@Overtake()` param decorator — injects the `reply` function.
- `@Response()` param decorator — injects the handler result (in `@After`) or the Error (in `@OnError`).
- `@Interceptor` auto-adds `@Injectable`.

Composable equivalents (what the decorators read): `useOvertake()` returns the reply fn (`TOvertakeFn`); `useInterceptResult()` returns the current handler result/error. Their `setOvertake`/`setInterceptResult` counterparts are exported for adapters that drive the interceptor chain manually — application code never calls them.

## useControllerContext

Access controller runtime inside a functional interceptor:

```ts
const { getController, getMethod, getRoute, getPrefix,
        getControllerMeta, getMethodMeta, getParamsMeta, getPropMeta,
        getPropertiesList, getScope,
        instantiate } = useControllerContext()

const meta = getMethodMeta<{ myField?: string }>()
const svc  = await instantiate(SomeService)   // DI-resolved
```

`instantiate(Class)` creates instances through the DI container respecting scopes and provide/replace registries.

## Patterns

### Auth guard

```ts
import { defineBeforeInterceptor, TInterceptorPriority } from 'moost'
import { HttpError } from '@moostjs/event-http'
import { useHeaders } from '@wooksjs/event-http' // NOT re-exported by @moostjs/event-http

const authGuard = defineBeforeInterceptor((reply) => {
  const { authorization } = useHeaders()
  if (!authorization) reply(new HttpError(401, 'Missing authorization'))
}, TInterceptorPriority.GUARD)
```

### Response wrapper

```ts
const wrap = defineAfterInterceptor((response, reply) => {
  if (!(response instanceof Error)) reply({ data: response, timestamp: Date.now() })
})
```

### Global error handler

```ts
const errorHandler = defineErrorInterceptor((error, reply) => {
  // HttpError has no public statusCode — read it via the `body` getter
  const status = error instanceof HttpError ? error.body.statusCode : 500
  reply({ error: error.message, status })
}, TInterceptorPriority.CATCH_ERROR)
app.applyGlobalInterceptors(errorHandler)
```

### Class-based with DI

```ts
@Interceptor(TInterceptorPriority.GUARD, 'FOR_EVENT')
class RoleGuard {
  constructor(private authService: AuthService) {}
  @Before()
  async check(@Overtake() reply: TOvertakeFn) {
    const user = await this.authService.getCurrentUser()
    if (!user.hasRole('admin')) reply(new HttpError(403))
  }
}
```

## Gotchas

- `@Interceptor` auto-adds `@Injectable` — don't double-decorate.
- `reply()` in `before` skips the handler entirely.
- `after` receives the raw response; `onError` receives the `Error`.
- `after` / `onError` are LIFO — the interceptor whose `before` ran last (highest priority value) runs its `after`/`onError` hook first.
- The `priority` arg on `@Intercept()` overrides the class's own priority.
- Global interceptors also run for not-found handlers via `getGlobalInterceptorHandler()`.
- Only `TInterceptorDef` objects and `@Interceptor` classes can be registered — passing a bare factory function (`() => ({ before() {} })`) throws `Invalid interceptor ... must be TInterceptorDef or @Interceptor class` at bind time. `@Interceptor` classes ARE (re)instantiated per event internally, so each event gets fresh hook bindings.

## Key imports

```ts
import { Intercept, Interceptor, Before, After, OnError, Overtake, Response,
         defineBeforeInterceptor, defineAfterInterceptor, defineErrorInterceptor,
         defineInterceptor, TInterceptorPriority, useControllerContext } from 'moost'
import type { TInterceptorDef, TOvertakeFn } from 'moost'
import { HttpError } from '@moostjs/event-http'
import { useHeaders } from '@wooksjs/event-http'
```

## See also

- [pipes.md](pipes.md) — arg resolution runs after `before`; pipe errors route to `onError`
- [di.md](di.md) — class-based interceptors resolve through DI (scope `'SINGLETON' | 'FOR_EVENT'`)
- [http-auth.md](http-auth.md) — ready-made HTTP auth guards
- [http-response.md](http-response.md) — `HttpError` semantics
