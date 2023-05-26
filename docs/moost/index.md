# Introduction to Moost

::: warning
Work on Moost is still in progress. While it is suitable for out-of-the-box use, some APIs may undergo changes.
:::

## Overview

Moost is a metadata-driven event processing framework that provides a unified approach to handling events in your applications.
Built on top of [Wooks](https://wooksjs.org), Moost leverages Wooks' composables and features, making it a powerful and flexible framework for event-processing apps.

### @ Metadata-Driven Approach
Moost relies on decorators to define metadata that drives the event processing flow.
By decorating classes and methods with specific decorators, you can define controllers, interceptors, and event handlers, making it easy to organize and manage your application's event processing logic.

### 🚀 Controllers, Interceptors, and Event Handlers
Moost introduces the concept of controllers, interceptors, and event handlers to streamline event processing.
Controllers group related event handlers together and provide a clear structure for organizing your application's logic.
Interceptors allow you to intercept and modify events before they reach the event handlers.
Event handlers are the core components that process events and execute the desired logic.

### 💉 Dependency Injection and Scoped Instances
One of Moost's key features is its built-in support for dependency injection and scoped instances.
It takes care of managing singletons, event-scoped instances, and other dependencies, allowing you to focus on writing your application's business logic without worrying about managing dependencies manually.

### 🧩 Extensibility
Moost is highly extensible, allowing you to customize and extend its functionality to fit your specific needs.
You can create your own decorators, add custom interceptors, and even integrate with other frameworks or libraries to enhance Moost's capabilities.

With Moost, you can build robust and scalable event-processing applications with ease, thanks to its metadata-driven approach, support for dependency injection, and extensive feature set.

Next, let's dive into the core concepts of Moost and explore how to effectively use controllers, interceptors, and event handlers in your applications.

## 🕸️ Build your Web App with Moost HTTP

If you're building a web application and want to handle events through HTTP requests,
`@moostjs/event-http` is the package to use.
It provides a comprehensive set of tools and features to create web-based event-driven applications with ease.

[Get Started with Web Application](/webapp/)

## 💻 Build your CLI App with Moost CLI

For command-line interface (CLI) applications that rely on event processing, `@moostjs/event-cli` is the ideal choice.
It enables you to build robust CLI tools based on metadata defined commands.

[Get Started with CLI](/cliapp/)
