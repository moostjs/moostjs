# Pipes & Resolvers — moost

Pipes transform/resolve/validate each parameter and property during argument resolution. Pure by convention. Each pipe: `(value, metas, level) => newValue | Promise<newValue>`.

- [Pipeline order](#pipeline-order)
- [Scope levels](#scope-levels)
- [@Resolve, @Pipe](#resolve-pipe)
- [Built-in param decorators](#built-in-param-decorators)
- [TPipeFn & TPipeMetas](#tpipefn--tpipemetas)
- [Patterns](#patterns)
- [Integration](#integration)
- [Gotchas](#gotchas)
- [Key imports](#key-imports)
- [See also](#see-also)

## Pipeline order

`TPipePriority`: `BEFORE_RESOLVE`(0) < `RESOLVE`(1) < `AFTER_RESOLVE`(2) < `BEFORE_TRANSFORM`(3) < `TRANSFORM`(4) < `AFTER_TRANSFORM`(5) < `BEFORE_VALIDATE`(6) < `VALIDATE`(7) < `AFTER_VALIDATE`(8).

The built-in `resolvePipe` runs at `RESOLVE` and invokes the `resolver` function stored in param metadata by `@Param`/`@Body`/`@Query`/`@Resolve`/etc. Without it, those decorators return `undefined`.

## Scope levels

From broadest to narrowest — all merged and sorted by priority:

1. Global — `app.applyGlobalPipes(pipe)`
2. Class  — `@Pipe(fn)` on class
3. Method — `@Pipe(fn)` on method
4. Param  — `@Pipe(fn)` on parameter

## @Resolve, @Pipe

### `@Resolve(resolver, label?)` — param/prop decorator

Registers a resolver invoked by the built-in resolve pipe.

```ts
function CurrentUser(): ParameterDecorator & PropertyDecorator {
  return Resolve(() => decodeToken(useHeaders().authorization), 'currentUser')
}
```

### `@Pipe(handler, priority?)` — class / method / param

Attach a pipe at any scope. Priority defaults to `TRANSFORM` for bare functions.

```ts
@Pipe(myValidationPipe, TPipePriority.VALIDATE)
@Controller('api')
class ApiController {
  @Pipe(myTransformPipe)
  @Get('data')
  getData(@Pipe(trimPipe) @Param('q') query: string) {}
}
```

## Built-in param decorators

| Decorator | Returns | paramSource |
|---|---|---|
| `@Param(name)` | route param | `'ROUTE'` |
| `@Params()` | all route params | (none) |
| `@Const(value, label?)` | a constant | (none) |
| `@ConstFactory(fn, label?)` | factory result (sync/async) | (none) |

All from `moost`. Only `@Param` sets `paramSource` (`'ROUTE'`); the others are plain `Resolve(...)` wrappers with no `paramSource`. The only `paramSource` values set anywhere are `'ROUTE'`, `'QUERY'`, `'QUERY_ITEM'`, `'BODY'` (the latter three by HTTP decorators).

HTTP/CLI/WS/WF packages add adapter-specific ones (`@Body`, `@Query`, `@CliOption`, `@MessageData`, `@WorkflowParam`, …).

## TPipeFn & TPipeMetas

`import type { TPipeFn, TPipeMetas, TPipeData } from 'moost'`. A pipe is `(value, metas, level) => newValue | Promise<newValue>` with an optional `priority` field (stamp it via `definePipeFn`). `level` is `'PARAM' | 'PROP' | 'CLASS' | 'METHOD'`.

What to read from `metas`, by resolution context:

| Field | Handler method params | Constructor params | Properties |
|---|---|---|---|
| `targetMeta` | the param's meta (same object as `paramMeta`) | the param's meta | the prop's meta (same as `propMeta`) |
| `paramMeta` / `propMeta` | `paramMeta` set | `paramMeta` set | `propMeta` set |
| `classMeta` / `methodMeta` | both set | `classMeta` only (`key` = `'constructor'`) | `classMeta` set |
| `instance` | **undefined** | **undefined** | set (the instance under construction) |
| `scopeId` | undefined | set when scoped | set when scoped |
| `type` / `key` / `index` | controller class / method name / param index | class / `'constructor'` / index | class / prop name / — |
| `instantiate(Class)` | DI instantiation inside pipes — always available | available | available |

To reach the controller instance from a handler-param pipe, use `useControllerContext().getController()` — `metas.instance` is only populated during property resolution.

### `definePipeFn(fn, priority?)` — helper

```ts
const uppercase = definePipeFn((v) => typeof v === 'string' ? v.toUpperCase() : v,
                                TPipePriority.TRANSFORM)
```

## Patterns

### Validation pipe

`validationSchema` is NOT built-in metadata — store it with a custom decorator and type the pipe with a matching meta extension:

```ts
import type { ZodType } from 'zod'
import { getMoostMate, definePipeFn, TPipePriority } from 'moost'
import { HttpError } from '@moostjs/event-http'

// custom param decorator writing the schema into metadata
const Validate = (schema: ZodType) =>
  getMoostMate<{}, {}, { validationSchema?: ZodType }>().decorate('validationSchema', schema)

const zodValidate = definePipeFn<{ validationSchema?: ZodType }>((value, metas) => {
  const schema = metas.targetMeta?.validationSchema
  if (!schema) return value
  const r = schema.safeParse(value)
  if (!r.success) throw new HttpError(400, r.error.message)
  return r.data
}, TPipePriority.VALIDATE)
app.applyGlobalPipes(zodValidate)

// usage: handler(@Validate(userSchema) @Body() body: unknown)
```

### Type coercion

```ts
const coerce = definePipeFn((value, metas) => {
  if (value == null) return value
  const t = metas.targetMeta?.type
  if (t === Number)  return Number(value)
  if (t === Boolean) return value === 'true' || value === '1'
  return value
}, TPipePriority.TRANSFORM)
```

### Pipe with DI

```ts
const resolveUser = definePipeFn(async (value, metas) => {
  const auth = await metas.instantiate(AuthService)
  return auth.resolveUser(value)
}, TPipePriority.AFTER_RESOLVE)
```

## Integration

```
Interceptor before → arg resolution (pipes here) → handler → interceptor after
```

Pipes also run during DI construction (Infact `resolveParam`/`resolveProp` hooks) — same pipeline.

## Gotchas

- Declaration order within the same priority is preserved after the priority sort.
- The built-in resolve pipe calls `metas.targetMeta.resolver()`; removing it breaks `@Param`/`@Body`/etc.
- Any async pipe makes the whole arg resolution async.
- `metas.instance` is set ONLY during property resolution — it is `undefined` for constructor params AND handler method params. Use `useControllerContext().getController()` inside a pipe to reach the controller.
- Pipe errors during arg resolution are caught by the event handler lifecycle and routed to `onError` interceptors.
- Global pipes run across all adapters — filter by `metas.methodMeta?.handlers` (e.g. `metas.methodMeta?.handlers?.some(h => h.type === 'HTTP')`) if adapter-specific. `classMeta` never carries `handlers`.
- `RESOLVE` priority is reserved for the built-in resolve pipe; custom resolvers go through `@Resolve()`.

## Key imports

```ts
import { Pipe, Resolve, Param, Params, Const, ConstFactory,
         definePipeFn, TPipePriority, getMoostMate, useControllerContext } from 'moost'
import type { TPipeFn, TPipeMetas, TPipeData } from 'moost'
import { HttpError } from '@moostjs/event-http'   // for validation errors over HTTP
```

## See also

- [interceptors.md](interceptors.md) — pipes run between interceptor `before` and the handler; pipe errors route to `onError`
- [di.md](di.md) — the same pipeline resolves constructor params and injected properties
- [http-request.md](http-request.md) — HTTP param decorators (`@Body`, `@Query`, …) built on `@Resolve`
- [http-response.md](http-response.md) — `HttpError` semantics
