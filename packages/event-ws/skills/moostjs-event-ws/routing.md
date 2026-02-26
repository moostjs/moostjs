# Routing — @moostjs/event-ws

> Event+path routing, controller prefixes, parametric routes, and wildcards.

## Concepts

WebSocket message routing uses a two-dimensional scheme: messages are matched by both **event type** and **path**. This is powered by the same Wooks router used for HTTP routes.

Every client message carries: `{ event: "message", path: "/chat/general", data: {...} }`

The `@Message` decorator matches both dimensions. The `event` must match exactly. The `path` supports parametric patterns (`:param`) and wildcards (`*`).

## Routing Rules

### Event + Path

```ts
@Message('message', '/chat/general')
onMessage(@MessageData() data: { text: string }) {
  // matches event="message" at path="/chat/general"
}
```

### Controller Prefixes

The `@Controller` prefix is prepended to handler paths:

```ts
@Controller('game')
export class GameController {
  @Message('move', 'board/:id')
  // effective path: /game/board/:id
  onMove(@Param('id') id: string) { /* ... */ }
}
```

Nested controllers with `@ImportController` compose prefixes:

```ts
@Controller('v2')
export class V2Controller {
  @ImportController(() => GameController)
  game!: GameController
  // GameController routes become /v2/game/board/:id
}
```

### Parametric Routes

Use `:param` syntax for path parameters:

```ts
@Controller('chat')
export class ChatController {
  @Message('join', ':room')
  join(@Param('room') room: string) { /* ... */ }

  @Message('dm', ':sender/:receiver')
  dm(
    @Param('sender') sender: string,
    @Param('receiver') receiver: string,
  ) { /* ... */ }
}
```

Client message `{ event: "dm", path: "/chat/alice/bob" }` resolves `sender="alice"`, `receiver="bob"`.

### All Route Parameters

Use `@Params()` to get all parameters as an object:

```ts
import { Params } from 'moost'

@Message('action', ':type/:id')
handle(@Params() params: { type: string; id: string }) {
  console.log(params) // { type: 'move', id: '42' }
}
```

### Wildcards

```ts
@Message('log', '/events/*')
handleAllEvents(@Param('*') subPath: string) {
  // matches /events/user/login, /events/system/error, etc.
}
```

### Path Omission

When `path` is omitted, the method name becomes the path:

```ts
@Controller('api')
export class ApiController {
  @Message('query')
  status() {
    // effective path: /api/status
    return { ok: true }
  }
}
```

## Best Practices

- Use controller prefixes to namespace related handlers
- Prefer explicit `path` argument over relying on method name inference for clarity
- Use parametric routes (`:room`) rather than separate handlers per room

## Gotchas

- Event matching is exact — no wildcard support on the event field itself
- Path parameters are always strings, even if they look like numbers
- Leading slash in `@Message` path is optional — `':room'` and `'/:room'` behave the same when composed with a controller prefix
