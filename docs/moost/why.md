# Why Moost

::: warning
Work on Moost is ongoing. While it is primed for immediate use, please note that some APIs may be subject to further enhancements.
:::

In the journey of crafting large-scale enterprise applications, developers frequently grapple with the daunting task of managing a sprawling codebase. As the code grows, it often morphs into a tangled maze of dependencies and complexities, earning the infamous tag of "legacy code." 

Enter Moost, a comprehensive solution designed to tackle these predicaments head-on. Moost equips developers with an array of techniques to streamline the creation of robust applications and turbocharge development speed, without the fear of legacy code.

## The Roadblocks 

Why does code morph into a legacy beast and become a nightmare to maintain? The culprits are many:

-   _Faulty initial design_: An application, designed without due consideration to component coupling, often leads to a fragile system where modifying one part may unintentionally wreak havoc on others.
-   _The patch overload_: Even a well-designed application may buckle under the weight of countless small patches, leading to a spaghetti code situation.
-   _Intricate structures_: Applications tasked with complex assignments often develop complicated structures, posing formidable challenges to developers.

Regardless of the cause, the red flag is raised when code turns fragile and the components become inextricably linked. The solution? Employing proven software design principles, such as the [SOLID](https://en.wikipedia.org/wiki/SOLID) principles, to ensure the long-term health and flexibility of applications.

Several solutions like `nestjs`, which is inspired by `angular`, offer built-in support for common design patterns like the SOLID principles using decorators and metadata. However, `nestjs`, while an impressive solution, has a module system that can prove baffling.

## Moost's Edge

Moost, much like `nestjs`, provides built-in support for common design patterns, including the SOLID principles, thus ensuring the creation of comprehensible, flexible, and maintainable applications. However, Moost differentiates itself through:

-   _Elimination of superfluous module abstractions_: Moost does away with unnecessary module abstractions, making the framework simpler, more intuitive, and user-friendly.
-   _Adoption of a reusable dependency injection framework_: Moost harnesses the power of [@prostojs/infact](https://github.com/prostojs/infact), a robust dependency injection framework.
-   _Incorporation of a metadata layer via [@prostojs/mate](https://github.com/prostojs/mate)_: Moost integrates a powerful metadata layer, enabling seamless interaction with metadata.
-   _Support for [DTOs](https://en.wikipedia.org/wiki/Data_transfer_object) and validations_: Moost incorporates support for DTOs and validations using [@prostojs/valido](https://github.com/prostojs/valido).
-   _Framework Independence_: Moost does not directly rely on `express` or `fastify`, but it can be used with these frameworks via an adapter.
-   _Leveraging the strength of **Wooks Composables**_: Built on the [Wooks](https://wooksjs.org) foundation, Moost reaps the benefits of the powerful features provided by Wooks Composables.

In essence, Moost offers a sturdy foundation for constructing large, scalable server-side applications. By harnessing the capabilities of `TypeScript` and `@Metadata`, it simplifies the learning curve for developers, empowering them to rapidly build resilient applications. Choose Moost and say goodbye to the era of legacy code. Welcome to streamlined, maintainable coding!