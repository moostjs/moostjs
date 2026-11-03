# Metadata Inheritance

Moost supports inheriting metadata from superclasses, making it easier to reuse common configurations and annotations. By default, metadata defined on a superclass does not propagate to subclasses. The `@Inherit()` decorator enables this inheritance, reducing boilerplate when extending controllers, class-based interceptors, or any `@Injectable` class.

This page covers the `@Inherit()` merge mechanics. For the task-level view — which metadata flows for each subclass shape, the route-drop and constructor-params traps, and the bind-time warnings that catch them — see [Subclassing Controllers](/moost/subclassing).

## Key Points

- **Decorator:** `@Inherit()` marks a class or method to inherit metadata from its superclass; `@Inherit(false)` on an overridden method opts back out (see [Gotchas](#gotchas)).
- **Use Cases:**  
  - **Controllers:** Inherit routes, prefixes, and other controller-level metadata.  
  - **Class-Based Interceptors:** Inherit interceptor configurations defined in a base interceptor class.  
  - **Injectable Classes:** Inherit dependency injection scopes, parameters, and other class-level metadata from a base service or provider class.
- **Granular Application:** Apply `@Inherit()` to an entire class or to a single method.

## Examples

### Controller Inheritance

Base class:
```ts
import { Controller } from 'moost';
import { Get } from '@moostjs/event-http';

@Controller('base')
export class BaseController {
  @Get('')
  index() {
    return 'hello base';
  }
}
```

Subclass with inheritance:
```ts
import { Inherit, Controller } from 'moost';

@Inherit()
@Controller('extended')
export class ExtendedController extends BaseController {
  index() {
    return 'hello extended';
  }
}
// Inherits BaseController’s `@Get('')` route while applying a new @Controller prefix.
```

### Class-Based Interceptor Inheritance

Base interceptor:
```ts
import { Interceptor, Before, TInterceptorPriority } from 'moost';

@Interceptor(TInterceptorPriority.GUARD)
export class BaseInterceptor {
  @Before()
  check() {
    // guard logic
  }
}
```

Subclass:
```ts
import { Inherit } from 'moost';

@Inherit()
export class ExtendedInterceptor extends BaseInterceptor {
  // Now inherits the @Interceptor priority and @Before hook metadata
}
```

### Injectable Classes Inheritance

Base service:
```ts
import { Injectable } from 'moost';

@Injectable()
export class BaseService {
  // Some metadata and DI config
}
```

Subclass:
```ts
import { Inherit } from 'moost';

@Inherit()
export class ExtendedService extends BaseService {
  // Inherits DI metadata from BaseService
}
```

## Method-Level Inheritance

You can also apply `@Inherit()` to specific methods to inherit their metadata individually.

```ts
import { Controller, Inherit } from 'moost';
import { Get } from '@moostjs/event-http';

@Controller()
class BaseController {
  @Get('')
  index() {
    return 'base index';
  }
}

class AnotherController extends BaseController {
  @Inherit() // only @Get('') is inherited
  index() {
    return 'base index';
  }
}
```

## Overriding Decorated Methods

With class-level `@Inherit()`, an override that adds its own decorators **merges** the parent's method metadata under its own (own keys win):

```ts
@Inherit()
@Controller('extended')
export class ExtendedController extends BaseController {
  @MyGuardDecorator() // adds a guard — the parent's @Get('') binding is kept
  index() {
    return 'guarded index';
  }
}
```

- **Interceptors, guards and pipes add up.** An override's own `@Intercept()`, `@Authenticate()` or `@Pipe()` run *in addition to* the parent method's — see [Interceptors and pipes add up](#interceptors-and-pipes-add-up).
- **Routes replace.** If the override declares its own `@Get('x')`, only `x` is served — the parent's route for that method is not bound as well.
- **Parameters follow the same rule.** Params with no own decorators keep the parent's `@Param()`/`@Body()` resolvers; a param that re-declares its decorators uses its own.
- **`@Inherit(false)` opts out.** Put it on the override for a deliberate full replacement — the method keeps only its own metadata, and the parent's route is *not* bound. This drops only the parent *method's* metadata: class-level interceptors of the class and its ancestors still apply to the method.

::: info Changed in 0.6.30
Before 0.6.30, an override carrying *any* own decorator silently dropped **all** of the parent's method metadata — including the `@Get`/`@Post` binding, so the route disappeared with no warning. A method-level `@Inherit()` was required to combine both.
:::

## Interceptors and pipes add up

Under `@Inherit()`, interceptors (including `@Authenticate` guards) and pipes **accumulate** along `extends`, on the class and on each overridden method: the parent's entries come first, then the subclass's own, and the usual priority ordering applies on top. A subclass that adds a guard keeps the base class's error mapping, guards and pipes:

```ts
import { Controller, Inherit, Intercept } from 'moost'
import { Authenticate, Post } from '@moostjs/event-http'

@Intercept(mapValidationErrors) // turns validation errors into a 400
@Controller('products')
class BaseCrudController {
  @Post('')
  insert() { /* … */ }
}

@Authenticate(jwtGuard)
@Inherit()
class ProductsController extends BaseCrudController {}
// POST /products runs jwtGuard AND mapValidationErrors
```

- **The same interceptor or pipe *reference* declared on both levels runs once.** It stays at the parent's position, with the subclass's priority and name. This only holds for the same object or class: a factory called on each level (`@Intercept(makeLogger())` on the base and again on the subclass) creates two interceptors, and both run — an `after` hook that wraps the response then wraps it twice.
- **Every level counts.** In a three-level chain with `@Inherit()` on each subclass, the interceptors of all three classes run, and so do those of each overridden method.
- **The same goes for** the OpenAPI spec (`@moostjs/swagger` AND-combines the parent's and the subclass's `@Authenticate` guards) and for props resolved by prop decorators (`@Resolve()`, `@Const()`, …) on the base class.
- **`@ImportController()` does not accumulate.** A subclass with its own `@ImportController()` replaces the base's imports (one without imports keeps them), so no child controller is mounted twice.
- **A base class's class-level interceptors can't be removed by a subclass.** They apply to every method of every `@Inherit()` subclass; method-level `@Inherit(false)` does not drop them. Put a guard you want to vary on the subclasses themselves, or on a separate base class that only some subclasses extend.
- **Without `@Inherit()` nothing flows**, interceptors included: the subclass runs only its own. A class-level `@Inherit(false)` is the same.

::: info Changed in 0.7.2
Up to 0.7.1, a subclass or override that declared its own interceptor, guard or pipe *replaced* the parent's list (the 0.6.30 "array fields replace wholesale" rule): adding `@Authenticate` to a subclass silently dropped the base class's error-mapping interceptor, so validation errors answered 500 instead of 400. Since 0.7.2 these lists [add up](#interceptors-and-pipes-add-up). Prop decorators on the base class now also resolve on a subclass that adds prop decorators of its own, which may instantiate dependencies that weren't created before.

**When upgrading:**

- If you worked around the old behaviour by re-declaring the base class's interceptor on the subclass, remove that workaround. With the same reference it is redundant; with a factory call (`@Intercept(makeX())`) it now runs twice.
- If you relied on the replacement to swap one guard for another, the parent's guard now runs as well: move it off the shared base.
:::

## Gotchas

1. **No `@Inherit`, no inheritance.** Overriding a decorated method in a subclass *without* `@Inherit` (method-level or class-level) drops the inherited decorators — the route/command simply disappears. A registered controller that ends up with zero handlers while an ancestor defines some triggers a bind-time warning (see [Subclassing Controllers](/moost/subclassing#the-route-drop-trap)); `diagnostics: { inheritance: 'off' }` on Moost options silences it.
2. **Class-level keys are shallow-merged.** Class-level `@Inherit()` merges the parent's class metadata under the subclass's own — e.g. a subclass without `@Controller(prefix)` keeps the parent's prefix, and one with `@Controller('own')` uses its own. Interceptors, guards and pipes are the exception: they [accumulate](#interceptors-and-pipes-add-up).
3. **Constructor params inherit only without a declared constructor.** A *decorated* subclass with no constructor of its own inherits the parent's constructor param metadata (DI resolves it, no `@Inherit()` needed). A subclass that declares a constructor uses its own params only — re-apply `@Inject()` and friends there. A subclass with no decorators at all inherits nothing, and an undecorated intermediate class breaks the automatic fallback — both cases are warned about at bind time ([details](/moost/subclassing#constructor-params-across-extends)).

## Summary

`@Inherit()` lets you define metadata once and share it across subclasses for controllers, interceptors, injectable classes, and methods. This reduces redundancy and keeps your codebase cleaner, more maintainable, and consistent.