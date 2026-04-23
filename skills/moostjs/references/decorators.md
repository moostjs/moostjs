# Decorators & Metadata — moost

Decorators run through `getMoostMate()` — singleton `Mate` in the `'moost'` workspace. Metadata attaches to classes/methods/props/params; read at bind time.

- [Common decorators](#common-decorators)
- [TMoostMetadata](#tmoostmetadata)
- [TMoostHandler](#tmoosthandler)
- [Custom decorators](#custom-decorators)
- [Gotchas](#gotchas)

## Common decorators

| Decorator | Target | Metadata written |
|---|---|---|
| `@Controller(prefix?)` | class | `controller: { prefix }`; auto-adds `injectable: true` |
| `@ImportController(ctrl?, provide?)` / `(prefix, ctrl)` | class | `importController[]` |
| `@Injectable(scope?)` | class | `injectable: true \| 'SINGLETON' \| 'FOR_EVENT'` (default `true` = SINGLETON) |
| `@Inherit()` | class / method / prop | `inherit: true` — enable metadata inheritance from parent class |
| `@Description(str)` | any | `description` |
| `@Label(str)` | any | `label` |
| `@Value(v)` | any | `value` |
| `@Id(str)` | any | `id` |
| `@Optional()` | param / prop | `optional: true` |
| `@Required()` | param / prop | `required: true`; also appends to class `requiredProps` |
| `ApplyDecorators(...ds)` | any | composition helper (wraps `mate.apply`) |

## TMoostMetadata

```ts
interface TMoostMetadata<H = {}> {
  // identity
  id?: string; label?: string; description?: string
  value?: unknown; optional?: boolean; required?: boolean
  requiredProps?: (string | symbol)[]
  // controller
  controller?: { prefix?: string }
  importController?: { prefix?: string; typeResolver?: Ctor | (() => Ctor); provide?: TProvideRegistry }[]
  // DI
  injectable?: true | 'FOR_EVENT' | 'SINGLETON'
  provide?: TProvideRegistry
  replace?: TReplaceRegistry
  inject?: string | symbol | TClassConstructor  // (on params)
  fromScope?: string | symbol                    // (on params)
  circular?: () => unknown                       // (on params)
  // handlers
  handlers?: TMoostHandler<H>[]
  // interceptors / pipes
  interceptor?: { priority: TInterceptorPriority }  // set by @Interceptor class
  interceptorHook?: 'before' | 'after' | 'error'    // set by @Before/@After/@OnError
  interceptors?: TInterceptorData[]
  pipes?: TPipeData[]
  // resolution
  resolver?: (metas, level) => unknown
  paramSource?: string; paramName?: string
  type?: TFunction; returnType?: TFunction
  // misc
  inherit?: boolean
  properties?: (string | symbol)[]       // collected by Mate `collectPropKeys`
  loggerTopic?: string
  params: (TMateParamMeta & TMoostParamsMetadata)[]
}
```

`getMoostMate()` is typed with class/prop/param extensions:
```ts
const mate = getMoostMate<ClassExt, PropExt, ParamExt>()
```

## TMoostHandler

```ts
type TMoostHandler<T> = { type: string; path?: string } & T
```
Adapter-specific shapes:
- HTTP: `{ type: 'HTTP', method, path }`
- CLI:  `{ type: 'CLI', path }`
- WF:   `{ type: 'WF_STEP' | 'WF_FLOW', path }`
- WS:   `{ type: 'WS_MESSAGE' | 'WS_CONNECT' | 'WS_DISCONNECT', event?, path? }`

## Custom decorators

### Functional (via `getMoostMate()`)

```ts
// scalar write
mate.decorate('field', value)
// push to array
mate.decorate('handlers', entry, true)
// functional — receive/return meta
mate.decorate((meta, level, key, index) => { meta.custom = 'x'; return meta })
// compose
mate.apply(d1, d2, d3)
// read
mate.read(ClassOrInstance)
mate.read(ClassOrInstance, 'methodName')
```

### Handler decorator (push to `handlers`)

```ts
function MyEvent(path?: string): MethodDecorator {
  return getMoostMate().decorate('handlers', { type: 'MY_EVENT', path: path ?? '' }, true)
}
```

### Parameter resolver

```ts
function CurrentUser(): ParameterDecorator & PropertyDecorator {
  return Resolve(() => decodeToken(useHeaders().authorization), 'currentUser')
}
```

Resolver runs at `RESOLVE` priority via the built-in resolve pipe; it receives `(metas, level)` where `level` is `'PARAM' | 'PROP' | 'CLASS' | 'METHOD'`.

### Custom metadata extension

For adapter-specific metadata that doesn't belong in `TMoostMetadata`, use a separate Mate workspace:

```ts
import { Mate } from '@prostojs/mate'
const myMate = new Mate<TMyAdapterMeta, TMyAdapterMeta>('my-adapter')
```

### Inheritance

Default is opt-in: `@Inherit()` on class enables for all members; on method/prop enables just that one.

```ts
@Inherit()
class Base { @Get('health') health() { return 'ok' } }
class App extends Base {}  // inherits @Get('health')
```

## Gotchas

- `getMoostMate()` is a singleton — all decorators share one workspace.
- `mate.read()` returns `undefined` if no metadata has been written.
- `params` array is sparse: index = parameter position.
- Mate is configured with `readType: true` (captures TS design-time types via `emitDecoratorMetadata`) and `collectPropKeys: true` (aggregates decorated property keys into `meta.properties`).
- For array fields (`handlers`, `interceptors`, `pipes`) pass `true` as the third `decorate()` arg to append; otherwise you overwrite.
