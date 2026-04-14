# Pipes & Resolvers — moost

> Pipeline stages, pipe scope levels, parameter decorators, resolver functions, validation/transformation pipes, and integration with the handler lifecycle.

## Concepts

Pipes transform, resolve, and validate values during argument and property resolution. They run in a defined priority order and can be scoped at multiple levels.

The pipe pipeline processes each parameter/property independently. Each pipe function receives the current value, metadata context, and decorator level, and returns the (possibly transformed) value.

### Pipeline Stages

Pipes execute in priority order (lower values first):

| Stage              | Value | Purpose                                    |
| ------------------ | ----- | ------------------------------------------ |
| `BEFORE_RESOLVE`   | 0     | Pre-processing before value resolution     |
| `RESOLVE`          | 1     | Resolve the value (built-in resolve pipe)  |
| `AFTER_RESOLVE`    | 2     | Post-processing after resolution           |
| `BEFORE_TRANSFORM` | 3     | Pre-processing before transformation       |
| `TRANSFORM`        | 4     | Type coercion and data transformation      |
| `AFTER_TRANSFORM`  | 5     | Post-processing after transformation       |
| `BEFORE_VALIDATE`  | 6     | Pre-processing before validation           |
| `VALIDATE`         | 7     | Validation (throw on invalid)              |
| `AFTER_VALIDATE`   | 8     | Post-processing after validation           |

The built-in `resolvePipe` runs at `RESOLVE` priority and invokes the `resolver` function stored in parameter metadata by decorators like `@Param()`, `@Resolve()`, `@Body()`, etc.

### Pipe Scope Levels

Pipes can be applied at four levels, from broadest to narrowest:

1. **Global** — `app.applyGlobalPipes(pipe)` — applies to all parameters everywhere
2. **Class** — `@Pipe(fn)` on class — applies to all methods in the controller
3. **Method** — `@Pipe(fn)` on method — applies to all parameters of that method
4. **Parameter** — `@Pipe(fn)` on parameter — applies to that parameter only

Pipes from all levels are merged and sorted by priority before execution.

## API Reference

### @Resolve(resolver, label?)

Create a parameter/property decorator that registers a resolver function. The resolver runs at `RESOLVE` priority via the built-in resolve pipe.

```ts
import { Resolve } from 'moost'

function CurrentUser(): ParameterDecorator & PropertyDecorator {
  return Resolve(() => {
    const { authorization } = useHeaders()
    return decodeToken(authorization)
  }, 'currentUser')
}

class MyController {
  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return user
  }
}
```

The resolver function signature:

```ts
(metas: TPipeMetas, level: TDecoratorLevel) => unknown
```

### @Param(name)

Resolve a route parameter by name. Sets `paramSource: 'ROUTE'` and `paramName` in metadata.

```ts
@Get('users/:id')
getUser(@Param('id') id: string) { /* ... */ }
```

### @Params()

Resolve all route parameters as an object.

```ts
@Get('users/:id/posts/:postId')
getPost(@Params() params: { id: string, postId: string }) { /* ... */ }
```

### @Const(value, label?)

Provide a constant value as a parameter.

```ts
@Get('admin')
admin(@Const('admin') role: string) { /* ... */ }
```

### @ConstFactory(factory, label?)

Provide a value from a factory function (can be async).

```ts
@Get('config')
getConfig(@ConstFactory(() => loadConfig()) config: Config) { /* ... */ }
```

### @Pipe(handler, priority?)

Attach a pipe to a class, method, or parameter.

```ts
import { Pipe, TPipePriority } from 'moost'

@Pipe(myValidationPipe, TPipePriority.VALIDATE)
@Controller('api')
class ApiController {
  @Pipe(myTransformPipe)
  @Get('data')
  getData(@Pipe(trimPipe) @Param('q') query: string) { /* ... */ }
}
```

### TPipeFn\<T\>

The pipe function signature:

```ts
interface TPipeFn<T = {}> {
  (value: unknown, metas: TPipeMetas<T>, level: TDecoratorLevel): unknown | Promise<unknown>
  priority?: TPipePriority
}
```

Parameters:
- `value` — Current value (undefined initially, then the result of previous pipes)
- `metas` — Full metadata context (see TPipeMetas below)
- `level` — Where the pipe is running: `'PARAM'`, `'PROP'`, `'CLASS'`, or `'METHOD'`

Return the transformed value, or the original value to pass through.

### TPipeMetas\<T\>

Metadata context available to pipe functions:

