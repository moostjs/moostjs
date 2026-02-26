# Why Moost?

## The Origin

We liked what NestJS did for Node.js — decorators, dependency injection, a structured approach to building servers. But the execution felt heavy. Modules wrapping modules. Providers arrays that repeat the same class in three places. A metadata system that's hard to extend. And the whole thing locked to HTTP, with awkward workarounds for anything else.

[Wooks](https://wooks.moost.org/wooks/what) solved the composable side — typed, per-event data without middleware. But it was still a functional framework: plain functions, no DI, no decorator-driven structure. The natural next step was: **what if you could have NestJS-style decorators and DI on top of Wooks, without the complexity?**

## The Design Decisions

### No modules

NestJS requires you to organize code into modules — each declaring its imports, exports, providers, and controllers. For large apps this adds structure, but for most projects it adds ceremony. Moost has no module concept. You register controllers directly and the DI container resolves dependencies globally. Less indirection, fewer files, faster onboarding.

### Composables over middleware

Traditional frameworks parse headers, cookies, and body in middleware — before your handler runs, whether it needs the data or not. Moost inherits Wooks' composable model: call `useRequest()`, `useCookies()`, or `useBody()` inside your handler and get typed data on demand. Nothing runs until you ask for it.

### Decorators that work

Moost uses [`@prostojs/mate`](https://github.com/prostojs/mate) for metadata — a typed, extensible system where creating a custom decorator is a few lines of code. You don't need to understand `Reflect.metadata` internals or write boilerplate adapter layers. Decorators read and write typed metadata, and the framework consumes it at init time.

### One framework, many event types

HTTP, CLI, WebSocket, and workflows share the same core: controllers, DI, interceptors, pipes. Write an auth guard once and apply it to an HTTP endpoint, a WebSocket message handler, and a CLI command. Adapters handle the transport differences — your business logic stays the same.

### SOLID without the weight

Both Moost and NestJS encourage clean architecture — dependency injection, separation of concerns, single responsibility. The difference is how much scaffolding you need. Moost lets you apply these principles directly, without module hierarchies or provider registration rituals.

## When to use Moost

Moost fits when you want NestJS-style structure — decorators, DI, interceptors — without the module system and boilerplate. It's a good choice when your app handles multiple event types (HTTP + CLI, HTTP + WebSocket), when you want composable access to event data, or when you value TypeScript ergonomics and explicit code over framework magic.
