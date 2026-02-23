# Links & Callbacks

These decorators document advanced OpenAPI features: response-driven navigation (links) and webhook delivery (callbacks). Both are optional — most APIs don't need them.

## Response links

OpenAPI [links](https://spec.openapis.org/oas/v3.1.0#link-object) describe how values from a response can be used as input to another operation. This is useful for HATEOAS-style navigation in the generated spec.

### Basic usage

```ts
import { SwaggerLink } from '@moostjs/swagger'

@SwaggerLink('GetUser', {
  operationId: 'getUser',
  parameters: { userId: '$response.body#/id' },
})
@SwaggerResponse(201, UserDto)
@Post()
create(@Body() dto: CreateUserDto) {
  // The 201 response includes a link: "use the id from this response to call getUser"
}
```

### Target modes

A link must reference a target operation. Three modes are supported:

**By `operationId` string** — references any operation by its `operationId`:

```ts
@SwaggerLink('GetUser', {
  operationId: 'getUser',
  parameters: { userId: '$response.body#/id' },
})
```

**By `handler` reference** — type-safe, resolved to the actual `operationId` at mapping time:

```ts
@SwaggerLink('GetUser', {
  handler: [UserController, 'getUser'],
  parameters: { userId: '$response.body#/id' },
})
```

This is the recommended approach within a Moost application. If the target handler is renamed or moved, TypeScript flags the reference at compile time.

**By `operationRef`** — JSON pointer for cross-document or non-standard references:

```ts
@SwaggerLink('ExternalOp', {
  operationRef: '#/paths/~1users~1{id}/get',
  parameters: { id: '$response.body#/userId' },
})
```

### Multiple links

Stack multiple `@SwaggerLink` decorators to add several links to the same response:

```ts
@SwaggerLink('GetUser', {
  handler: [UserController, 'getUser'],
  parameters: { userId: '$response.body#/id' },
})
@SwaggerLink('ListOrders', {
  handler: [OrderController, 'listByUser'],
  parameters: { userId: '$response.body#/id' },
})
@SwaggerResponse(201, UserDto)
@Post()
create(@Body() dto: CreateUserDto) { /* ... */ }
```

### Status codes

By default, a link attaches to the default success status code for the HTTP method (200 for GET/PUT, 201 for POST, 204 for DELETE). Target a specific status code with the 3-argument form:

```ts
@SwaggerLink(201, 'GetCreated', {
  operationId: 'getItem',
  parameters: { id: '$response.body#/id' },
})
@SwaggerLink(200, 'GetUpdated', {
  operationId: 'getItem',
  parameters: { id: '$response.body#/id' },
})
```

### Options reference

| Field | Type | Description |
|-------|------|-------------|
| `operationId` | `string` | Target operation by operationId |
| `operationRef` | `string` | Target operation by JSON pointer |
| `handler` | `[Class, string]` | Target by controller class + method name (resolved at mapping time) |
| `parameters` | `Record<string, string>` | Map of parameter names to [runtime expressions](https://spec.openapis.org/oas/v3.1.0#runtime-expressions) |
| `requestBody` | `string` | Runtime expression for the request body |
| `description` | `string` | Human-readable description of the link |
| `server` | `{ url, description? }` | Alternative server for the link target |

Exactly one of `operationId`, `operationRef`, or `handler` must be provided. If `handler` cannot be resolved (e.g., the target controller is not registered), the link is silently skipped.

---

## Callbacks (webhooks)

OpenAPI [callbacks](https://spec.openapis.org/oas/v3.1.0#callback-object) document requests your server sends to a client-provided URL — typically for webhook delivery after an event.

### Basic usage

```ts
import { SwaggerCallback } from '@moostjs/swagger'

@SwaggerCallback('onEvent', {
  expression: '{$request.body#/callbackUrl}',
  requestBody: EventPayloadDto,
  description: 'Event notification sent to subscriber',
})
@Post('subscribe')
subscribe(@Body() dto: SubscribeDto) {
  // Documents: "after subscribing, server POSTs EventPayloadDto to the callbackUrl"
}
```

The `expression` is an OpenAPI [runtime expression](https://spec.openapis.org/oas/v3.1.0#runtime-expressions) that resolves to the callback URL at runtime. The most common pattern is `'{$request.body#/callbackUrl}'` — a URL provided in the request body.

### Custom method, content type, and response

By default, callbacks use `POST`, `application/json`, and expect a `200 OK` response. Override any of these:

```ts
@SwaggerCallback('onUpdate', {
  expression: '{$request.body#/webhookUrl}',
  method: 'put',
  contentType: 'text/plain',
  responseStatus: 204,
  responseDescription: 'Acknowledged',
})
@Post('subscribe')
subscribe(@Body() dto: SubscribeDto) { /* ... */ }
```

### Multiple callbacks

Stack multiple `@SwaggerCallback` decorators to document several webhooks on the same operation:

```ts
@SwaggerCallback('onCreated', {
  expression: '{$request.body#/callbackUrl}',
  requestBody: CreatedEventDto,
})
@SwaggerCallback('onUpdated', {
  expression: '{$request.body#/callbackUrl}',
  requestBody: UpdatedEventDto,
})
@Post('subscribe')
subscribe(@Body() dto: SubscribeDto) { /* ... */ }
```

### Options reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `expression` | `string` | *(required)* | Runtime expression resolving to the callback URL |
| `requestBody` | type/schema | — | Schema for the payload your server sends. Resolved via the [schema pipeline](/swagger/schemas) |
| `method` | `string` | `'post'` | HTTP method your server uses |
| `contentType` | `string` | `'application/json'` | Content type for the payload |
| `description` | `string` | — | Description for the callback operation |
| `responseStatus` | `number` | `200` | Expected response status from the receiver |
| `responseDescription` | `string` | `'OK'` | Description for the expected response |
