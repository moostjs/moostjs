# Circular Dependencies

Circular dependencies occur when two classes depend on each other, creating a loop in the dependency graph. While refactoring to eliminate the cycle is preferred, Moost provides `@Circular()` to handle cases where it's unavoidable.

## @Circular

The `@Circular()` decorator takes a callback that returns the class constructor, deferring resolution until after both classes are defined:

```ts
import { Injectable, Circular } from 'moost'

@Injectable()
class ServiceA {
  constructor(@Circular(() => ServiceB) private b: ServiceB) {}
}

@Injectable()
class ServiceB {
  constructor(@Circular(() => ServiceA) private a: ServiceA) {}
}
```

The callback `() => ServiceB` breaks the reference cycle — at decoration time, `ServiceB` may not yet be defined, but by the time Moost resolves the dependency, the callback returns the actual class.

## Limitations

Dependencies involved in a circular relationship are **not fully available inside constructors**. During construction Moost registers an empty placeholder object (sharing the class prototype) and fills in its properties only after both instances are built — until then the placeholder's properties are simply `undefined`. Access circular dependencies in handler methods or lifecycle hooks, not in `constructor` bodies.

## When to Refactor Instead

`@Circular` is an escape hatch. Prefer breaking cycles by:

- **Extracting shared logic** into a third service both depend on
- **Depending on abstractions** rather than concrete classes
- **Reorganizing responsibilities** so the dependency flows one way
