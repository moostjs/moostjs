# Swagger / OpenAPI — @moostjs/swagger

Generates an OpenAPI 3.0/3.1 document from Moost controller metadata and serves Swagger UI + `spec.json`/`spec.yaml` under `/api-docs`.

Key imports: `SwaggerController`, `SwaggerTag`, `SwaggerResponse`, `SwaggerRequestBody`, `SwaggerParam`, `SwaggerExample`, `SwaggerExclude`, `SwaggerDescription`, `SwaggerPublic`, `SwaggerDeprecated`, `SwaggerOperationId`, `SwaggerExternalDocs`, `SwaggerSecurity`, `SwaggerSecurityAll`, `SwaggerLink`, `SwaggerCallback`, `getSwaggerMate` ← `@moostjs/swagger`; `Param`, `Optional`, `Label`, `Description`, `Id`, `createProvideRegistry` ← `moost`; `Get`/`Post`/`Body`/`Query`, `Authenticate` ← `@moostjs/event-http`. See also: [http-auth.md](http-auth.md) (transport declarations feed security auto-discovery), [event-http.md](event-http.md) (routing/adapter), [decorators.md](decorators.md) (Mate metadata).

- [Quick start](#quick-start)
- [Options](#options)
- [Decorators](#decorators)
- [Auto-inference rules](#auto-inference-rules)
- [Responses](#responses)
- [Security](#security)
- [Programmatic spec access](#programmatic-spec-access)
- [Custom decorators](#custom-decorators)
- [Gotchas](#gotchas)

## Quick start

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { SwaggerController } from '@moostjs/swagger'

const app = new Moost()
const http = new MoostHttp()
app.adapter(http)
app.registerControllers(SwaggerController /* , ...your controllers */)
await app.init()
await http.listen(3000)
// UI: /api-docs — JSON: /api-docs/spec.json — YAML: /api-docs/spec.yaml
```

Custom mount path: `app.registerControllers(['docs/swagger', SwaggerController])` → `/docs/swagger`, `/docs/swagger/spec.json`, …

## Options

Pass options by instantiating the controller and exposing it via the provide registry:

```ts
import { createProvideRegistry } from 'moost'

const swagger = new SwaggerController({
  title: 'My API', version: '2.0.0', description: '…',
  servers: [{ url: 'https://api.example.com', description: 'Prod' }],
  tags: [{ name: 'Users', description: 'User management' }], // manual tags win over auto-collected
  openapiVersion: '3.1',            // default '3.0'; 3.1 converts nullable → type arrays
  cors: true,                       // or an origin string — CORS on all swagger endpoints
  securitySchemes: { oauth2: { type: 'oauth2', flows: { /* … */ } } },
  security: [{ oauth2: ['read:users'] }], // global default security
})
app.setProvideRegistry(createProvideRegistry([SwaggerController, () => swagger]))
app.registerControllers(SwaggerController)
```

The options object type is `TSwaggerOptions` (exported). Other fields: `contact`, `license`, `termsOfService`, `externalDocs`.

## Decorators

| Decorator | Target | Effect |
|---|---|---|
| `@SwaggerTag(tag)` | class/method | Group in UI; repeatable, controller + handler tags merge |
| `@SwaggerExclude()` | class/method | Drop from spec (SwaggerController excludes itself) |
| `@SwaggerDescription(text)` | class/method | Operation `description` (overrides core `@Description`) |
| `@SwaggerResponse(opts)` / `(code, opts, example?)` | method | Response schema/headers/examples per status + contentType |
| `@SwaggerRequestBody(opts)` | method | Request body schema, keyed by `contentType` (default `application/json`) |
| `@SwaggerParam({ name, in, type?, required?, description? })` | method | Manual parameter; `in: 'query'\|'header'\|'path'\|'formData'\|'body'` (no `'cookie'`) |
| `@SwaggerExample(value)` | **DTO class** | `example` on the component schema (no-op on handlers) |
| `@SwaggerPublic()` | class/method | `security: []` — opt out of inherited security (spec only, not runtime) |
| `@SwaggerDeprecated()` | class/method | Mark operation(s) deprecated |
| `@SwaggerOperationId(id)` | method | Override operationId (`@Id()` is the fallback, then `{METHOD}_{sanitized_path}`) |
| `@SwaggerExternalDocs(url, descr?)` | class/method | External docs link |
| `@SwaggerSecurity(scheme, scopes?)` | class/method | Add requirement, OR semantics across repeats |
| `@SwaggerSecurityAll({ a: [], b: [] })` | class/method | Combined requirement, AND semantics |
| `@SwaggerLink(name, opts)` / `(code, name, opts)` | method | Response link; target via `operationId`, `operationRef`, or `handler: [Class, 'method']` |
| `@SwaggerCallback(name, { expression, requestBody?, … })` | method | Webhook/callback documentation |

Moost core decorators feed the spec too: `@Label` → `summary`/schema `title`, `@Description` → `description`, `@Id` → operationId fallback, `@Optional` → clears `required` on params/body.

## Auto-inference rules

- Path params from route pattern + `@Param('name')`; query params from `@Query('name')`; whole-`@Query()` object schemas expand each simple property into its own query param.
- Request body from `@Body()` param type — objects/arrays → `application/json`, primitives → `text/plain`.
- Response schema falls back to the TS return type when no `@SwaggerResponse` covers the success code.
- Schema resolution: class/instance with `toJsonSchema()` (Atscript DTOs) → named `#/components/schemas/` ref; `[Type]` → array; `String`/`Number`/`Boolean`/`Date` → primitive schemas; plain object → inline schema; zero-arg function → lazy resolution (circular imports); `$defs` hoisted into components.

## Responses

Default success status by method: GET/PUT → 200, POST → 201, DELETE → 204. Forms:

```ts
@SwaggerResponse(UserDto)                       // default status, type shorthand
@SwaggerResponse(404, ErrorDto)                 // explicit status
@SwaggerResponse(200, { contentType: 'application/json', response: UserDto,
  description: '…', headers: { 'X-Total-Count': { type: Number } } })
@SwaggerResponse(200, UserDto, { id: '1' })     // positional example
```

Repeats merge: same status + different `contentType` → multi-media-type response.

## Security

`@Authenticate(guard)` transport declarations auto-generate `components.securitySchemes` (`bearerAuth`/`basicAuth`/`apiKeyAuth`/`cookieAuth`) and per-operation `security`. Precedence (first match wins): handler `@SwaggerPublic` → handler `@SwaggerSecurity*` → handler `@Authenticate` → controller `@SwaggerPublic` → controller `@SwaggerSecurity*` → controller `@Authenticate` → omit (global default applies).

## Programmatic spec access

For SDK generation/CI, request the spec in-process — no port binding needed:

```ts
await app.init()
const spec = await (await http.request('/api-docs/spec.json'))!.json()
```

Or call the exported generator directly (same `TSwaggerOptions` as `SwaggerController`):

```ts
import { mapToSwaggerSpec } from '@moostjs/swagger'
const spec = mapToSwaggerSpec(app.getControllersOverview(), { title: 'My API' })
```

## Custom decorators

`getSwaggerMate()` returns the shared Mate instance typed with the swagger metadata fields (`TSwaggerMate`). Custom decorators that write those fields (`swaggerTags`, `swaggerResponses`, `swaggerParams`, …) are read by the generator automatically — this is the supported extension point.

## Gotchas

1. The spec generator `mapToSwaggerSpec(controllersOverview, opts?)` and `TSwaggerOptions` are exported — use them for programmatic generation; otherwise configure via `new SwaggerController(opts)` and obtain the spec via `spec.json` (HTTP or `http.request()`).
2. Params are `required: true` by default; only `@Optional()` (from `moost`) flips them. The TS `?` modifier never reaches the spec. `@Required()` has no swagger effect.
3. `@Header()` is never auto-inferred — declare header params with `@SwaggerParam({ in: 'header', … })`.
4. `string[]` reflection emits bare `Array` → param falls back to `{ type: 'string' }`. Pass an explicit `type: { type: 'array', items: { type: 'string' } }` via `@SwaggerParam`.
5. Query-object expansion silently drops properties whose schema is not simple (string/number/integer/boolean/enum/const or arrays of those).
6. `@SwaggerExample` works only on DTO classes; on a handler it is silently ignored — use `@SwaggerResponse`'s example argument instead.
7. The spec is generated lazily on the first `spec.json` request and cached forever — controllers registered afterwards never appear.
8. Stacked `@Authenticate()` decorators accumulate: the spec AND-combines their schemes into a single security requirement (e.g. `[{ bearerAuth: [], apiKeyAuth: [] }]`), matching the runtime behavior where all guards run. Multiple transports within one guard remain OR-alternatives.
9. Return-type inference loses `Promise<T>` and generic args (`emitDecoratorMetadata`) — use explicit `@SwaggerResponse` for async handlers.
10. `@SwaggerLink` `handler: [Class, 'method']` — the method name is an unchecked string; unresolvable links are silently omitted from the spec.
11. `@Get()` with no argument routes to the method name (`list()` under `@Controller('users')` → `/users/list` in the spec).
12. `$refs` to `#/$defs/X` are rewritten only in the root schema tree; a hoisted def referencing a sibling def keeps a dangling `#/$defs/` ref.
