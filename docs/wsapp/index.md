# Quick Start


This guide shows you how to build a WebSocket application with Moost.

`@moostjs/event-ws` wraps [`@wooksjs/event-ws`](https://wooks.moost.org/wsapp/) and brings
decorator-based routing, dependency injection, interceptors, and pipes to your WebSocket handlers.

## Installation

```bash
npm install @moostjs/event-ws
```

::: tip
For HTTP-integrated mode (recommended), you also need `@moostjs/event-http`:
```bash
npm install @moostjs/event-ws @moostjs/event-http
```
:::

## Standalone Mode

The quickest way to get a WebSocket server running. All incoming connections are accepted automatically — no HTTP server or upgrade route is needed.

```ts
import { WsApp, Message, MessageData, ConnectionId, Connect } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
class ChatController {
  @Connect()
  onConnect(@ConnectionId() id: string) {
    console.log(`Connected: ${id}`)
  }

  @Message('echo', '/echo')
  echo(@MessageData() data: unknown) {
    return data // replies to the client
  }
}

new WsApp()
  .controllers(ChatController)
  .start(3000)
```

`WsApp` is a convenience class that extends `Moost` and sets up a standalone `MoostWs` adapter for you. Clients connect to `ws://localhost:3000` and send JSON messages routed by `event` and `path` fields — see the [wire protocol](./protocol) for the message format.

## HTTP-Integrated Mode

The recommended approach for production: create the adapter with `new MoostWs({ httpApp: http.getHttpApp() })` so the WebSocket server shares the HTTP port, and accept connections through an explicit `@Upgrade` route. This gives you full control over which paths accept WebSocket connections and lets you authenticate during the upgrade handshake. See [HTTP Integration](./integration) for the complete setup, upgrade routes, and authentication recipes.

## Connecting a Client

Use [`@wooksjs/ws-client`](./client) for a type-safe client with RPC calls (`call`), fire-and-forget sends (`send`), push listeners (`on`), and automatic reconnection.

## AI Agent Skill

Install the unified Moost AI skill for context-aware assistance in AI coding agents (Claude Code, Cursor, Windsurf, Codex, OpenCode):

```bash
npx skills add moostjs/moostjs
```

## What's Next?

- [Handlers](./handlers) — `@Message`, `@Connect`, `@Disconnect` decorators
- [Routing](./routing) — Event + path routing with parameters
- [Request Data](./request) — Resolver decorators for message data
- [Rooms & Broadcasting](./rooms) — Room management and message broadcasting
- [HTTP Integration](./integration) — Upgrade routes and shared HTTP context
- [Client](./client) — Full client API reference
- [Wire Protocol](./protocol) — JSON message format specification
- [Error Handling](./errors) — Error responses with `WsError`
- [Testing](./testing) — Unit-testing WebSocket handlers
