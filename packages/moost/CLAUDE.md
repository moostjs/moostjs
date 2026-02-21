# CLAUDE.md — moost (core)

## Overview

Core framework package. Contains the Moost class, decorator system, DI integration, pipes, interceptors, adapter utilities, and composables. All other `@moostjs/*` packages depend on this.

## Key Files

- `src/moost.ts` — The `Moost` class (extends `Hookable`). Central orchestrator: manages adapters, controllers, pipes, interceptors, DI provide/replace registries
- `src/adapter-utils.ts` — `defineMoostEventHandler()` implementing the full event processing lifecycle
- `src/interceptor-handler.ts` — `InterceptorHandler` class with init/before/after/onError phases
- `src/define.ts` — `defineInterceptorFn()` and `definePipeFn()` helper factories
- `src/metadata/moost-metadata.ts` — `TMoostMetadata` interface and `getMoostMate()` singleton
- `src/metadata/infact.ts` — `getMoostInfact()`, DI container configuration (param/prop resolution via pipes)
- `src/binding/bind-controller.ts` — `bindControllerMethods()` wiring methods to adapters
- `src/pipes/` — Pipe system: `runPipes()`, `resolvePipe` (built-in RESOLVE pipe), `TPipePriority` enum
- `src/composables/controller.composable.ts` — `useControllerContext()` for accessing current controller in event scope

## Non-Obvious Patterns

**Moost itself is a controller.** In `init()`, `this` is prepended to the controllers list. Methods decorated with `@Get()` etc. directly on a `Moost` subclass become handlers.

**`@Controller` auto-sets `@Injectable`.** The `Controller` decorator calls `insureInjectable` internally — no need to also add `@Injectable()`.

**Interceptor after/onError use LIFO ordering.** Callbacks `.unshift()` into the array, creating an onion/wrap pattern where inner interceptors run closer to the handler.

**`resolvePipe` is the bridge between decorators and argument resolution.** All param decorators (`@Param`, `@Resolve`, `@Const`) set a `resolver` function in metadata. The built-in resolve pipe (at `RESOLVE` priority) invokes it. Without this pipe, nothing resolves.

**Fake instances for metadata reading.** `bindControllerMethods()` creates `Object.create(constructor.prototype)` to read method metadata without triggering constructor side effects.

**Singleton controllers are instantiated in a synthetic event context.** `bindController()` wraps singleton instantiation in `createAsyncEventContext({ event: { type: 'init' } })` because Infact and composables require an event context to exist.

**Pipe composition is always re-sorted.** Pipes merged from global + class + method + param levels are `.toSorted()` by priority each time, so they interleave by priority regardless of declaration order.

**`@ImportController` supports lazy loading.** Accepts `() => ControllerClass` for dynamic/async imports. In `bindController()`, non-constructor functions are awaited to resolve the class.

**`globalInterceptorHandler` is lazily cached and invalidated.** Both `applyGlobalPipes()` and `applyGlobalInterceptors()` clear the cache so the next call rebuilds it.

## Test Structure

Tests use `*.spec.ts` files with `*.artifacts.ts` fixtures. The E2E test (`src/tests/e2e.spec.ts`) runs a real MoostHttp server and tests the full lifecycle including DI scoping, nested controllers, and interceptors.