```ts
interface TPipeMetas<T = {}> {
  classMeta?: TMoostMetadata & T    // class-level metadata
  methodMeta?: TMoostMetadata & T   // method-level metadata
  propMeta?: TMoostMetadata & T     // property-level metadata
  paramMeta?: TMoostParamsMetadata & T  // parameter-level metadata
  targetMeta?: TMoostParamsMetadata & T // the target being resolved
  instance?: TObject                // controller instance (when available)
  scopeId?: string | symbol         // DI scope ID
  type: TFunction                   // class constructor
  index?: number                    // parameter index
  key: string | symbol              // method or property name
  instantiate: <T>(t: TClassConstructor<T>) => Promise<T>  // DI instantiation
}
```

### TPipePriority

Enum defining pipe execution order:

```ts
enum TPipePriority {
  BEFORE_RESOLVE,   // 0
  RESOLVE,          // 1
  AFTER_RESOLVE,    // 2
  BEFORE_TRANSFORM, // 3
  TRANSFORM,        // 4
  AFTER_TRANSFORM,  // 5
  BEFORE_VALIDATE,  // 6
  VALIDATE,         // 7
  AFTER_VALIDATE,   // 8
}
```

### definePipeFn(fn, priority?)

Helper to create a pipe function with an attached priority:

```ts
import { definePipeFn, TPipePriority } from 'moost'

const uppercasePipe = definePipeFn((value) => {
  return typeof value === 'string' ? value.toUpperCase() : value
}, TPipePriority.TRANSFORM)
```

## Common Patterns

### Custom Parameter Decorator

Combine `@Resolve` with adapter-specific composables:

```ts
import { Resolve } from 'moost'
import { useRequest } from '@wooksjs/event-http'

function IpAddress(): ParameterDecorator & PropertyDecorator {
  return Resolve(() => {
    const { raw } = useRequest()
    return raw.headers['x-forwarded-for'] || raw.socket.remoteAddress
  }, 'ip')
}
```

### Validation Pipe

Create a pipe that validates values at the VALIDATE stage:

```ts
const zodValidationPipe = definePipeFn((value, metas) => {
  const schema = metas.paramMeta?.validationSchema
  if (schema) {
    const result = schema.safeParse(value)
    if (!result.success) {
      throw new HttpError(400, result.error.message)
    }
    return result.data
  }
  return value
}, TPipePriority.VALIDATE)

app.applyGlobalPipes(zodValidationPipe)
```

### Type Transformation Pipe

Transform string parameters to their declared types:

```ts
const typeCoercionPipe = definePipeFn((value, metas) => {
  if (value === undefined || value === null) return value
  const type = metas.targetMeta?.type
  if (type === Number) return Number(value)
  if (type === Boolean) return value === 'true' || value === '1'
  return value
}, TPipePriority.TRANSFORM)
```

### Pipe with DI

Use the `instantiate` function from metas to resolve services within a pipe:

```ts
const authPipe = definePipeFn(async (value, metas) => {
  const authService = await metas.instantiate(AuthService)
  return authService.resolveUser(value)
}, TPipePriority.AFTER_RESOLVE)
```

### Parameter-Scoped Pipe

Apply a pipe only to a specific parameter:

```ts
@Get('search')
search(
  @Pipe(trimPipe) @Pipe(lowercasePipe) @Param('q') query: string,
  @Param('page') page: number,
) { /* only query gets trimmed and lowercased */ }
```

## Integration with Handler Lifecycle

The pipe pipeline runs during argument resolution, which happens after interceptor `before` phase and before handler execution:

```
Interceptor before → Argument resolution (pipes run here) → Handler → Interceptor after
```

For DI constructor parameters and properties, pipes also run during instantiation via Infact's `resolveParam` and `resolveProp` hooks.

## Best Practices

- Use `RESOLVE` priority only for the built-in resolve pipe — custom resolvers use `@Resolve()`
- Use `TRANSFORM` for type coercion and data mapping
- Use `VALIDATE` for validation — throw errors to reject invalid input
- Apply validation/transform pipes globally for consistent behavior
- Keep pipe functions pure when possible — avoid side effects
- Use `metas.targetMeta?.type` to access the TypeScript design-time type
- Return `value` unchanged when the pipe does not apply to the current parameter

## Gotchas

- Pipes are sorted by priority at merge time — declaration order within the same priority is preserved
- The built-in resolve pipe calls `metas.targetMeta.resolver()` — without it, `@Param()`, `@Body()`, etc. return `undefined`
- Pipes run for both method parameters and DI constructor parameters/properties
- Async pipes (returning `Promise`) cause the entire argument resolution to become async
- `metas.instance` may be `undefined` during constructor parameter resolution (the instance does not exist yet)
- The `level` parameter indicates context: `'PARAM'` for method/constructor parameters, `'PROP'` for class properties
- Pipe errors during argument resolution are caught by the event handler lifecycle and routed to `onError` interceptors
- Global pipes are shared across all adapters — filter by `metas.classMeta?.handlers` if needed
