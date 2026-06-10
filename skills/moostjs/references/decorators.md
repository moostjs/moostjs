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
| `@MoostInit({ priority? })` | method | `moostInit: { priority }` — run once at boot, post-bind. Semantics: [core.md](core.md#app-init-moostinit) |
| `@InjectMoost()` | param / prop | resolver returning the running `Moost` instance |
| `@HandlerPaths(method?, opts?)` | param / prop | resolver → `string[]` of a handler's mounted paths. [core.md](core.md#resolving-a-handlers-mounted-path) |
| `ApplyDecorators(...ds)` | any | composition helper (wraps `mate.apply`) |

## TMoostMetadata

`import type { TMoostMetadata, TMoostParamsMetadata, TMoostHandler } from 'moost'` — the shapes returned by `mate.read(...)`. Read fields by purpose, not by re-deriving the interface:

| Field(s) | Written by | Read where |
|---|---|---|
| `id`, `label`, `description`, `value`, `optional`, `required`, `requiredProps` | `@Id`/`@Label`/`@Description`/`@Value`/`@Optional`/`@Required` | adapters, swagger, validation tooling |
| `controller.prefix`, `importController[]` | `@Controller`/`@ImportController` | controller binding (prefix composition) |
| `injectable`, `provide`, `replace` | `@Injectable`/`@Provide`/`@Replace` | DI (Infact) |
| `handlers` (`TMoostHandler[]`) | handler decorators (`@Get`, `@Cli`, …) — METHOD meta only | adapters filter by `handler.type` |
| `interceptor`, `interceptorHook`, `interceptors` | `@Interceptor` (class), `@Before`/`@After`/`@OnError` (methods), `@Intercept` | interceptor chain assembly |
| `pipes` | `@Pipe` | pipe chain assembly |
| `resolver` | `@Resolve` and everything built on it (`@Param`, `@Body`, …) | the built-in resolve pipe |
| `type`, `returnType` | TS `emitDecoratorMetadata` (automatic) | pipes (type coercion), swagger |
| `inherit` | `@Inherit` | Mate inheritance policy |
| `properties` | Mate `collectPropKeys` (automatic) | DI property resolution |
| `loggerTopic` | `@LoggerTopic` | `@InjectMoostLogger` |
| `moostInit` | `@MoostInit` | init-hook collection |
| `params` | param decorators (sparse array, index = param position) | argument/constructor resolution |

**Param-only fields live on `TMoostParamsMetadata`**, accessed via `meta.params[index]` (NOT on class/method meta): `inject` (`@Inject`), `fromScope` (`@InjectFromScope`), `circular` (`@Circular`), `paramSource`/`paramName` (set by `@Param` to `'ROUTE'`; HTTP decorators set `'QUERY'`/`'QUERY_ITEM'`/`'BODY'`).

`getMoostMate()` is typed with class/prop/param extensions: `getMoostMate<ClassExt, PropExt, ParamExt>()`.

## TMoostHandler

One entry per handler decorator on a method: a `type` discriminator plus an optional `path`, extended with adapter-specific fields. Adapter-specific shapes:
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

Two patterns depending on whether your library's fields should be visible on the shared `TMoostMetadata`. Pick by who reads the metadata: yourself + other moost-aware tooling → augment; you alone → isolate.

**Augment the moost workspace + ship a typed wrapper (recommended).** When your decorators write metadata you'll later read — eliminates magic strings, casts, and duck-typing. Augment `TMoostMetadata` / `TMoostParamsMetadata` via TypeScript declaration merging, then export `get<LibName>Mate()` returning `getMoostMate()` typed against your additions.

```ts
// my-lib/mate.ts
import { type Mate, type TMateParamMeta, type TMoostMetadata, getMoostMate } from 'moost'

interface MyLibMeta {
  mylib_action?: { name: string; opts?: { default?: boolean } }
}
interface MyLibParamsMeta {
  mylib_action_param?: 'id' | 'ids'
  mylib_input_form?: { type: Function; name: string }
}

declare module 'moost' {
  interface TMoostMetadata extends MyLibMeta {}
  interface TMoostParamsMetadata extends MyLibParamsMeta {}
}

export type MyLibMate = Mate<
  TMoostMetadata & { params: (TMateParamMeta & MyLibParamsMeta)[] },
  TMoostMetadata & { params: (TMateParamMeta & MyLibParamsMeta)[] }
>

export function getMyLibMate(): MyLibMate {
  return getMoostMate<MyLibMeta, MyLibMeta, MyLibParamsMeta>() as MyLibMate
}
```

Use it everywhere your library reads or writes:

```ts
// scalar form — both key and value are type-checked
function MyAction(name: string): MethodDecorator {
  return getMyLibMate().decorate('mylib_action', { name })
}

// callback form — `current` is typed; no `as` cast inside or on the return
function MyDefault(): MethodDecorator {
  return getMyLibMate().decorate(current => ({
    ...current,
    mylib_action: { ...current.mylib_action, name: current.mylib_action?.name ?? '' },
  })) as MethodDecorator
}

// reader — typed return, dot access
const meta = getMyLibMate().read(ctor.prototype, 'methodName')
const action = meta?.mylib_action                      // typed
const form = meta?.params?.[0]?.mylib_input_form       // typed
```

Conventions:
- **Namespace every key** (`mylib_*`) — augmentations share one workspace; collisions silently overwrite.
- Augment via `interface ... extends MyLibMeta` (single source of truth), not field-by-field at the `declare module` site.
- Re-export `MyLibMeta` / `MyLibParamsMeta` if downstream consumers may layer their own augmentations on top.

**Separate workspace (adapter-private state).** When metadata is read only by your own adapter/library and should not appear on `TMoostMetadata`, spin up an isolated `Mate` — no augmentation, zero collision surface:

```ts
import { Mate } from '@prostojs/mate'
const myMate = new Mate<TMyAdapterMeta, TMyAdapterMeta>('my-adapter')
```

Tradeoff: invisible to anything reading via `getMoostMate()` (other moost-aware tooling, swagger, otel, @aooth/arbac-moost).

### Inheritance

Opt-in, and the flag goes on the **inheriting subclass** (the class whose metadata is being read), NOT on the base class. `@Inherit()` on the subclass enables inheritance of class meta and of members that have no own metadata; on a subclass method/prop it enables just that member.

```ts
class Base { @Get('health') health() { return 'ok' } }

@Inherit()
class App extends Base {}  // inherits @Get('health')
```

`@Inherit()` on only the base class does nothing — the subclass's own meta stays `undefined` and no route is bound.

## Gotchas

- `getMoostMate()` is a singleton — all decorators share one workspace.
- `mate.read()` returns `undefined` if no metadata has been written.
- `params` array is sparse: index = parameter position.
- Mate is configured with `readType: true` (captures TS design-time types via `emitDecoratorMetadata`) and `collectPropKeys: true` (aggregates decorated property keys into `meta.properties`).
- For array fields (`handlers`, `interceptors`, `pipes`) pass `true` as the third `decorate()` arg to append; otherwise you overwrite.
