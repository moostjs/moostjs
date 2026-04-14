# Decorators & Metadata — moost

> Decorator system built on `@prostojs/mate`, metadata workspace, and patterns for creating custom decorators.

## Concepts

Moost decorators are powered by `@prostojs/mate`, a metadata library that stores decorator data in a dedicated `'moost'` workspace. All decorators go through `getMoostMate()`, which returns a singleton `Mate` instance.

Key points:
- Decorators write to a shared `TMoostMetadata` interface
- Metadata is read at init-time to wire controllers, handlers, pipes, and interceptors
- Decorators can target classes, methods, properties, and parameters
- Multiple decorators compose via `mate.apply(...decorators)` or `ApplyDecorators()`

## API Reference

### getMoostMate()

Return the shared `Mate` instance operating in the `'moost'` metadata workspace.

```ts
import { getMoostMate } from 'moost'
const mate = getMoostMate()
```

Core `Mate` methods used in decorator creation:

```ts
// Set a single metadata field
mate.decorate('fieldName', value)

// Set a metadata field and push to array (append mode)
mate.decorate('arrayField', item, true)

// Functional decorator (receives and returns metadata)
mate.decorate((meta) => {
  meta.customField = 'value'
  return meta
})

// Compose multiple decorators
mate.apply(decorator1, decorator2, decorator3)

// Read metadata from a class or method
mate.read(classOrInstance)           // class-level
mate.read(classOrInstance, 'method') // method-level
```

### TMoostMetadata Interface

The core metadata shape attached to classes, methods, and properties:

```ts
interface TMoostMetadata {
  // Identity
  id?: string
  label?: string
  description?: string
  value?: unknown
  optional?: boolean
  required?: boolean

  // Controller
  controller?: { prefix?: string }
  importController?: { prefix?: string, typeResolver?: TClassConstructor | (() => TClassConstructor) }[]

  // DI
  injectable?: true | 'FOR_EVENT' | 'SINGLETON'
  provide?: TProvideRegistry
  replace?: TReplaceRegistry

  // Handlers (set by adapter-specific decorators like @Get, @Cli)
  handlers?: TMoostHandler<H>[]

  // Interceptors and pipes
  interceptors?: TInterceptorData[]
  pipes?: TPipeData[]

  // Parameters
  params: (TMateParamMeta & TMoostParamsMetadata)[]

  // Resolution
  resolver?: (metas: TPipeMetas, level: TDecoratorLevel) => unknown
  type?: TFunction
  returnType?: TFunction

  // Misc
  inherit?: boolean
  properties?: (string | symbol)[]
  loggerTopic?: string
}
```

### TMoostHandler\<T\>

Describes a registered handler. Each adapter defines its own `T` shape:

```ts
type TMoostHandler<T> = { type: string, path?: string } & T

// HTTP adapter: { type: 'HTTP', method: 'GET', path: '/users' }
// CLI adapter:  { type: 'CLI', path: 'deploy :env' }
// WF adapter:   { type: 'WF_STEP', path: 'validate-input' }
```

### Common Decorators

#### @Controller(prefix?: string)

Mark a class as a controller. Auto-sets `@Injectable`.

#### @Injectable(scope?)

Mark a class for DI. Scope: `true` or `'SINGLETON'` (default), `'FOR_EVENT'` (per-request instance).

#### @Description(value: string)

Attach a description string. Used by CLI help, Swagger, and custom adapters.

#### @Label(value: string)

Attach a label string. Used for parameter naming and display.

#### @Id(value: string)

Attach an identifier. Used by HTTP adapter for path builders.

#### @Optional() / @Required()

Mark a parameter or property as optional/required. `@Required()` also adds to `requiredProps` on the class metadata.

#### @Value(value: unknown)

Attach an arbitrary value to metadata.

### @Inherit()

Enable metadata inheritance from parent class. When set on a class, all methods inherit parent metadata. When set on a method/property, only that member inherits.

```ts
import { Inherit } from 'moost'

@Inherit()
@Controller('api')
class BaseController {
  @Get('health')
  health() { return 'ok' }
}

class AppController extends BaseController {
  // inherits @Get('health') from BaseController
}
```

## Common Patterns

### Creating Handler Decorators

Adapter-specific decorators push to the `handlers` array:

```ts
import { getMoostMate } from 'moost'

function MyEvent(path?: string) {
  return getMoostMate().decorate('handlers', {
    type: 'MY_EVENT',
    path: path || '',
  }, true)  // true = push to array
}
```

### Reading Metadata in Adapters

Adapters read metadata during `bindHandler()` to wire routes:

```ts
bindHandler(opts) {
  const mate = getMoostMate()
  for (const handler of opts.handlers) {
    if (handler.type !== 'MY_EVENT') continue
    const methodMeta = mate.read(opts.fakeInstance, opts.method as string)
    // use methodMeta.description, methodMeta.params, etc.
  }
}
```

### Dual Param/Property Decorators

Create decorators that work on both parameters and properties:

```ts
function MyResolver(name: string): ParameterDecorator & PropertyDecorator {
  return Resolve((metas, level) => {
    // level is 'PARAM' or 'PROP'
    return fetchValue(name)
  }, name)
}
```

### Composing Multiple Decorators

Use `ApplyDecorators` or `mate.apply()` to combine decorators:

```ts
import { ApplyDecorators, Description, Label } from 'moost'

function ApiField(name: string, desc: string) {
  return ApplyDecorators(
    Label(name),
    Description(desc),
  )
}
```

### Custom Metadata Fields

Extend metadata by declaring a custom `Mate` type or using the functional decorator form:

```ts
const mate = getMoostMate<{ myCustomField?: string }>()

function MyCustom(value: string): ClassDecorator & MethodDecorator {
  return mate.decorate('myCustomField', value)
}
```

## Best Practices

- Use `mate.decorate('field', value, true)` (append mode) for array fields like `handlers`, `interceptors`, `pipes`
- Use `mate.decorate('field', value)` (overwrite mode) for scalar fields
- Always return `meta` from functional decorators
- Use `ApplyDecorators()` to compose rather than creating nested decorator calls
- Set `paramSource` and `paramName` on parameter metadata for adapter/swagger interop

## Gotchas

- `getMoostMate()` returns a singleton — all decorator reads/writes share the same metadata workspace
- `mate.read()` returns `undefined` if no metadata has been written for that target
- The `params` array on metadata is sparse — index corresponds to parameter position
- `readType: true` in the Mate config means TypeScript design-time types are captured (requires `emitDecoratorMetadata`)
- `collectPropKeys: true` means all decorated property keys are collected into `meta.properties`
- Metadata inheritance is opt-in via `@Inherit()` — it is not automatic
