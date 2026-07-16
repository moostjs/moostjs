# Subclassing Controllers

Controller hierarchies — a base CRUD controller, a shared authenticated base, a generated table controller — are a natural way to remove duplication. Moost supports them, but decorator metadata does **not** flow across `extends` on its own: the `@Inherit()` decorator on the *subclass* is the switch. This page pins down exactly what flows in each subclass shape, the two traps to know about, and the bind-time warnings that catch them.

The smallest complete example — an empty subclass that is a fully working controller:

```ts
import { Controller, Inherit, Param } from 'moost'
import { Get } from '@moostjs/event-http'

@Controller('base')
export class BaseCrudController {
  constructor(private store: Store) {}

  @Get('')
  list() {
    return this.store.list()
  }

  @Get(':id')
  read(@Param('id') id: string) {
    return this.store.read(id)
  }
}

@Inherit()
export class UsersController extends BaseCrudController {}
// prefix 'base', SINGLETON scope, the Store dependency, and BOTH routes — all inherited
```

## What flows when

Each row describes a subclass of a fully decorated parent (`@Controller('p')` + routes + constructor dependencies). "Automatic" means it works without `@Inherit()`.

| Subclass shape                                    | Prefix     | Injectable scope | Constructor params    | Parent routes             |
| ------------------------------------------------- | ---------- | ---------------- | --------------------- | ------------------------- |
| `class Sub extends Base {}` — no decorators       | —          | —                | —                     | **dropped**               |
| `@Inherit()` — empty subclass                      | parent's   | parent's         | parent's              | all inherited             |
| `@Controller('own')` — no own constructor          | own        | own              | parent's (automatic)  | **dropped**               |
| `@Controller('own')` + re-declared constructor     | own        | own              | own                   | **dropped**               |
| `@Inherit()` + re-declared constructor             | parent's   | parent's         | own (own keys win)    | all inherited             |
| `@Controller('own')` + `@Inherit()`                | own (wins) | parent's         | parent's              | all, under the own prefix |
| `@Inherit(false)` — explicit opt-out               | —          | —                | parent's (automatic)  | dropped (deliberate)      |

Routes added by the subclass itself always register. With `@Inherit()` they combine with the parent's; without it, only the subclass's own routes are served. An override that carries its own route decorator *replaces* the parent's route for that method — see the [merge rules](/moost/meta/inherit) for the exact semantics (own keys win, array fields replace wholesale, `@Inherit(false)` per method).

## The route-drop trap

**Without `@Inherit()`, the parent's routes silently disappear.** A subclass that adds `@Controller('own')` (or any class decorator) still does *not* inherit the parent's method metadata — the app boots normally, DI works, and every inherited endpoint 404s.

```ts
@Controller('users')
class UsersController extends BaseCrudController {}
// boots fine — but GET /users and GET /users/:id do NOT exist
```

Moost warns about this at bind time (during `init()`):

```
[moost] UsersController extends BaseCrudController which defines 2 route handler(s),
but UsersController registered 0 and has no @Inherit() — parent routes are not
inherited without it. Add @Inherit() or re-declare the routes.
```

The warning stays silent when the parent routes actually flow (a working `@Inherit()`), when the subclass registers routes of its own, and for a deliberate class-level `@Inherit(false)`. If `@Inherit()` is present but nothing flowed — an undecorated intermediate class breaks the chain, since `@Inherit()` bridges one level at a time — the warning fires and names the broken link; add `@Inherit()` to each intermediate class.

## Constructor params across `extends`

Constructor param metadata follows its own, more forgiving rule:

- **A decorated subclass with no constructor of its own inherits the parent's constructor params automatically** — no `@Inherit()` needed. `@Controller('own') class Sub extends Base {}` resolves the parent's dependencies through DI just fine.
- **A subclass that re-declares its constructor uses its own params only.** Re-apply param decorators (`@Inject()` and friends) there.
- **A subclass with no decorators at all inherits nothing** — it is not seen as injectable, and its (inherited) constructor dependencies cannot resolve.
- **An undecorated intermediate class breaks the automatic fallback.** The fallback walks exactly one level: with `Decorated → Undecorated → Decorated` in the chain, the bottom class ends up with no constructor param metadata even though its grandparent declares some.

The last two shapes are also caught at bind time:

```
[moost] BareSubController extends BaseCrudController whose constructor declares
1 DI param(s), but BareSubController carries no Moost metadata of its own — it is
not seen as injectable and the constructor params will not resolve. Add @Inherit()
to BareSubController or re-declare the constructor.
```

## Controlling the warnings

Both checks are warn-only — they never fail `init()`. They are on by default and can be switched off via the `diagnostics` option:

```ts
const app = new Moost({
  diagnostics: {
    inheritance: 'off', // 'warn' (default) | 'off'
  },
})
```

## DOs and DON'Ts

- **DO** put `@Inherit()` on the subclass whose metadata should include the parent's — it never goes on the base class.
- **DO** prefer an empty `@Inherit()` subclass over re-declaring boilerplate constructors and routes — the whole parent surface flows.
- **DON'T** expect `@Controller('own')` alone to carry the parent's routes — it only replaces the prefix; routes need `@Inherit()`.
- **DON'T** re-declare a constructor just to "make DI work" — a decorated subclass without a constructor inherits the parent's constructor params automatically.
- **DO** keep every class in a controller chain decorated (or use `@Inherit()` end to end) — an undecorated intermediate class cuts the metadata chain.
- **DO** use `@Inherit(false)` (class- or method-level) for a deliberate full replacement — it also silences the route-drop warning.

## See also

- [Metadata Inheritance](/moost/meta/inherit) — the `@Inherit()` merge semantics in detail (decorated overrides, per-param merging, arrays).
- [Controllers](/moost/controllers) — registration forms and prefix composition.
- [Introduction to DI](/moost/di/) — scopes and dependency resolution.
