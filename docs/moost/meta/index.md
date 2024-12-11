
# Introduction to Metadata in Moost

Metadata is a foundational concept in Moost, enabling a declarative and extensible approach to configuring and enhancing your application’s behavior. Powered by the [`@prostojs/mate`](https://github.com/prostojs/mate) library, Moost’s metadata system allows developers to attach additional attributes to classes, methods, properties, and parameters through decorators. These attributes can be accessed and manipulated at runtime, facilitating a wide range of functionalities from routing and dependency injection to validation and interception.

## What Is Metadata in Moost?

In Moost, metadata serves as a mechanism to enrich your code elements with supplementary information without cluttering your business logic. By using decorators, you can declaratively specify configurations, behaviors, and constraints directly within your codebase. This approach promotes cleaner, more maintainable, and highly customizable server-side applications.

## Core Capabilities

- **Decorator-Driven Configuration:**  
  Attach metadata to classes, methods, properties, and parameters using decorators like `@Controller`, `@Get`, `@Injectable`, and more.

- **Runtime Accessibility:**  
  Access and manipulate metadata during runtime to dynamically influence application behavior based on the attached attributes.

- **Extensibility:**  
  Extend Moost’s functionality by creating custom decorators and metadata, tailored to your specific application needs.

- **Metadata Inheritance:**  
  Support for inheriting metadata from superclass to subclass, allowing for reusable and hierarchical configurations.

## Key Use Cases

- **Routing:**  
  Define HTTP routes and associate them with handler methods using decorators such as `@Get`, `@Post`, etc.

- **Dependency Injection (DI):**  
  Manage dependencies seamlessly with decorators like `@Injectable` and `@Inject`, enabling easy injection of services and repositories.

- **Validation:**  
  Attach validation schemas to Data Transfer Objects (DTOs) using decorators from packages like `@moostjs/zod`, ensuring data integrity before it reaches your handlers.

- **Interceptors:**  
  Apply cross-cutting concerns such as logging, authentication, or transformation logic around your handlers using decorators like `@Interceptor`.

- **General-Purpose Metadata:**  
  Use decorators like `@Id`, `@Label`, and `@Description` to add descriptive metadata to various code elements, enhancing documentation and tooling support.

## Customization and Extensibility

Moost’s metadata system is highly customizable, allowing advanced users to extend its capabilities through custom metadata. This is particularly useful when building additional modules or integrating with other libraries. By defining your own metadata interfaces and decorators, you can tailor Moost to fit unique application requirements.

For more details on customizing metadata, refer to the [Customizing Metadata](./customizing-metadata.md) and [General-Purpose Metadata](./general-purpose-metadata.md) documentation pages.

## Metadata Inheritance

Moost supports metadata inheritance, enabling subclasses to inherit metadata from their superclasses. This feature promotes reusability and consistency across your application’s components. By using decorator `@Inherit`, you can ensure that common metadata attributes are propagated through your class hierarchies.

Learn more about metadata inheritance in the [Metadata Inheritance](./metadata-inheritance.md) guide.

## Summary

Moost’s metadata system, powered by [`@prostojs/mate`](https://github.com/prostojs/mate), provides a flexible and powerful way to annotate and configure your application components. By leveraging decorators to attach metadata, you can create cleaner, more maintainable, and highly customizable server-side applications. Whether you’re utilizing built-in decorators for routing, DI, validation, and interception, or crafting your own custom decorators to extend Moost’s functionality, the metadata system is integral to building robust and scalable applications with Moost.

For deeper insights and practical guides, explore the following documentation pages:
- [General-Purpose Metadata](./general-purpose-metadata.md)
- [Customizing Metadata](./customizing-metadata.md)
- [Metadata Inheritance](./metadata-inheritance.md)
