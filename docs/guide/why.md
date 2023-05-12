# Why Moost

::: warning
The work on Moost is still in progress. It is already suitable for
out-of-the-box use for HTTP events, but some of the APIs can still change.
:::

When building large enterprise applications developers often
come to the point when the code becomes very hard to maintain.
They start to call it "legacy code" which has lots of "spaghetti" in it 🍝.

With the help of Moost we want to avoid that. Is it guaranteed
that we can avoid all the problems? Of course not. But Moost provides
several techniques that help building robust applications and increase overall speed of development.

## The problems

Why does the code become legacy and hard to maintain?
Well, there are several reasons:

-   It could be that the app was initially poorly designed with tightly coupled components, the code then is fragile: you touch one piece -> another piece is broken.
-   Sometimes well-designed app can be spoiled with lots of small patches that create spaghetti code.
-   It could also be that the app structure is extremely complex due to complex tasks that it solves, so developers can't physically trace all the complexity when working on it.

Whatever happens to your application, it's good until the code becomes fragile and tightly coupled. What can we do about that?
There is well-known [SOLID](https://en.wikipedia.org/wiki/SOLID) principles that we can apply to our code to keep our apps in a good shape for a long run.

Is there already a solution that has built-in support for common design patterns such as the SOLID principles?
Yes, it's `nestjs`, ispired by `angular` and decorators and metadata.
Although it has extremely confusing system of modules, it provides a very nice approach for apps development.

## What's the difference with Moost?

Moost was inspired by `nestjs` and also has built-in support for common design patterns
such as the SOLID principles, which can help to ensure that the application is designed in a way
that is easy to understand, flexible, and maintainable.

At the same time Moost is different:

-   It does not use additional `modules` abstraction (like `angular` or `nestjs`). It's much easier to work with and to understand.
-   It utilizes reusable dependency injection framework [@prostojs/infact](https://github.com/prostojs/infact).
-   It uses metadata layer powered by [@prostojs/mate](https://github.com/prostojs/mate). It was never as easy to work with metadata.
-   It supports [DTOs](https://en.wikipedia.org/wiki/Data_transfer_object) and validations powered by [@prostojs/valido](https://github.com/prostojs/valido).
-   It does not use `express` or `fastify` (although you can use express/fastify via an adapter).
-   As Moost is built on top of [Wooks](https://wooksjs.org) it benefints from power of Wooks Composables.

Overall, Moost provides a solid foundation for building large, scalable server-side applications,
and its use of TypeScript and @Metadata makes it easy for developers to quickly get up to speed
and start building large applications.
