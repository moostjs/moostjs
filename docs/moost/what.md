# What is Moost?

**Moost** is a next-generation, metadata-driven framework designed to simplify the development of server-side applications across various event types. Drawing inspiration from frameworks like [NestJS](https://nestjs.com/), Moost provides a similar, decorator-based experience — but with fewer layers of complexity, no compulsory modules, and direct integration with [Wooks](https://wooks.moost.org/wooks/what.html) and its [composables](https://wooks.moost.org/wooks/what.html#what-are-composables). This results in a cleaner, more maintainable codebase that reduces boilerplate and cognitive overhead.

## Key Principles

1. **Metadata Made Simple:**  
   Traditional frameworks often rely on cumbersome metadata systems. Moost uses [`@prostojs/mate`](https://github.com/prostojs/mate), a modern, TypeScript-friendly metadata tool, making it easier to create custom decorators and define the behavior of your controllers, methods, and parameters.

2. **[Dependency Injection](/moost/di/) Without Modules:**  
   Instead of enforcing modules as NestJS does, Moost leverages [`@prostojs/infact`](https://github.com/prostojs/infact) for dependency injection. This approach offers a global registry of instances without mandatory modules, supporting scoped replacements and straightforward unit testing.

3. **Not Just for HTTP:**  
   Although Moost can easily integrate with the HTTP ecosystem (using `@moostjs/event-http` on top of `@wooksjs/event-http`), it’s not limited to HTTP events alone. Moost builds on Wooks’ event-driven core, which can handle various event sources — such as CLI commands, workflows, or custom triggers. Moreover, Moost can run on top of Express, Fastify, h3, and other servers via Wooks adapters, ensuring maximum flexibility.

   *Learn more about Wooks [here](https://wooks.moost.org/wooks/what.html).*

## Features and Benefits

- **Decorator-Driven API:**  
  Moost uses decorators like `@Controller`, `@Get`, and `@Param` to define routes and parameters directly at the method level, mirroring NestJS’s approach but without the friction of modules. This enables concise, self-documenting code.

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

- **Flexible [Interceptors](/moost/interceptors):**  
  Interceptors can be attached globally, per-controller, or per-method, and can run at multiple stages (initialization, pre-handler, post-handler, and error). This consolidates middleware, guards, and logging into a single, powerful concept.

- **Validation with Zod:**  
  Integrating seamlessly with `@moostjs/zod`, Moost allows you to attach Zod schemas to class properties or parameters. Validation is transparent, type-safe, and baked into the request-handling lifecycle.

- **Automatic Swagger Documentation:**  
  With `@moostjs/swagger`, Moost can automatically produce an OpenAPI specification and serve a Swagger UI based on your decorators. This ensures your documentation is always up-to-date and consistent with your codebase.

- **Opentelemetry Integration:**  
  Moost supports injecting span context from Opentelemetry, allowing you to observe and trace performance metrics without additional overhead or boilerplate.

## Conclusion

Moost merges the decorator-driven, module-free simplicity you’ve been seeking with Wooks’ event-driven versatility and composable architecture. Whether you’re building HTTP APIs, CLI tools, or handling other event types, Moost provides a clean, maintainable, and scalable solution. It offers a NestJS-like experience — minus the complexity — while embracing the composable, extensible nature of Wooks.

If you’re looking for a framework that combines powerful metadata, flexible DI, and the ability to adapt to different event sources, Moost is an ideal choice.

## Discover More

Want to know more about how Moost works? Check out these handy guides:

- [Dependency Injection](/moost/di/): See how Moost takes care of dependencies.
- [Controllers](/moost/controllers): Find out more about these key pieces that manage events.
- [Resolver Decorators](/moost/resolvers): Learn about the decorators that help gather data.
- [Interceptors](/moost/interceptors): See how Moost processes events before they reach their handlers.
- [Metadata](/moost/meta/): Discover how Moost uses metadata to handle events.
- [Logging](/moost/logging): Learn about the tools Moost provides for tracking events.

Each guide will help you understand Moost better and make the most of its features. Enjoy exploring Moost!