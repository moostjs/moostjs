# Controllers in Moost

Controllers in Moost serve as cohesive units for organizing your event handlers (e.g., HTTP endpoints, CLI commands, or other event-driven logic). By grouping related functionality together, controllers improve the structure and maintainability of your application, making it clearer where to add new handlers or modify existing ones.

## Defining a Controller

To create a controller, annotate a class with the `@Controller()` decorator. You can optionally specify a path prefix, which applies to all handlers within that controller. This helps logically segment your API endpoints or event triggers under a common namespace.

**Example:**
```ts
import { Controller, Param } from 'moost';

@Controller('api')  // All routes in this controller will start with /api
export class MainController {
  // Define handlers here
}
```

## Integrating Controllers Into Your Application

There are multiple ways to bring controllers into your Moost application, accommodating different code structures and scaling strategies.

### Using `@ImportController`

If you’re extending the `Moost` class, you can import controllers by decorating your server class with `@ImportController()`:

**Example:**
```ts
import { Moost, ImportController } from 'moost';
import { MainController } from './main.controller';

@ImportController(MainController)
class MyServer extends Moost {
  // MainController is now part of this server
}
```

You can also customize the prefix when importing:
```ts
@ImportController('new-prefix', MainController)
class MyServer extends Moost {
  // MainController is now accessible under /new-prefix routes
}
```

For more dynamic scenarios, `@ImportController` can accept a factory function that returns an instance. This allows injecting different arguments each time:

**Example:**
```ts
import { ImportController } from 'moost';
import { DbCollection } from './controllers/DbCollection';

@ImportController(() => new DbCollection('users'))
@ImportController(() => new DbCollection('roles'))
class MyServer extends Moost {
  // Two DbCollection controllers registered under their respective prefixes
}
```

### Using `registerControllers`

If you’re not extending Moost, or prefer more imperative control, you can use the `registerControllers` method directly on a Moost instance:

**Example:**
```ts
import { Moost } from 'moost';
import { MainController } from './main.controller';

const app = new Moost();
app.registerControllers(MainController);
// Now MainController is active within this app instance
```

This approach is handy for assembling controllers dynamically (e.g., conditionally adding them based on environment flags or configuration).

## Controller Scope and Lifecycles

By default, controllers are singletons — one shared instance is created and reused across all events. However, Moost allows you to create per-event instances of a controller using `@Injectable('FOR_EVENT')`.

**Example:**
```ts
import { Controller, Injectable, Param } from 'moost';

@Injectable('FOR_EVENT')
@Controller('api')
export class MainController {
  @Param('name')
  name!: string;

  // When handling an event, a fresh instance of MainController is created.
  // 'this.name' will be unique to each event.
}
```

In this scenario, each incoming event (e.g., each request) gets its own controller instance. This is especially useful for stateful logic that shouldn’t be shared between events, such as request-scoped data or temporary computations.

**Key Rules:**
- **No `FOR_EVENT` dependencies in singleton controllers:**  
  A singleton cannot depend on a `FOR_EVENT`-scoped dependency, since singletons are created once and cannot dynamically instantiate event-scoped instances per request.
- **Reverse is allowed:**  
  A `FOR_EVENT` controller can depend on singletons without issues.

*You can read more about Dependency Injection (DI) in Moost [here](/moost/di/index).*

## Structuring Your Controllers

By composing multiple controllers and leveraging prefixes, you can build a clear hierarchy of your application’s behavior. For example:

**Example:**
```ts
@Controller('api')
class ApiController {
  // Handlers for /api/...
}

@Controller('admin')
class AdminController {
  // Handlers for /admin/...
}

@ImportController(ApiController)
@ImportController(AdminController)
class MyServer extends Moost {
  // /api/... and /admin/... endpoints are now served.
}
```

This modular approach scales well as your application grows, encouraging separation of concerns and logical grouping of related logic.

## Best Practices

1. **Keep Controllers Focused:**  
   Assign each controller a clear responsibility. Avoid mixing unrelated functionality in a single controller.
   
2. **Use Prefixes for Clarity:**  
   Prefixes help distinguish sets of endpoints and can reduce conflicts or ambiguity.
   
3. **Leverage Scopes Wisely:**  
   Use `FOR_EVENT` controllers for request-scoped data, ensuring each event is isolated and won’t accidentally leak state.
   
4. **Combine with DI and Composables:**  
   Take advantage of Moost’s DI system and composables to keep controllers lean. Move complex logic into services or interceptors, and just wire them up in controllers.

---

Controllers are the backbone of your Moost application, offering a convenient way to structure your logic, manage state, and integrate with Moost’s powerful DI and event-driven architecture. By following these guidelines and examples, you can build scalable, maintainable, and testable applications.
