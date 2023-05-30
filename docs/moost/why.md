# Why Moost

::: warning
Moost is an ongoing project. It's ready to use, but be aware that we're still working on improving some of its parts.
:::

Building big enterprise applications can feel like navigating a jungle of code. As the codebase grows, it often becomes a jumbled mess, making it harder and harder to understand and maintain. This is what we call "legacy code."

This is where Moost comes in. Moost helps developers tackle this issue and makes it easier to build strong, fast applications without falling into the legacy code trap.

## The Problems

Why does code become this big, difficult-to-manage mess? Here are a few reasons:

-   _Poor initial design_: If you don't carefully plan how different parts of your application interact with each other, you can end up with a delicate system where changing one part can accidentally break another.
-   _Too many patches_: Even a well-designed application can become confusing if it has too many small patches added on top of it.
-   _Complex structures_: Some applications are just complex by nature, and this can make them challenging to work with.

When your code becomes fragile and everything is too interconnected, you know you're in trouble. The solution is to use good software design principles, like the [SOLID](https://en.wikipedia.org/wiki/SOLID) principles, to keep your applications flexible and healthy in the long run.

There are solutions like `nestjs`, inspired by `angular`, that support good design principles using decorators and metadata. But `nestjs` also has a module system that can be hard to understand.

## The Moost Solution

Like `nestjs`, Moost supports good design principles, including SOLID. This helps you create applications that are easy to understand, flexible, and maintainable. But Moost offers some extra advantages:

-   _No unnecessary module abstractions_: Moost keeps things simple and user-friendly by getting rid of confusing module abstractions.
-   _Reusable dependency injection_: Moost uses [@prostojs/infact](https://github.com/prostojs/infact), a powerful tool for managing dependencies.
-   _Metadata layer with [@prostojs/mate](https://github.com/prostojs/mate)_: Moost includes a handy metadata layer, making it easier to work with metadata.
-   _Support for [DTOs](https://en.wikipedia.org/wiki/Data_transfer_object) and validations_: Moost helps you manage data transfer objects (DTOs) and validate your data with [@prostojs/valido](https://github.com/prostojs/valido).
-   _Framework independence_: Moost can work with `express` or `fastify`, but it doesn't depend on them directly.
-   _Built on the **Wooks Composables** foundation_: Moost is built on [Wooks](https://wooks.moost.org), so you can benefit from all the features offered by Wooks Composables.

In short, Moost gives you a solid foundation for building big, scalable server-side applications. It leverages the power of `TypeScript` and `@Metadata` to make development easier and faster. With Moost, you can leave the legacy code behind and enjoy a smoother, more manageable coding experience!