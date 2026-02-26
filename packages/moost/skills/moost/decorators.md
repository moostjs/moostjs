# Decorators & Metadata — moost

> The decorator system, metadata storage via `@prostojs/mate`, handler registration, and how to create custom decorators.

## Concepts

Moost's decorator system is built on `@prostojs/mate`, a metadata management library. All decorators write to a shared metadata workspace (`'moost'`) via `getMoostMate()`. This metadata is then read during `app.init()` to bind handlers, resolve dependencies, and configure interceptors.

**Key types of decorators:**
- **Class decorators** — `@Controller()`, `@Injectable()`, `@ImportController()`
- **Method decorators** — `@Get()`, `@Cli()`, `@Intercept()`, handler registrations
- **Parameter decorators** — `@Param()`, `@Resolve()`, `@Inject()`, `@Body()`
- **Property decorators** — `@Inject()`, `@Provide()`, hooks

Metadata is stored per-class and per-method using TypeScript's legacy experimental decorators (`experimentalDecorators: true`, `emitDecoratorMetadata: true`).

## API Reference

### `getMoostMate()`

Returns the singleton `Mate` instance for the `'moost'` metadata workspace.

```ts
import { getMoostMate } from 'moost'

const mate = getMoostMate()

// Read class metadata
const classMeta = mate.read(MyController)

// Read method metadata
const methodMeta = mate.read(MyController.prototype, 'myMethod')

// Write custom metadata via decorator
mate.decorate('myKey', myValue)           // Overwrites
mate.decorate('myArray', item, true)      // Appends to array
```

### `TMoostMetadata` (interface)

The shape of metadata stored per class/method:

```ts
interface TMoostMetadata<H = {}> {
  controller?: { prefix?: string }
  importController?: Array<{ prefix?; typeResolver?; provide? }>
  injectable?: true | 'FOR_EVENT' | 'SINGLETON'
  interceptor?: { priority: TInterceptorPriority }
  interceptors?: TInterceptorData[]
  handlers?: TMoostHandler<H>[]           // Set by adapter decorators
  pipes?: TPipeData[]
  provide?: TProvideRegistry
  replace?: TReplaceRegistry
  params: Array<TMateParamMeta & TMoostParamsMetadata>
  returnType?: Function
  loggerTopic?: string
  id?: string                             // Handler ID for path builders
  // ... and more
}
```

### `TMoostHandler<H>` (type)

```ts
type TMoostHandler<H> = {
  type: string      // Adapter type identifier ('HTTP', 'WS_MESSAGE', 'CRON', etc.)
  path?: string     // Route/command path
} & H               // Custom handler metadata fields
```

### `@Controller(prefix?: string)`

Marks a class as a controller. The prefix is prepended to all handler paths.

```ts
@Controller('api/v1')
class ApiController { }
```

### `@Injectable(scope?: 'SINGLETON' | 'FOR_EVENT')`

Marks a class for DI registration with a lifecycle scope.

```ts
@Injectable('SINGLETON')   // One instance for the app lifetime
class DbService { }

@Injectable('FOR_EVENT')   // New instance per event (request, command, etc.)
class RequestScoped { }
```

### `@Description(text: string)`

Adds a description to a class or method (used by swagger, CLI help).

```ts
@Description('User management endpoints')
@Controller('users')
class UserController {
  @Description('Get user by ID')
  @Get(':id')
  getUser() { }
}
```

## Common Patterns

### Pattern: Creating a Handler Decorator

All adapter-specific decorators follow the same pattern:

```ts
import type { TEmpty, TMoostMetadata } from 'moost'
import { getMoostMate } from 'moost'

function MyDecorator(path?: string): MethodDecorator {
  return getMoostMate<TEmpty, TMoostMetadata<{ /* extra fields */ }>>().decorate(
    'handlers',        // Always 'handlers' for handler registration
    {
      path,
      type: 'MY_TYPE', // Unique string your adapter filters by
      // ...extra fields
    },
    true,              // Array mode — accumulates multiple decorators
  )
}
```

### Pattern: Reading Metadata in an Adapter

```ts
bindHandler<T extends object>(opts: TMoostAdapterOptions<TMyMeta, T>) {
  const mate = getMoostMate()

  for (const handler of opts.handlers) {
    if (handler.type !== 'MY_TYPE') continue

    // Read additional method-level metadata
    const methodMeta = mate.read(opts.fakeInstance, opts.method as string)

    // Read class-level metadata
    const classMeta = mate.read(opts.fakeInstance)

    // Access custom metadata set by your decorators
    const myCustomData = methodMeta?.myCustomField
  }
}
```

### Pattern: Dual Parameter/Property Decorator

Some decorators work on both parameters and class properties:

```ts
function MyValue(): ParameterDecorator & PropertyDecorator {
  return Resolve(() => computeValue(), 'my-value')
}

// As parameter:
@Get('test')
handler(@MyValue() val: string) { }

// As property:
@Controller()
class MyCtrl {
  @MyValue()
  val!: string

  @Get('test')
  handler() { return this.val }
}
```

## Best Practices

- Use `getMoostMate()` (not `new Mate()`) — all Moost metadata must share the same workspace
- Handler decorators must use array mode (`true` as third arg to `decorate`) so multiple decorators can coexist
- Use distinctive `type` strings to avoid collisions between adapters
- Keep metadata types lean — store only what `bindHandler` needs

## Gotchas

- `getMoostMate().read(instance, method)` requires the **prototype** instance, not a constructed one — use `opts.fakeInstance` in adapters
- Metadata is inherited from parent classes by default for class-level metadata (when `inherit: true` is set)
- TypeScript's `emitDecoratorMetadata` must be enabled for type reflection to work (`design:type`, `design:paramtypes`, `design:returntype`)
