# CLAUDE.md — @moostjs/swagger

## Overview

Swagger/OpenAPI 3.0 integration for Moost. Generates an OpenAPI spec from controller metadata and serves Swagger UI. Uses the same Mate metadata instance as the rest of Moost (extends metadata shape with `TSwaggerMate` fields).

## Key Files

- `src/mapping.ts` — Core engine (736 lines): `mapToSwaggerSpec()` transforms `TControllerOverview[]` into an OpenAPI 3.0 spec
- `src/swagger.controller.ts` — `SwaggerController` serving Swagger UI + `spec.json` at `/api-docs/`
- `src/decorators.ts` — `SwaggerTag`, `SwaggerExclude`, `SwaggerDescription`, `SwaggerResponse`, `SwaggerRequestBody`, `SwaggerParam`, `SwaggerExample`, `SwaggerPublic`, `SwaggerSecurity`, `SwaggerSecurityAll`
- `src/swagger.mate.ts` — `getSwaggerMate()` extending moost's Mate instance with swagger metadata fields (includes `swaggerPublic`, `swaggerSecurity`, `authTransports`)

## Schema Resolution

The mapping engine resolves types to JSON Schema through `createSchemaResolution()`:

| Input                                            | Output                                 |
| ------------------------------------------------ | -------------------------------------- |
| Class with `static toJsonSchema()`               | Calls it, registers as named component |
| `[SomeType]` (array literal)                     | `{ type: 'array', items: <resolved> }` |
| Primitive constructor (`String`, `Number`, etc.) | Corresponding JSON Schema type         |
| Literal value                                    | Const schema                           |
| Zero-arg function                                | Invokes it, resolves return value      |

Classes used as types are deduplicated via a `WeakMap<object, string>` — same class reference produces one `$ref` component.

## Non-Obvious Patterns

**Module-level mutable state for schema registry.** `globalSchemas`, `schemaRefs`, and `nameToType` are reset at the start of every `mapToSwaggerSpec()` call. `globalSchemas` is assigned directly to `spec.components.schemas`, so mutations during traversal populate the spec as a side effect.

**Status code 0 is a sentinel for "default".** `@SwaggerResponse()` without a status code stores under key `0`, which gets translated to the method-appropriate default (GET/PUT→200, POST→201, DELETE→204).

**Query object explosion.** When `paramSource === 'QUERY'` maps to an object schema, each property is emitted as a separate query parameter. Complex/non-serializable properties are silently dropped.

**Computed string property method names as routes.** `SwaggerController` uses JS computed property names like `'spec.json'()` and `'swagger-initializer.js'()`. When `@Get()` has no argument, Moost uses the method name as the route segment.

**Lazy cached spec generation.** The spec is generated on first request to `/api-docs/spec.json` and cached. No invalidation — runtime controller changes are not reflected.

**`SwaggerController` excludes itself.** Decorated with `@SwaggerExclude()` to prevent recursive self-documentation.

**Moost core decorators feed into OpenAPI.** `@Label()` becomes schema `title`, `@Description()` becomes `description`, `@Optional()` affects `required` arrays. No swagger-specific decorators needed for basic metadata.

**`toJsonSchema()` convention.** Any class with a `static toJsonSchema()` method integrates automatically. This is the expected convention for typed DTOs.

## Security Schemes

Security schemes are auto-discovered from `authTransports` metadata set by `@Authenticate()` (from `@moostjs/event-http`). The mapping engine collects transport declarations during traversal and emits `components.securitySchemes`.

**Transport → OpenAPI scheme mapping:**

- `bearer: { format }` → `{ type: 'http', scheme: 'bearer', bearerFormat: format }` as `bearerAuth`
- `basic: {}` → `{ type: 'http', scheme: 'basic' }` as `basicAuth`
- `apiKey: { name, in }` → `{ type: 'apiKey', name, in }` as `apiKeyAuth`
- `cookie: { name }` → `{ type: 'apiKey', name, in: 'cookie' }` as `cookieAuth`

**Per-operation security resolution (precedence):**

1. Handler `swaggerPublic` → `security: []`
2. Handler `swaggerSecurity` → handler's explicit array
3. Handler `authTransports` → converted to security requirement
4. Controller `swaggerPublic` → `security: []`
5. Controller `swaggerSecurity` → controller's explicit array
6. Controller `authTransports` → converted to security requirement
7. None → omit `security` (inherits global)
