# Introduction to Moost

::: warning
Work on Moost is ongoing. While it is primed for immediate use, please note that some APIs may be subject to further enhancements.
:::

Moost, a metadata-driven event processing framework, is designed to streamline event handling within your applications. Built upon the robust foundation of [Wooks](https://wooks.moost.org), Moost leverages the power of Wooks' composable structure and functionality, transforming it into a versatile toolkit for event-processing applications.

### @ Decoding the Metadata Magic
Moost's innovative use of decorators to define metadata underpins its unique event processing flow. Decorators applied to classes and methods pave the way for the creation of controllers, interceptors, and event handlers, thereby simplifying the task of organizing and managing your application's event processing logic.

### 🚀 Embracing Controllers, Interceptors, and Event Handlers
Introducing the concept of controllers, interceptors, and event handlers, Moost makes event processing a breeze. Controllers serve as an organizing structure, grouping related event handlers together. Interceptors offer the possibility to intercept and modify events before they reach their assigned event handlers. Event handlers, being the heart of the operation, process events and execute the appropriate logic.

### 💉 Effortless Dependency Injection and Scoped Instances
One of the key offerings of Moost is its seamless support for dependency injection and scoped instances. Moost shoulders the responsibility of managing singletons and event-scoped instances, letting you concentrate on creating your application's business logic without the distraction of manual dependency management.

### 🧩 Customization and Extensibility
The true power of Moost lies in its customization capabilities. Whether you need to create custom decorators, add bespoke interceptors, or integrate with other libraries or frameworks, Moost's extensible nature is designed to meet your specific needs.

With its distinct metadata-driven approach, extensive dependency injection support, and array of features, Moost provides a simplified path to building powerful and scalable event-processing applications.

Ready to delve deeper into Moost's core concepts? Let's explore how you can effectively utilize controllers, interceptors, and event handlers in your applications.

## 🕸️ Craft your Web App with Moost HTTP

Building a web application with Moost is a seamless experience, thanks to the `@moostjs/event-http` package. It comes loaded with a complete suite of tools and features to facilitate the creation of web-based event-driven applications.

[Get Started with Web Application](/webapp/)

## 💻 Forge your CLI App with Moost CLI

For command-line interface (CLI) applications, `@moostjs/event-cli` is your go-to choice. With its focus on metadata-defined commands, it simplifies the creation of robust CLI tools.

[Get Started with CLI](/cliapp/)

## 📚 Learn More

Want to learn more about how Moost works? Check out these helpful guides:

- [Dependency Injection](/moost/di/): Understand how Moost manages dependencies.
- [Controllers](/moost/controllers): Learn about these key components that handle events.
- [Resolver Decorators](/moost/resolvers): Explore the decorators that help resolve data.
- [Interceptors](/moost/interceptors): Find out how Moost processes events before they reach their handlers.
- [Metadata](/moost/meta/): See how Moost uses metadata to handle events.
- [Logging](/moost/logging): Learn about the tools Moost provides for tracking events.

Each guide will give you a deeper understanding of Moost and how to use its features. Enjoy your journey with Moost!

