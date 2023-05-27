# Circular Dependencies

Circular dependencies occur when two or more classes depend on each other,
creating a cyclic reference.
This can pose a challenge when resolving class types during runtime.
However, Moost provides a workaround for handling circular dependencies using the `@Circular` decorator.

## Resolving Circular Dependencies

The @Circular decorator is used to provide a hint to the framework about the class type to inject when resolving circular dependencies.
It accepts a callback function that returns the class type before instantiation.

Here's an example to illustrate how to use the `@Circular` decorator in classes with circular dependencies:
```ts
import { Injectable, Circular } from 'moost';

@Injectable()
class ClassA {
  constructor(@Circular(() => ClassB) private classB: ClassB) {
    // ClassA logic
  }
}

@Injectable()
class ClassB {
  constructor(@Circular(() => ClassA) private classA: ClassA) {
    // ClassB logic
  }
}
```

In the above example, `ClassA` depends on `ClassB`, and `ClassB` depends on `ClassA`.
By applying the `@Circular` decorator with the corresponding class type callback, we inform the framework about the circular dependency.

::: warning
It's crucial to be aware of the order of dependency injection.
In the case of circular dependencies, the injection of dependent classes occurs after the constructor call.
This means that it's unsafe to access and use those dependencies directly within the constructor.

Due to the nature of circular dependencies and the way they are resolved,
accessing dependent classes in the constructor can lead to unexpected behavior or runtime errors.

By deferring the usage of dependent classes until after the constructor has executed and the circular dependencies have been resolved,
you ensure a more reliable and predictable execution flow within your application.
:::

## How does it work?
When resolving circular dependencies, Moost follows a two-step process:

1. It creates a proxy instance for the class with the circular dependency.
2. It resolves the circular dependency using the class type provided by the `@Circular` decorator.

By following this approach, Moost can successfully resolve circular dependencies and instantiate the classes without runtime errors.

## Important Note

It is important to note that circular dependencies, in general, should be avoided as they can introduce complexity and make your codebase more difficult to maintain. Circular dependencies occur when two or more classes depend on each other, forming a cycle of dependencies.

While Moost provides a mechanism to handle circular dependencies using the `@Circular` decorator, it is recommended to use this approach only when there is no alternative solution available. Circular dependencies can complicate the understanding of code flow, increase the risk of introducing bugs, and make testing and debugging more challenging.

Ideally, it is advisable to analyze your codebase and architecture to identify opportunities for refactoring and reducing or eliminating circular dependencies. By restructuring your code and breaking down dependencies, you can achieve a more modular and maintainable design.

While the `@Circular` decorator can provide a workaround for circular dependencies, it should be used judiciously and as a last resort. Strive to design your application in a way that minimizes complex dependencies and promotes a clear and understandable codebase.