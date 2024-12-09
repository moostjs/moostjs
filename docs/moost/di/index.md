# Introduction to Dependency Injection (DI) in Moost

Moost provides a dependency injection system designed to simplify the creation and management of class instances. It does not rely on modules for organizing dependencies and instead uses a global registry, making it easier to reason about class lifecycles and application architecture.

## Core Concepts

### Injectable Classes
Use the `@Injectable()` decorator to mark a class as managed by Moost’s DI system. Once marked, Moost automatically creates and provides instances of that class when needed. By default, classes are treated as singletons, meaning a single instance is shared throughout the application’s lifetime.

**Example:**
```ts
import { Injectable } from 'moost';

@Injectable()
class MyService {
  // ...
}
```

### Scope of Injectables
Moost supports per-event scoped instances by specifying `'FOR_EVENT'` in the `@Injectable()` decorator. This creates a new instance of the class for each event handled, which is useful for maintaining event-specific state without affecting other events.

**Example:**
```ts
@Injectable('FOR_EVENT')
class MyEventService {
  // A new instance is created for each event
}
```

**Important:**  
Do not inject `FOR_EVENT` scoped classes into singletons. Since singletons are created once and shared across events, injecting event-scoped classes would break event isolation. However, injecting singletons into `FOR_EVENT` classes is allowed.

### Using DI in Controllers and Other Classes
Controllers are automatically injectable. Simply include a constructor parameter typed as one of your injectable classes, and Moost will resolve it automatically.

**Example:**
```ts
@Controller()
class MyController {
  constructor(private myService: MyService) {
    // `myService` is automatically injected as a singleton
  }
}
```

If you want a controller to be event-scoped, apply `@Injectable('FOR_EVENT')` to it. This ensures the controller gets a fresh instance per event.

**Example:**
```ts
@Injectable('FOR_EVENT')
@Controller()
class MyEventController {
  constructor(private eventService: MyEventService) {
    // `eventService` is event-scoped, same as this controller
  }
}
```

### Customization and Integrations
Moost’s DI integrates with pipes and metadata for parameter resolution and property injection. When a constructor parameter or property is associated with specific metadata, pipes can transform the injected value before it reaches the instance logic. This allows for validation, parsing, and other preprocessing steps.

The DI system also supports a flexible replacement mechanism, allowing you to swap out classes for testing or different runtime scenarios. By controlling the global registry and providing or replacing instances, you can easily mock dependencies in unit tests or switch implementations without changing application logic.

## Summary
- `@Injectable()` marks a class for automatic instance creation and injection.
- By default, instances are singletons.
- Use `'FOR_EVENT'` scope to isolate instances per event.
- Controllers automatically support DI.
- Avoid mixing event-scoped dependencies into singletons.
- DI integrates with pipes for parameter and property transformations.
- The global registry and replacement features make unit testing and runtime customization simpler.

Moost’s DI aims to strike a balance between flexibility and simplicity, helping you manage class lifecycles and dependencies with minimal overhead.
