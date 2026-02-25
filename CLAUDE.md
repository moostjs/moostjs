# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Moost?

Moost is a metadata-driven Event Processing Framework for TypeScript, inspired by NestJS and powered by Wooks. It uses TypeScript decorators (legacy/experimental) to simplify application design across HTTP, CLI, and Workflow event types. Unlike NestJS, it has no module abstraction — controllers are registered directly with the Moost instance.

## Commands

| Command               | Description                                                                    |
| --------------------- | ------------------------------------------------------------------------------ |
| `pnpm build`          | Build all packages (types via tsc+rollup-plugin-dts, bundles via rolldown+swc) |
| `pnpm build <folder>` | Build a single package by its folder name under packages/                      |
| `pnpm test`           | Run all tests once with vitest                                                 |
| `pnpm test:watch`     | Run tests in watch mode                                                        |
| `pnpm test:cov`       | Run tests with coverage                                                        |
| `pnpm lint`           | Lint with oxlint                                                               |
| `pnpm lint:fix`       | Lint and auto-fix with oxlint                                                  |
| `pnpm format`         | Format with oxfmt                                                              |
| `pnpm format:check`   | Check formatting with oxfmt                                                    |

To run a single test file: `pnpm vitest run -c ./vitest.config.js <path-to-spec>`

## Monorepo Structure

pnpm workspace with all packages under `packages/`. All packages share the same version number (currently 0.5.33), use `"type": "module"`, and ship dual ESM/CJS outputs.

| Package folder | npm name              | Purpose                                                          |
| -------------- | --------------------- | ---------------------------------------------------------------- |
| `moost`        | `moost`               | Core framework: Moost class, decorators, DI, pipes, interceptors |
| `event-http`   | `@moostjs/event-http` | HTTP adapter wrapping `@wooksjs/event-http`                      |
| `event-cli`    | `@moostjs/event-cli`  | CLI adapter wrapping `@wooksjs/event-cli`                        |
| `event-wf`     | `@moostjs/event-wf`   | Workflow adapter wrapping `@wooksjs/event-wf`                    |
| `swagger`      | `@moostjs/swagger`    | Swagger/OpenAPI integration                                      |
| `otel`         | `@moostjs/otel`       | OpenTelemetry tracing                                            |
| `arbac`        | `@moostjs/arbac`      | RBAC/ABAC access control                                         |
| `vite`         | `@moostjs/vite`       | Vite dev plugin                                                  |
| `create-moost` | `create-moost`        | CLI scaffolding tool                                             |

## Architecture

### Core Libraries (external, from @prostojs and @wooksjs)

- **@prostojs/mate** — Metadata/decorator management. All decorators go through `getMoostMate()` which returns a singleton `Mate` instance operating in the `'moost'` metadata workspace.
- **@prostojs/infact** — Dependency injection container. Supports `SINGLETON` and `FOR_EVENT` scopes. Accessed via `getMoostInfact()`.
- **@wooksjs/event-core** — Async event context (composable pattern, similar to Vue Composition API but for server-side events).
- **@prostojs/dye** — Terminal colors via compile-time constants (`__DYE_RED__`, etc.) replaced at build time by rolldown plugin.

### Adapter Pattern

Each event type (HTTP, CLI, Workflow) has an adapter class implementing `TMoostAdapter<H>`. Adapters are attached via `app.adapter(adapterInstance)` and implement `bindHandler()` to register routes/commands with their underlying Wooks engine.

### Decorator System

Key decorators: `@Controller(prefix?)`, `@ImportController(ctrl)`, `@Injectable(scope)`, `@Get()/@Post()/@Put()/@Delete()` (HTTP), `@Cli(path)` (CLI), `@Param()/@Params()`, `@Resolve(fn)`, `@Intercept(handler)`, `@Pipe(fn)`, `@Provide()/@Inject()`, `@Circular(() => Type)`.

### Pipes Pipeline

Pipes transform/resolve/validate values in priority order:
`BEFORE_RESOLVE → RESOLVE → AFTER_RESOLVE → BEFORE_TRANSFORM → TRANSFORM → AFTER_TRANSFORM → BEFORE_VALIDATE → VALIDATE → AFTER_VALIDATE`

### Interceptor Lifecycle

`init (can short-circuit) → before (can reply early) → handler execution → after/onError`

Priority levels: `BEFORE_ALL`, `BEFORE_GUARD`, `GUARD`, `AFTER_GUARD`, `INTERCEPTOR`, `CATCH_ERROR`, `AFTER_ALL`.

### Event Handler Lifecycle (defineMoostEventHandler)

1. Scope registration and logger setup
2. Controller resolution (DI)
3. Interceptor init phase
4. Argument resolution via pipes
5. Interceptor before phase
6. Handler method execution
7. Interceptor after/onError phase
8. Scope cleanup

## Build System

Custom build script (`scripts/build.js`) using:

- **Rolldown** (bundler) + **unplugin-swc** (decorator transpilation) + **@prostojs/dye/rolldown** (compile-time color replacement) for JS bundles
- **tsc** (declaration emit to `.types/`) + **rollup-plugin-dts** (bundle declarations) for type definitions
- Build config per package is read from the `build` field in each package's `package.json`

## Conventions

- **Test files:** `*.spec.ts` (co-located with source or in `tests/` subdirectories). Test fixtures use `*.artifacts.ts`.
- **Commit messages:** Conventional commits enforced via commitlint + husky (`feat:`, `fix:`, `chore:`, etc.)
- **TypeScript:** Strict mode, legacy experimental decorators with emitDecoratorMetadata, `bundler` module resolution.
- **Linting rules of note:** `import/no-default-export` (error), `typescript/consistent-type-imports` (error), `max-params: 4`, `max-statements: 20`, `complexity: 10`.
- **Formatting:** No semicolons, single quotes, trailing commas, 100 char print width.
- **Path aliases in tsconfig:** `moost` → `packages/moost/src`, `@moostjs/*` → `packages/*/src`.
