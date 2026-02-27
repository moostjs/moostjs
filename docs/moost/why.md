# Why Moost?

## The Short Version

If you like what NestJS brought to Node.js — structure, decorators, dependency injection — but find yourself fighting the framework more than using it, Moost might be what you're after.

## How We Got Here

NestJS showed that Node.js servers could be well-structured. But over time, the overhead adds up. Modules wrapping modules. The same class name repeated in three different arrays. A metadata system that's hard to extend. And when you need something beyond HTTP — a CLI tool, a workflow engine — the story gets complicated.

[Wooks](https://wooks.moost.org/wooks/what) took a different path: composable, typed access to event data without middleware chains. But it was purely functional — no DI, no decorator-driven structure. Moost bridges the gap: **NestJS-style architecture on top of Wooks, without the ceremony.**

## What's Different

### Just register your controllers

NestJS asks you to wrap everything in modules — imports, exports, providers, controllers. For most projects, that's boilerplate. In Moost, you register controllers directly and the DI container figures out the rest. Fewer files, less indirection.

### Data on demand

Traditional middleware parses headers, cookies, and request bodies upfront — whether your handler needs them or not. Moost inherits Wooks' composable model: call `useRequest()`, `useCookies()`, or `useBody()` inside your handler and get typed data only when you ask for it. This also means better performance — nothing is computed until it's needed.

### Easy custom decorators

Moost's metadata layer ([`@prostojs/mate`](https://github.com/prostojs/mate)) makes creating custom decorators straightforward — a few lines of typed code. No `Reflect.metadata` internals, no adapter boilerplate.

### Beyond HTTP

HTTP, CLI, WebSocket, and workflows all share the same core: controllers, DI, interceptors, pipes. Write an auth guard once, use it everywhere. Adapters handle the transport differences so your business logic doesn't have to.

### Fast by default

Moost's DI layer adds roughly **half the overhead** of NestJS's. Combined with Wooks' lazy parsing, it's consistently faster across realistic workloads. Details in the [benchmark results](/webapp/benchmarks).

## When to Choose Moost

- You want structured, decorator-driven code without the module boilerplate
- Your app spans multiple event types (HTTP + CLI, HTTP + WebSocket)
- You prefer explicit composable functions over implicit middleware
- You value TypeScript ergonomics and want decorators that are easy to extend
