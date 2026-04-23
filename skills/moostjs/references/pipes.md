# Pipes & Resolvers — moost

Pipes transform/resolve/validate each parameter and property during argument resolution. Pure by convention. Each pipe: `(value, metas, level) => newValue | Promise<newValue>`.

- [Pipeline order](#pipeline-order)
- [Scope levels](#scope-levels)
- [@Resolve, @Pipe](#resolve-pipe)
- [Built-in param decorators](#built-in-param-decorators)
- [TPipeFn & TPipeMetas](#tpipefn--tpipemetas)
- [Patterns](#patterns)
- [Gotchas](#gotchas)

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

## Built-in param decorators (in `moost`)

| Decorator | Returns | paramSource |
|---|---|---|
| `@Param(name)` | route param | `'ROUTE'` |
| `@Params()` | all route params | `'ROUTE'` |
| `@Const(value, label?)` | a constant | `'CONST'` |
| `@ConstFactory(fn, label?)` | factory result (sync/async) | `'CONST'` |

HTTP/CLI/WS/WF packages add adapter-specific ones (`@Body`, `@Query`, `@CliOption`, `@MessageData`, `@WorkflowParam`, …).

## TPipeFn & TPipeMetas

```ts
interface TPipeFn<T = {}> {
  (value: unknown, metas: TPipeMetas<T>, level: TDecoratorLevel): unknown | Promise<unknown>
  priority?: TPipePriority
}

interface TPipeMetas<T = {}> {
  classMeta?: TMoostMetadata & T
  methodMeta?: TMoostMetadata & T
  propMeta?: TMoostMetadata & T
  paramMeta?: TMoostParamsMetadata & T
  targetMeta?: TMoostParamsMetadata & T   // the resolve target
  instance?: TObject                       // controller (undefined during ctor param resolution)
  scopeId?: string | symbol
  type: TFunction                          // class constructor
  index?: number
  key: string | symbol                     // method or property name
  instantiate: <X>(c: Ctor<X>) => Promise<X>  // DI instantiation inside pipes
}
```

`level` = `'PARAM' | 'PROP' | 'CLASS' | 'METHOD'`.

### `definePipeFn(fn, priority?)` — helper

```ts
const uppercase = definePipeFn((v) => typeof v === 'string' ? v.toUpperCase() : v,
                                TPipePriority.TRANSFORM)
```

## Patterns

### Validation pipe

```ts
const zodValidate = definePipeFn((value, metas) => {
  const schema = metas.paramMeta?.validationSchema
  if (!schema) return value
  const r = schema.safeParse(value)
  if (!r.success) throw new HttpError(400, r.error.message)
  return r.data
}, TPipePriority.VALIDATE)
app.applyGlobalPipes(zodValidate)
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
- `metas.instance` is `undefined` while resolving constructor params (instance doesn't exist yet).
- Pipe errors during arg resolution are caught by the event handler lifecycle and routed to `onError` interceptors.
- Global pipes run across all adapters — filter by `metas.classMeta?.handlers` if adapter-specific.
- `RESOLVE` priority is reserved for the built-in resolve pipe; custom resolvers go through `@Resolve()`.
