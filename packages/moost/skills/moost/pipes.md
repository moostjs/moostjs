# Pipes & Resolvers — moost

> Pipe pipeline for argument resolution, `@Pipe`, `@Resolve`, validation/transformation stages, and the argument resolution lifecycle.

## Concepts

Pipes process method arguments before the handler executes. They run in a defined priority pipeline:

```
BEFORE_RESOLVE → RESOLVE → AFTER_RESOLVE → BEFORE_TRANSFORM → TRANSFORM → AFTER_TRANSFORM → BEFORE_VALIDATE → VALIDATE → AFTER_VALIDATE
```

Each stage can modify the argument value. The most commonly used stages:
- **RESOLVE** — Fetch the initial value (from request, context, DI, etc.)
- **TRANSFORM** — Convert types, parse data
- **VALIDATE** — Check constraints, throw on invalid data

### Pipe Scope

Pipes can be registered at three levels:
1. **Global** — `app.pipe(myPipe)` — applies to all handlers
2. **Class** — `@Pipe(myPipe)` on controller class — applies to all methods
3. **Method/Parameter** — `@Pipe(myPipe)` on method or parameter — applies to that specific target

Pipes are merged and sorted by priority across all levels.

## API Reference

### `@Resolve(fn, name?)`

The most common pipe — resolves a parameter value from the event context. Used to create parameter decorators.

```ts
import { Resolve } from 'moost'

// Simple resolver
function MyParam() {
  return Resolve(() => useMyContext().value, 'my-param')
}

// Usage
@Get('test')
handler(@MyParam() value: string) { }
```

`@Resolve()` registers a pipe at the `RESOLVE` stage. The function runs inside the event context and can use any composables.

### `@Param(name?: string)`

Built-in resolver for route parameters (from Wooks router).

```ts
@Get('users/:id')
getUser(@Param('id') id: string) { }

@Get('users/:id/posts/:postId')
getPost(@Params() params: { id: string; postId: string }) { }
```

### `@Pipe(pipe)`

Registers a pipe at class, method, or parameter level.

```ts
import { Pipe } from 'moost'

// Class-level pipe
@Pipe(validationPipe)
@Controller()
class MyController { }

// Method-level pipe
@Pipe(transformPipe)
@Get('data')
getData() { }
```

### Pipe Definition (TPipeData)

```ts
interface TPipeData {
  priority: TPipePriority    // Stage in the pipeline
  pipe: TPipeFunction        // The pipe function
}

type TPipeFunction = (
  value: unknown,            // Current parameter value
  metas: TPipeMetas,         // Metadata about the parameter
  level: 'PARAM' | 'METHOD'  // Whether this is a parameter or return value pipe
) => unknown | Promise<unknown>
```

### `TPipePriority` stages

```ts
enum TPipePriority {
  BEFORE_RESOLVE = 0,
  RESOLVE = 10,
  AFTER_RESOLVE = 20,
  BEFORE_TRANSFORM = 30,
  TRANSFORM = 40,
  AFTER_TRANSFORM = 50,
  BEFORE_VALIDATE = 60,
  VALIDATE = 70,
  AFTER_VALIDATE = 80,
}
```

### `TPipeMetas` (context passed to pipe functions)

```ts
interface TPipeMetas {
  classMeta: TMoostMetadata     // Controller class metadata
  methodMeta: TMoostMetadata    // Handler method metadata
  paramMeta: TMoostParamsMetadata // Parameter metadata (type, inject, paramSource, etc.)
  type: TClassConstructor       // Controller class constructor
  key: string | symbol          // Method name
  index: number                 // Parameter index
  targetMeta: TMoostParamsMetadata
  instantiate: <T>(cls: TClassConstructor<T>) => Promise<T> | T  // DI helper
}
```

## Common Patterns

### Pattern: Custom Parameter Decorator with Resolve

```ts
import { Resolve } from 'moost'
import { useRequest } from '@wooksjs/event-http'

function ClientIp(): ParameterDecorator {
  return Resolve(() => {
    const { raw } = useRequest()
    return raw.socket.remoteAddress
  }, 'client-ip')
}
```

### Pattern: Validation Pipe

```ts
import { Pipe, TPipePriority } from 'moost'

const zodValidation: TPipeData = {
  priority: TPipePriority.VALIDATE,
  pipe(value, metas) {
    const schema = metas.paramMeta.zodSchema
    if (schema) {
      return schema.parse(value)  // Throws ZodError on invalid
    }
    return value
  },
}

@Pipe(zodValidation)
@Controller()
class ValidatedController { }
```

### Pattern: Type Transformation Pipe

```ts
const autoTransform: TPipeData = {
  priority: TPipePriority.TRANSFORM,
  pipe(value, metas) {
    const targetType = metas.paramMeta.type
    if (targetType === Number && typeof value === 'string') {
      return Number(value)
    }
    if (targetType === Boolean && typeof value === 'string') {
      return value === 'true'
    }
    return value
  },
}
```

## Integration

### With Adapters

Argument resolution is provided to adapters via `opts.resolveArgs` in `bindHandler()`. Pass it through to `defineMoostEventHandler()` — pipes run automatically during the "Arguments:resolve" phase of the handler lifecycle.

### With the Handler Lifecycle

```
defineMoostEventHandler execution:
  1. Scope + logger setup
  2. Controller instance resolution
  3. Interceptor before phase
  4. ──► Argument resolution (pipes run here) ◄──
  5. Handler method execution with resolved args
  6. Interceptor after phase
  7. Cleanup
```

If argument resolution throws (e.g., validation failure), the handler is skipped and the error flows to interceptor error handlers.

## Best Practices

- Use `@Resolve()` for parameter injection — it's the standard pattern across all adapters
- Register validation pipes at class level to apply consistently
- Keep pipe functions pure — avoid side effects during argument resolution
- Use `TPipePriority.VALIDATE` for validation and `TPipePriority.TRANSFORM` for type coercion
- The `instantiate` helper in `TPipeMetas` resolves classes via DI — use it for pipe dependencies

## Gotchas

- Pipes run in strict priority order — if two pipes have the same priority, class-level runs before method-level, which runs before parameter-level
- `@Resolve()` replaces the parameter value entirely — the initial value is `undefined` before the RESOLVE stage
- Async pipes are supported — if any pipe returns a Promise, the entire argument array is awaited via `Promise.all()`
- The `paramMeta.type` field comes from TypeScript's `emitDecoratorMetadata` — it's the design-time type, not a runtime validator
