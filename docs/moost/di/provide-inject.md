# Dependency Substitution and Injection in Moost

Moost’s dependency injection (DI) system is highly configurable. Beyond basic injection and providing dependencies via class types or string keys, Moost supports dynamic substitution of classes. This allows you to alter behavior at runtime — replacing certain classes with others — without forcing changes throughout your codebase or configuration.

## Class and Key-Based Provides

- **Class-based Provide:**  
  Use `@Provide(ClassType, factoryFn)` to bind a class type to a specific factory. Consumers only need to reference the class type in their constructor.
  
  ```ts
  @Provide(AnotherDependency, () => new AnotherDependency())
  class MyClass {
    constructor(private dep: AnotherDependency) {}
  }
  ```

- **String Key Provide:**  
  Use `@Provide('some-key', factoryFn)` and `@Inject('some-key')` for cases where multiple instances of the same class or non-class values must be differentiated by keys.
  
  ```ts
  @Provide('instance-a', () => new MyDependency('A'))
  @Provide('instance-b', () => new MyDependency('B'))
  class MyClass {
    constructor(
      @Inject('instance-a') private depA: MyDependency,
      @Inject('instance-b') private depB: MyDependency
    ) {}
  }
  ```

## Global Provide Registry

You can centralize dependency definitions using the global provide registry instead of placing `@Provide` decorators on classes. This keeps your dependency configuration in one location, making it easier to maintain and update:

```ts
app.setProvideRegistry(createProvideRegistry(
  [AnotherDependency, () => new AnotherDependency()],
  ['instance-a', () => new MyDependency('A')],
  ['instance-b', () => new MyDependency('B')]
));
```

## Replacing Dependencies

### Replace Registry

A replace registry allows you to override one class with another globally. This is useful when you want to switch to a specialized subclass or a mock implementation without editing every injection point.

```ts
app.setReplaceRegistry(createReplaceRegistry([BaseClass, ExtendedClass]));
```

Any class expecting `BaseClass` will now receive an instance of `ExtendedClass`.

### `@Replace` Decorator

For scenarios where you want to declare replacements inline, Moost provides the `@Replace` decorator. Instead of configuring replacements at the application level, you can specify directly on a class which types to override.

**Example:**
```ts
import { Replace } from 'moost';

@Replace(BaseClass, ExtendedClass)
class AnotherClass {
  // Any injection of BaseClass is now replaced with ExtendedClass
}
```

This is especially helpful for applying localized substitutions in tests, feature toggles, or adjusting a third-party controller’s dependencies when you cannot modify their code directly.

## Practical Guidelines

1. **Choose `@Provide` and `@Inject` Strategies Wisely:**  
   Use class-type provides whenever possible to simplify usage. Resort to string keys only when multiple variations or non-class values need to be clearly distinguished.

2. **Maintain a Global Provide Registry for Shared Configuration:**  
   Keep frequently used dependencies centralized. This makes large-scale refactoring simpler.

3. **Use Replacements for Flexibility and Testing:**  
   Whether setting replacements via `app.setReplaceRegistry()` or using `@Replace`, you can easily swap out classes. This approach improves testability, enabling quick injection of mock or specialized classes without modifying consumer logic.

By combining these features, Moost’s DI system remains flexible, maintainable, and adaptable. You can configure how dependencies are provided and replaced in a way that supports testing, modularization, and easy evolution as your application’s requirements change.