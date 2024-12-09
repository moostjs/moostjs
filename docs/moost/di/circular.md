# Circular Dependencies

Circular dependencies occur when two or more classes depend on each other’s instantiation, creating a loop in the dependency graph. These scenarios can complicate instance creation and often lead to runtime errors if not managed properly. While it’s best practice to avoid circular dependencies whenever possible — by refactoring your architecture — Moost provides a mechanism to handle them when needed.

## Using `@Circular` to Resolve Circular Dependencies

Moost introduces the `@Circular()` decorator to break dependency loops. This decorator accepts a callback function that returns the class constructor of the dependency, allowing Moost to defer the resolution until a suitable point in the instantiation cycle.

**Example:**
```ts
import { Injectable, Circular } from 'moost';

@Injectable()
class ClassA {
  constructor(@Circular(() => ClassB) private classB: ClassB) {
    // classB is not fully instantiated yet
  }
}

@Injectable()
class ClassB {
  constructor(@Circular(() => ClassA) private classA: ClassA) {
    // classA is not fully instantiated yet
  }
}
```

In this example:
- `ClassA` depends on `ClassB`, and `ClassB` depends on `ClassA`.
- By applying `@Circular(() => ClassB)` in `ClassA`’s constructor, we inform Moost that `ClassB` will be known later.
- Similarly, `@Circular(() => ClassA)` in `ClassB` ensures that the dependency on `ClassA` is also deferred.
  
Moost uses these callbacks to construct proxy instances and then later resolves them to the actual instances once the cycle is clarified. This approach allows the framework to create both classes without running into immediate runtime errors.

## Important Considerations

### Initialization Order and Usage

When you rely on circular dependencies, keep in mind:
- Moost creates a proxy (placeholder) object during construction and resolves the actual instance after the constructors have run.
- You should not expect fully usable dependencies inside the constructor if they are involved in a circular relationship. Accessing them immediately might lead to undefined behavior or partial initialization.
  
Instead, use lifecycle hooks (if available) or other initialization logic that runs after constructors to safely interact with these dependencies once the resolution is complete.

### Minimizing Circular Dependencies

While `@Circular` provides a solution, circular dependencies can increase complexity, reduce clarity, and make testing or debugging more challenging. Consider the following strategies:
- **Refactoring Classes:** Split responsibilities or introduce intermediate interfaces or abstract classes to break the dependency cycle.
- **Reorganizing Code Structure:** Sometimes a different package structure or introducing a service that centralizes shared logic can remove the cycle.
- **Dependency Inversion:** Apply SOLID principles, particularly the dependency inversion principle, to depend on abstractions rather than concrete classes.

## Summary

- **Circular dependencies** can cause complex runtime issues.
- Moost’s `@Circular()` decorator allows you to declare a deferred dependency, letting Moost handle instance creation and resolution later in the lifecycle.
- Use this feature only when refactoring or architectural changes are not feasible.
- Always strive to minimize circular dependencies through better design, as reducing complexity leads to more maintainable and testable code.
