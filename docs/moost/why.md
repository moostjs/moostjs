# Why Moost?

Moost emerged from a desire to simplify server-side development — especially after experiencing the heaviness of frameworks like [NestJS](https://nestjs.com). While NestJS’s decorators and ecosystem are impressive, its mandatory modules, multi-layered architecture, and opaque metadata system can feel cumbersome, particularly for projects where agility and clarity are paramount.

**Key Motivations Behind Moost:**

1. **Less Boilerplate, More Productivity:**  
   In NestJS, defining even a simple endpoint can involve creating modules, providers, and controllers. Moost streamlines this process by eliminating unnecessary layers. Its design lets you focus on what matters most — your application’s logic — without the overhead of modules and extensive boilerplate.

2. **Intuitive Decorators and Metadata:**  
   NestJS’s metadata model can be hard to customize. Moost leverages [`@prostojs/mate`](https://github.com/prostojs/mate) for a TypeScript-friendly approach, making it straightforward to create and extend decorators. You can implement new features quickly without diving deep into low-level metadata details.

3. **A Leaner Dependency Injection Model:**  
   Instead of forcing your code into a module-centric DI structure, Moost offers a global instance registry powered by [`@prostojs/infact`](https://github.com/prostojs/infact). This design reduces cognitive load: you register instances once, and Moost takes care of providing them when needed. No more juggling multiple files or mental overhead just to inject a service.

4. **Composables Over Middleware:**  
   Many frameworks rely on complex middleware chains that run behind the scenes. Moost, however, builds on [Wooks](https://wooks.moost.org) and its concept of [composables](https://wooks.moost.org/wooks/what.html#what-are-composables) — small, focused functions that interact with the event context. Composables let you tap into and manipulate request state on-demand. This makes it easier to:
   - Inject logic exactly where it’s needed.
   - Build custom decorators that read or modify event data without global side effects.
   - Keep performance high by only enabling features when required.

   By using composables rather than rigid middleware stacks, Moost empowers you to structure your application as a collection of lightweight, reusable, and easily testable functions.

5. **SOLID Principles Without Extra Complexity:**  
   Both NestJS and Moost encourage building applications that respect SOLID principles — clean boundaries, dependency injection, and separation of concerns. Moost allows you to apply these principles more directly, without wrestling with modules or layered configurations. By focusing on simplicity, Moost enables you to write code that’s cleaner, clearer, and easier to maintain.

**In Essence:**  
Moost was created to keep the best parts of NestJS’s decorator-driven, type-safe approach — such as familiar syntax, strong typing, and a rich ecosystem — while discarding the complexities that can bog you down. If you’ve ever wanted the power of decorators, DI, and SOLID principles without the baggage of layered modules and hidden complexity, Moost provides a direct, composable, and flexible path forward.
