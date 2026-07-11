# Metadata Inheritance

Moost supports inheriting metadata from superclasses, making it easier to reuse common configurations and annotations. By default, metadata defined on a superclass does not propagate to subclasses. The `@Inherit()` decorator enables this inheritance, reducing boilerplate when extending controllers, class-based interceptors, or any `@Injectable` class.

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

- **Array fields replace wholesale.** If the override declares its own `@Get('x')`, only `x` is served — routes, interceptors, and pipes are not concatenated with the parent's.
- **Parameters follow the same rule.** Params with no own decorators keep the parent's `@Param()`/`@Body()` resolvers; a param that re-declares its decorators uses its own.
- **`@Inherit(false)` opts out.** Put it on the override for a deliberate full replacement — the method keeps only its own metadata, and the parent's route is *not* bound.

::: info Changed in 0.6.30
Before 0.6.30, an override carrying *any* own decorator silently dropped **all** of the parent's method metadata — including the `@Get`/`@Post` binding, so the route disappeared with no warning. A method-level `@Inherit()` was required to combine both.
:::

## Gotchas

1. **No `@Inherit`, no inheritance.** Overriding a decorated method in a subclass *without* `@Inherit` (method-level or class-level) silently drops the inherited decorators — the route/command simply disappears, with no warning.
2. **Class-level keys are shallow-merged.** Class-level `@Inherit()` merges the parent's class metadata (prefix, interceptors, etc.) under the subclass's own — e.g. a subclass without `@Controller(prefix)` keeps the parent's prefix.
3. **Constructor params inherit only without a declared constructor.** A subclass with no constructor of its own inherits the parent's constructor param metadata (DI resolves it, no `@Inherit()` needed). A subclass that declares a constructor uses its own params only — re-apply `@Inject()` and friends there.

## Summary

`@Inherit()` lets you define metadata once and share it across subclasses for controllers, interceptors, injectable classes, and methods. This reduces redundancy and keeps your codebase cleaner, more maintainable, and consistent.