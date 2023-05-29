# Welcome to Moost

::: warning
Moost is an ongoing project. It's ready to use, but be aware that we're still working on improving some of its parts.
:::

Moost is a smart tool designed to help you handle events in your applications more efficiently. It's built on [Wooks](https://wooksjs.org), which gives it a lot of flexibility and power. 

### @ The Magic of Metadata
Moost uses something called "decorators" to define metadata, which is what makes its event handling so special. Decorators can be applied to classes and methods, helping you set up controllers, interceptors, and event handlers. This makes managing your application's events much easier.

### 🚀 Controllers, Interceptors, and Event Handlers
Moost introduces controllers, interceptors, and event handlers to make handling events super simple. Controllers group related event handlers together, making things more organized. Interceptors can change events before they reach their handlers. Event handlers then take care of the events, executing the right logic.

### 💉 Easy Dependency Injection and Scoped Instances
Another great thing about Moost is how it handles dependency injection and scoped instances. It takes care of managing singletons and event-scoped instances for you, so you can focus on the important stuff - like building your application's business logic.

### 🧩 Customize to Your Heart's Content
Moost is super flexible, which means you can customize it to fit your needs. Whether you want to create custom decorators, add your own interceptors, or integrate with other libraries or frameworks, Moost has got you covered.

## 🕸️ Build Web Apps with Moost HTTP

Creating a web application with Moost is a snap, thanks to the `@moostjs/event-http` package. It comes with everything you need to build web-based event-driven applications.

[Start Building Web Applications](/webapp/)

## 💻 Create CLI Apps with Moost CLI

For command-line interface (CLI) applications, you'll want to use `@moostjs/event-cli`. It focuses on metadata-defined commands, which makes building robust CLI tools easy.

[Start Building CLI](/cliapp/)

## 📚 Discover More

Want to know more about how Moost works? Check out these handy guides:

- [Dependency Injection](/moost/di/): See how Moost takes care of dependencies.
- [Controllers](/moost/controllers): Find out more about these key pieces that manage events.
- [Resolver Decorators](/moost/resolvers): Learn about the decorators that help gather data.
- [Interceptors](/moost/interceptors): See how Moost processes events before they reach their handlers.
- [Metadata](/moost/meta/): Discover how Moost uses metadata to handle events.
- [Logging](/moost/logging): Learn about the tools Moost provides for tracking events.

Each guide will help you understand Moost better and make the most of its features. Enjoy exploring Moost!
