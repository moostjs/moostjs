---
name: moost
description: Use this skill when working with moost — to create a Moost application, register controllers with @Controller(), build custom event adapters implementing TMoostAdapter, use defineMoostEventHandler() to bridge event sources, define routes with decorators, configure dependency injection with @Injectable()/@Inject()/@Provide(), create interceptors with @Intercept() and InterceptorHandler, build pipe pipelines with @Pipe()/@Resolve(), access metadata with getMoostMate(), or understand the adapter pattern used by MoostHttp, MoostWs, and MoostWf.
---

# moost

Moost is a metadata-driven event processing framework for TypeScript. It uses decorators and a composable architecture (powered by Wooks) to handle HTTP, CLI, WebSocket, and Workflow events — or any custom event type via the adapter pattern.

## How to use this skill

Read the domain file that matches the task. Do not load all files — only what you need.

| Domain | File | Load when... |
|--------|------|------------|
| Core concepts & setup | [core.md](core.md) | Starting a new project, understanding the Moost class, registering controllers, configuring adapters |
| Custom adapters | [custom-adapters.md](custom-adapters.md) | Building a new event adapter implementing TMoostAdapter, using defineMoostEventHandler, understanding bindHandler lifecycle |
| Decorators & metadata | [decorators.md](decorators.md) | Creating or using decorators, reading/writing metadata with getMoostMate(), defining handler types |
| Dependency injection | [di.md](di.md) | Configuring DI scopes, @Injectable, @Inject, @Provide, @Circular, createProvideRegistry |
| Interceptors | [interceptors.md](interceptors.md) | Creating interceptors, understanding priority levels, @Intercept, InterceptorHandler lifecycle |
| Pipes & resolvers | [pipes.md](pipes.md) | Building pipes, @Pipe, @Resolve, validation/transform stages, argument resolution |

## Quick reference

```ts
import { Moost, Controller, Param, Intercept, Injectable, Resolve } from 'moost'
import { defineMoostEventHandler, getMoostMate, createProvideRegistry } from 'moost'
import type { TMoostAdapter, TMoostAdapterOptions } from 'moost'

const app = new Moost()
app.adapter(myAdapter)          // attach event adapter
app.registerControllers(MyCtrl) // register controllers
await app.init()                // bind all handlers, call adapter.onInit()
```
