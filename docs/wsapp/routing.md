# Routing


WebSocket message routing in Moost uses a two-dimensional scheme: messages are matched by both **event type** and **path**. This is powered by the same router that handles HTTP routes in Wooks.

[[toc]]

## Event + Path Routing

Every client message carries two routing fields:

```json
{ "event": "message", "path": "/chat/general", "data": { "text": "Hello!" } }
```

The `@Message` decorator matches both:

```ts
@Message('message', '/chat/general')
onMessage(@MessageData() data: { text: string }) {
  // handles event="message" at path="/chat/general"
}
```

This allows you to use the same path with different event types:

```ts
@Controller('chat')
export class ChatController {
  @Message('join', ':room')      // event="join", path="/chat/:room"
  join() { /* ... */ }

  @Message('leave', ':room')     // event="leave", path="/chat/:room"
  leave() { /* ... */ }

  @Message('message', ':room')   // event="message", path="/chat/:room"
  message() { /* ... */ }
}
```

## Controller Prefixes

The `@Controller` prefix is prepended to message handler paths, just like with HTTP routes:

```ts
@Controller('game')
export class GameController {
  @Message('move', 'board/:id')
  // effective path: /game/board/:id
  onMove(@Param('id') id: string) { /* ... */ }
}
```

Nested controllers with `@ImportController` (a class decorator) also compose prefixes:

```ts
@Controller('v2')
@ImportController(() => GameController)
export class V2Controller {}
// GameController routes become /v2/game/board/:id
```

## Parametric Routes

Route parameters use the colon (`:`) syntax, identical to HTTP routing:

```ts
@Controller('chat')
export class ChatController {
  // Single parameter
  @Message('join', ':room')
  join(@Param('room') room: string) { /* ... */ }

  // Multiple parameters
  @Message('dm', ':sender/:receiver')
  directMessage(
    @Param('sender') sender: string,
    @Param('receiver') receiver: string,
  ) { /* ... */ }
}
```

Parameters are extracted from the concrete path in the client message:

```json
{ "event": "dm", "path": "/chat/alice/bob", "data": { "text": "Hi!" } }
```

### All Route Parameters

Use `@Params()` to get all parameters as an object:

```ts
import { Params } from 'moost'

@Message('action', ':type/:id')
handle(@Params() params: { type: string; id: string }) {
  console.log(params) // { type: 'move', id: '42' }
}
```

## Wildcards

Wildcards (`*`) match zero or more characters:

```ts
@Message('log', '/events/*')
handleAllEvents(@Param('*') subPath: string) {
  // matches /events/user/login, /events/system/error, etc.
}
```

## Path Omission

When `path` is omitted from `@Message`, the handler method name is used as the path:

```ts
@Controller('api')
export class ApiController {
  @Message('query')
  status() {
    // effective path: /api/status (method name "status" becomes the path)
    return { ok: true }
  }
}
```

## Gotchas

- **Unmatched fire-and-forget messages are dropped silently.** When no handler matches the `event` + `path` pair and the message carries no `id`, there is no log and no reply — a typo in `event` or a missing controller prefix in `path` produces zero feedback.
- **Unmatched RPC messages get a 404 error reply.** When the message carries a correlation `id`, the server replies with `{ "id": ..., "error": { "code": 404, "message": "Not found" } }`.
- **The `event` field must match the registered event exactly.** There is no wildcard matching on the event dimension — only paths support `:param` and `*` patterns.
- **Paths are matched against the full prefixed route.** Clients must send the path including the `@Controller` prefix (e.g. `/chat/general`, not `general`).
