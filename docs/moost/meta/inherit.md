# Metadata Inheritance

Moost supports inheriting metadata from superclasses, making it easier to reuse common configurations and annotations. By default, metadata defined on a superclass does not propagate to subclasses. The `@Inherit()` decorator enables this inheritance, reducing boilerplate when extending controllers, class-based interceptors, or any `@Injectable` class.

## Key Points

- **Decorator:** `@Inherit()` marks a class or method to inherit metadata from its superclass.
- **Use Cases:**  
  - **Controllers:** Inherit routes, prefixes, and other controller-level metadata.  
  - **Class-Based Interceptors:** Inherit interceptor configurations defined in a base interceptor class.  
  - **Injectable Classes:** Inherit dependency injection scopes, parameters, and other class-level metadata from a base service or provider class.
- **Granular Application:** Apply `@Inherit()` to an entire class or to a single method.

## Examples

### Controller Inheritance

Base class:
```ts
import { Controller, Get } from 'moost';

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
import { Intercept, Injectable } from 'moost';

@Injectable()
@Intercept(myInterceptorFn)
export class BaseInterceptor {
  // Interceptor logic
}
```

Subclass:
```ts
import { Inherit } from 'moost';

@Inherit()
export class ExtendedInterceptor extends BaseInterceptor {
  // Now inherits interceptor metadata from BaseInterceptor
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

## Summary

`@Inherit()` lets you define metadata once and share it across subclasses for controllers, interceptors, injectable classes, and methods. This reduces redundancy and keeps your codebase cleaner, more maintainable, and consistent.