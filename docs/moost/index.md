# Introduction to Moost

**Moost** is a next-generation, metadata-driven framework that simplifies building server-side applications for various event sources — HTTP requests, CLI commands, or custom triggers. Inspired by frameworks like [NestJS](https://nestjs.com), Moost adopts a similar decorator-based approach but with fewer layers of complexity, no mandatory modules, and a direct integration with [Wooks](https://wooks.moost.org/wooks/what.html) — a composable, event-driven ecosystem.

By embracing modern metadata tools, flexible dependency injection (DI), controllers, pipelines, and interceptors, Moost delivers a cleaner, more maintainable codebase with less boilerplate. If you’ve ever been intrigued by NestJS’s style but found it too heavy or wanted to handle more than just HTTP, Moost is designed for you.

**Not sure if Moost is right for you?** Check out the [Why Moost?](/moost/why) page for insights into its advantages.

## Built on Wooks’ Event-Driven Core

At its heart, Moost leverages [Wooks](https://wooks.moost.org/wooks/what.html), an event-driven framework that treats every interaction as an event. This approach decouples the application’s logic from the transport layer and enables Moost to:

- **Handle Various Event Types:** Although Moost fits naturally into an HTTP environment, it’s not restricted to it. Events could be CLI commands, workflow steps, or custom triggers.
- **Integrate with Other Servers:** Moost can work on top of Wooks adapters for Express, Fastify, h3, or others, ensuring maximal flexibility.
- **Maintain Consistent Context:** Each event gets its own asynchronous context, so you don’t have to worry about shared state across concurrent requests.

## Metadata and Decorators

Moost uses [`@prostojs/mate`](https://github.com/prostojs/mate) to simplify working with metadata and decorators, making it easy to define the behavior of controllers, handlers, and parameters:

- **Declarative Configuration:** Apply decorators like `@Controller()`, `@Get()`, or `@Param()` directly to your classes and methods.
- **Custom Decorators:** Create your own decorators to standardize patterns and keep your code DRY.

**Example:**
```ts
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller()
export class AppController {
    @Get('hello/:name')
    greet(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
```
**Learn more:**  
- [Metadata in Moost](/moost/meta/)

## Dependency Injection Without Modules

Instead of forcing a module-centric architecture, Moost leverages [`@prostojs/infact`](https://github.com/prostojs/infact) for dependency injection:

- **`@Injectable()` Classes:** Mark classes as injectable to let Moost manage their lifecycle.
- **Global and Scoped DI:** Choose between singletons, per-event instances, or other scopes.  
- **Provide and Inject:** Use `@Provide()` and `@Inject()` decorators or global registries to easily supply and consume dependencies.
- **Replace Registry:** Seamlessly swap implementations (e.g., mocks in testing, specialized subclasses in production) without changing consumer code.

**Learn more:**  
- [Dependency Injection (DI)](/moost/di/index)

## Controllers for Organized Event Handling

Controllers group and route events logically:

- **Route Prefixes:** `@Controller('api')` creates a namespace for related endpoints.
- **Nested Controllers:** Import and chain controllers for complex applications.
- **Event Scopes:** Use `@Injectable('FOR_EVENT')` to get fresh controller instances per event.

**Learn more:**  
- [Controllers](/moost/controllers)

## Pipelines and Resolvers

Moost’s pipeline system processes data before it reaches your handlers:

- **Resolve Pipeline:** Automatically extract route params, parse input, and inject dependencies as handler arguments.
- **Validation Pipeline:** Validate data (e.g., using Zod) to ensure your handlers receive clean, type-safe input.
- **Custom Resolvers:** Encapsulate logic that transforms or fetches data, simplifying repetitive tasks.

**Learn more:**  
- [Introduction to Pipelines](/moost/pipes/)
- [Resolve Pipe](/moost/pipes/resolve)
- [Validation Pipe](/moost/pipes/validate)
- [Custom Pipes](/moost/pipes/custom)

## Interceptors for Cross-Cutting Concerns

Interceptors wrap your handlers with pre- and post-processing logic:

- **Before/After/Error Hooks:** Modify requests, responses, or handle errors centrally.
- **Priorities:** Control the order in which interceptors run (e.g., run auth checks before logging).
- **Class or Functional:** Define interceptors as DI-integrated classes or simple functions.

**Learn more:**  
- [Interceptors](/moost/interceptors)

## Advanced Logging and Observability

Moost integrates smoothly with advanced logging and tracing tools:

- **Event-Aware Logging:** Tag logs per event, improving debugging.
- **Observability with Opentelemetry:** Insert spans and traces without custom boilerplate.

**Learn more:**  
- [Logging in Moost](/moost/logging)
- [Opentelemetry Integration](/moost/otel)

## Why Choose Moost?

- **Less Complexity, More Clarity:** Moost reduces the layers found in some frameworks, making it easier to learn and maintain.
- **Not Just HTTP:** Moost handles various events, adapting to multiple backends and scenarios.
- **Declarative and Type-Safe:** Decorators, metadata, and DI patterns keep your code concise, explicit, and robust.
- **Easy Testing and Mocking:** Replace dependencies without rewriting code, run handlers independently, and test with confidence.

For a deeper look at why Moost might be the right choice, see [Why Moost?](/moost/why).

## Putting It All Together

Moost’s approach — metadata-driven, composable, and event-agnostic — offers you a powerful yet streamlined toolset. By understanding its key components (Wooks integration, DI, controllers, pipelines, interceptors, and logging), you can build scalable, maintainable, and testable applications that evolve with your requirements.
