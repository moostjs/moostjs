# Why Moost

::: warning
Work on Moost is still in progress. While it is suitable for out-of-the-box use, some APIs may undergo changes.
:::

When developing large enterprise applications, developers often
encounter challenges in maintaining their codebase.
The code becomes difficult to manage, leading to what is commonly
referred to as "legacy code" with a tangled mess of dependencies and complexities.

To address these issues, Moost offers a solution.
While it cannot completely eliminate all problems, Moost provides several
techniques that contribute to building robust applications and increasing
overall development speed.

## Understanding the Problems

Why does code become legacy and difficult to maintain?
There are several reasons:

-   _Poor initial design_: If the application is poorly designed with tightly coupled components, modifying one part can unintentionally break other parts.
-   _Accumulation of patches_: Well-designed applications can become burdened with numerous small patches that introduce spaghetti code.
-   _Complex structure_: Applications dealing with complex tasks can have intricate structures that make it challenging for developers to comprehend and work with.

Regardless of the reasons, the critical point is when code becomes fragile and tightly coupled.
What can be done to address this? One solution is to apply well-known software design principles,
such as the [SOLID](https://en.wikipedia.org/wiki/SOLID) principles, to keep applications in good shape over the long term.

Are there existing solutions that provide built-in support for common design patterns like the SOLID principles?
Yes, there is `nestjs`, which draws inspiration from `angular` and leverages decorators and metadata.
While `nestjs` offers a compelling approach to application development, its module system can be confusing.


## Moost's Approach
Moost draws inspiration from `nestjs` and also provides built-in support for common design patterns,
including the **SOLID** principles, to ensure applications are designed in an understandable,
flexible, and maintainable manner. However, Moost differentiates itself in the following ways:

-   _No additional modules abstraction_: Moost eliminates the need for an additional module abstraction, making it simpler and easier to work with and understand.
-   _Utilization of reusable dependency injection framework_: Moost leverages the reusable dependency injection framework [@prostojs/infact](https://github.com/prostojs/infact).
-   _Metadata layer with [@prostojs/mate](https://github.com/prostojs/mate)_: Moost employs a metadata layer powered by `@prostojs/mate`, enabling effortless interaction with metadata.
-   _Support for [DTOs](https://en.wikipedia.org/wiki/Data_transfer_object) and validations_: Moost supports DTOs and validations through [@prostojs/valido](https://github.com/prostojs/valido).
-   _Independence from `express` or `fastify`_: While Moost can be used with `express` or `fastify` via an adapter, it does not rely on these frameworks directly.
-   _Leveraging the power of **Wooks Composables**_: As Moost is built on top of [Wooks](https://wooksjs.org), it benefits from the powerful features provided by Wooks Composables.

Overall, Moost offers a solid foundation for developing large, scalable server-side applications.
Its utilization of `TypeScript` and `@Metadata` simplifies the learning curve for developers,
enabling them to quickly build robust applications.
