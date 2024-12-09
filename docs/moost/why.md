# Why Moost?

Moost was born out of frustration with the complexities and overhead found in existing frameworks like NestJS. While NestJS’s decorator-driven approach and rich ecosystem are appealing, its reliance on modules, intricate metadata patterns, and multi-layered structure can feel overwhelming — especially for smaller projects or developers who value simplicity.

**Key Motivations Behind Moost:**

1. **Reducing Boilerplate:**  
   In NestJS, setting up a simple controller often means creating multiple files and classes — modules, providers, and controllers — just to return a response. Moost’s design eliminates these extra steps, allowing you to define your application’s behavior more directly and minimize repetitive scaffolding.

2. **Simplifying Decorators and Metadata:**  
   Creating a custom decorator in NestJS can be cumbersome due to the complexity of its metadata system. Moost leverages [`@prostojs/mate`](https://github.com/prostojs/mate) for a more intuitive, TypeScript-friendly metadata mechanism. This makes it easier to build and extend decorators, so you can quickly implement new features without wrestling with low-level details.

3. **Ditching Modules for a Leaner DI Model:**  
   The module-centric architecture of NestJS adds cognitive load and can feel restrictive. Moost opts for a straightforward, global instance registry approach, powered by [`@prostojs/infact`](https://github.com/prostojs/infact). This means you can set up dependencies without mentally juggling multiple layers or module boundaries.

4. **Composables Over Middleware:**  
   Instead of forcing you into a complex middleware chain, Moost encourages composables and interceptors, building on the flexible, event-driven core of Wooks. With composables, you only enable what you need, when you need it, reducing hidden complexity and improving performance.

5. **Adhering to SOLID Principles:**  
Both NestJS and Moost encourage building applications that respect SOLID principles — separating concerns, using dependency injection, and defining clear boundaries between components. Moost takes these principles one step further by stripping away extraneous modules and scaffolding, allowing you to apply SOLID patterns without extra complexity.
   

**In Essence:**  
Moost was created to preserve the best parts of NestJS’s decorator-driven philosophy — type safety, expressiveness, and a familiar coding style — while removing the elements that often feel like unnecessary ceremony. If you’ve ever wished for a leaner, more direct way to build server-side applications without sacrificing clarity or power, Moost is the answer.
