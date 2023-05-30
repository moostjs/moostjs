# Circular Dependencies

Roundabout, or circular, dependencies happen when two or more classes lean on each other. This can make a spinning circle that's tricky to handle when your program is running. But don't worry, Moost has a trick to handle this using the `@Circular` decorator.

## Breaking the Roundabout

The `@Circular` decorator is like a friendly traffic cop that tells Moost what class type to use when there's a circular dependency. It uses a callback function to return the class type before it's created.

Here's how to use the `@Circular` decorator when you have circular dependencies:
```ts
import { Injectable, Circular } from 'moost';

@Injectable()
class ClassA {
  constructor(@Circular(() => ClassB) private classB: ClassB) {
    // What ClassA does
  }
}

@Injectable()
class ClassB {
  constructor(@Circular(() => ClassA) private classA: ClassA) {
    // What ClassB does
  }
}
```

In this example, `ClassA` depends on `ClassB`, and `ClassB` depends on `ClassA`. By using the `@Circular` decorator with the right class type callback, we tell Moost about the circular dependency.

::: warning
It's super important to remember the order of dependency injection. With circular dependencies, Moost injects dependent classes after the constructor call. So you shouldn't try to use these dependencies in the constructor.

If you do, you might run into problems or errors because of the circular dependencies and how they're resolved. It's better to wait until after the constructor has run and the circular dependencies have been sorted out. That way, your app will run more reliably and predictably.
:::

## Behind the Scenes
When Moost is dealing with circular dependencies, it has a two-step plan:

1. It makes a proxy instance for the class with the circular dependency.
2. It uses the class type from the `@Circular` decorator to sort out the circular dependency.

By doing this, Moost can successfully handle circular dependencies and create the classes without any errors.

## Don't Forget

Circular dependencies should generally be avoided because they can make your code more complex and harder to manage. They happen when two or more classes depend on each other, forming a circular pattern of dependencies.

While Moost can handle circular dependencies using the `@Circular` decorator, it's best to only use this when you have no other options. Circular dependencies can make your code harder to understand, increase the chance of bugs, and make testing and debugging more difficult.

Ideally, you should look at your code and structure to find ways to cut down or get rid of circular dependencies. By rearranging your code and breaking up dependencies, you can make your design easier to manage and more flexible.

Even though the `@Circular` decorator can help with circular dependencies, it should be used sparingly and only as a last resort. Try to design your app to keep complex dependencies to a minimum and make your code easier to understand.