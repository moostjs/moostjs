# Moost Adapters

This page provides an in-depth overview of adapters in Moost, including their purpose, usage, available adapters.

[[toc]]

## Overview

At its core, Moost is encapsulated within the `Moost` class, serving primarily as a container for global-level providers, replace registries, pipes, and other essential components. Unlike traditional frameworks, Moost itself does not handle any events directly. Instead, it relies on **Adapters** to connect with specific event processing implementations based on the [Wooks](https://github.com/wooksjs/wooks) event processing library.

Adapters are pivotal in enabling Moost to interact seamlessly with various event sources and handling mechanisms, such as HTTP requests, command-line interfaces (CLI), and workflow engines. By abstracting the event processing logic, adapters allow developers to focus on business logic while leveraging Moost's robust infrastructure.

## Purpose

Adapters in Moost serve the following primary purposes:

- **Event Processing Integration:** Connect Moost with different event processing systems, enabling it to handle diverse event types.
- **Flexibility:** Allow developers to switch or combine multiple event processing mechanisms without altering the core application logic.
- **Extensibility:** Facilitate the creation of custom adapters tailored to unique event processing requirements.

## Available Adapters

Moost currently offers three built-in adapters, each catering to different event processing requirements. These adapters can be registered with the Moost application to enable corresponding event handling capabilities.

### 1. [HTTP Adapter](/webapp/)

The **HTTP Adapter** connects Moost with HTTP-based event processing, allowing the framework to handle HTTP requests seamlessly.

### 2. [CLI Adapter](/cliapp/)

The **CLI Adapter** enables Moost to process command-line interface events, making it suitable for building CLI applications.

### 3. [Workflow Adapter](/wf/)

The **Workflow Adapter** connects Moost with workflow engines, enabling the framework to manage complex workflows and orchestrations.

## Using Adapters

Adapters are integral to Moost's architecture, and their registration is straightforward. This section outlines how to register adapters with the Moost application, including examples and best practices.

### Registering an Adapter

To register an adapter with Moost, instantiate the adapter and pass it to the Moost application using the `.adapter()` method. Below is a generic example:

```ts
import { Moost } from 'moost';
import { MoostHttp } from '@moostjs/event-http';
import { AppController } from './controllers/app.controller';

const app = new Moost();

// Register the HTTP adapter
app.adapter(new MoostHttp());

// Register controllers
app.registerControllers(AppController).init();

// Start listening for events (e.g., HTTP requests)
app.listen(3000).then(() => {
  console.log('Server is running on port 3000');
});
```

**Explanation:**

1. **Importing Moost and Adapter:**
   - Import the `Moost` class from the `moost` package.
   - Import the desired adapter, such as `MoostHttp` from `@moostjs/event-http`.

2. **Instantiating Moost:**
   - Create a new instance of the Moost application.

3. **Registering the Adapter:**
   - Use the `.adapter()` method to register the adapter with the Moost instance.

4. **Registering Controllers:**
   - Register your application controllers using `.registerControllers()` and initialize them with `.init()`.

5. **Starting the Adapter:**
   - Invoke `.listen()` with the appropriate port or configuration to start the adapter's event processing.

### Registering Multiple Adapters

Moost supports the registration of multiple adapters simultaneously, allowing your application to handle various event sources concurrently. Each adapter operates independently, enabling complex and multifaceted event processing scenarios.

```ts
import { Moost } from 'moost';
import { MoostHttp } from '@moostjs/event-http';
import { MoostCli } from '@moostjs/event-cli';
import { AppController } from './controllers/app.controller';

const app = new Moost();

// Register the HTTP adapter
app.adapter(new MoostHttp());

// Register the CLI adapter
app.adapter(new MoostCli());

// Register controllers
app.registerControllers(AppController).init();

// Start listening for events (e.g., HTTP requests and CLI commands)
app.listen(3000).then(() => {
  console.log('Server is running on port 3000');
});
```
