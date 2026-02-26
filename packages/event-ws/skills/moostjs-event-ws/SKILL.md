---
name: moostjs-event-ws
description: Use this skill when working with @moostjs/event-ws — to build WebSocket servers with Moost using MoostWs adapter or WsApp quick factory, register message handlers with @Message(), handle connections with @Connect()/@Disconnect(), extract data with @MessageData()/@ConnectionId()/@RawMessage()/@MessageId()/@MessageType()/@MessagePath(), use composables like useWsConnection(), useWsMessage(), useWsRooms(), useWsServer(), manage rooms and broadcasting, integrate with @moostjs/event-http via @Upgrade() routes, throw WsError for error replies, or test handlers with prepareTestWsConnectionContext()/prepareTestWsMessageContext(). Covers the wire protocol (WsClientMessage, WsReplyMessage, WsPushMessage), standalone and HTTP-integrated modes, heartbeat, custom serializers, and multi-instance broadcasting with WsBroadcastTransport.
---

# @moostjs/event-ws

Moost WebSocket adapter — decorator-based routing, DI, interceptors, and pipes for WebSocket handlers, wrapping `@wooksjs/event-ws`.

## How to use this skill

Read the domain file that matches the task. Do not load all files — only what you need.

| Domain | File | Load when... |
|--------|------|------------|
| Core concepts & setup | [core.md](core.md) | Starting a new project, choosing standalone vs HTTP-integrated mode, configuring MoostWs or WsApp |
| Handlers | [handlers.md](handlers.md) | Defining @Message, @Connect, @Disconnect handlers, understanding handler lifecycle |
| Routing | [routing.md](routing.md) | Event+path routing, controller prefixes, parametric routes, wildcards |
| Request data | [request-data.md](request-data.md) | Extracting message data, connection info, route params with resolver decorators |
| Rooms & broadcasting | [rooms.md](rooms.md) | Room management, broadcasting, direct sends, server-wide queries, multi-instance scaling |
| Wire protocol | [protocol.md](protocol.md) | JSON message format, client/server message types, error codes, heartbeat, custom serialization |
| Testing | [testing.md](testing.md) | Unit-testing handlers with prepareTestWsMessageContext/prepareTestWsConnectionContext |

## Quick reference

```ts
import {
  // Adapter & factory
  MoostWs, WsApp, WooksWs,
  // Decorators
  Message, Connect, Disconnect,
  MessageData, RawMessage, MessageId, MessageType, MessagePath, ConnectionId,
  // Composables
  useWsConnection, useWsMessage, useWsRooms, useWsServer, currentConnection,
  // Errors
  WsError,
  // Testing
  prepareTestWsMessageContext, prepareTestWsConnectionContext,
  // Re-exports from moost
  Controller, Param, Intercept, Description,
} from '@moostjs/event-ws'
```
