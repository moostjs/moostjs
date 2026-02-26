# @moostjs/event-ws

<p align="center">
<img src="../../moost-logo.png" width="450px"><br>
<a  href="https://github.com/moostjs/moostjs/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

Welcome to `@moostjs/event-ws`, a Moostjs library that serves as a wrapper for [@wooksjs/event-ws](https://github.com/wooksjs/wooksjs/tree/main/packages/event-ws). This package provides decorators for composing WebSocket handlers, bringing decorator-based routing, dependency injection, interceptors, and pipes to your WebSocket application.

**Note:** As `@moostjs/event-ws` is under active development, breaking changes can be expected.

## Overview

The `@moostjs/event-ws` module makes Moost apps receptive to WebSocket events. It supports two modes:

- **Standalone** — dedicated WebSocket server using `WsApp` or `MoostWs` with `listen()`
- **HTTP-integrated** (recommended) — shares the HTTP port with `@moostjs/event-http` via `@Upgrade()` routes

## Installation

```bash
npm install @moostjs/event-ws
```

For HTTP-integrated mode (recommended):

```bash
npm install @moostjs/event-ws @moostjs/event-http
```

## Quick Start

### Standalone Mode

```ts
import { WsApp, Message, MessageData, Connect, ConnectionId } from '@moostjs/event-ws'
import { Controller } from 'moost'

@Controller()
class ChatController {
  @Connect()
  onConnect(@ConnectionId() id: string) {
    console.log(`Connected: ${id}`)
  }

  @Message('echo', '/echo')
  echo(@MessageData() data: unknown) {
    return data
  }
}

new WsApp()
  .controllers(ChatController)
  .start(3000)
```

### HTTP-Integrated Mode

```ts
import { MoostHttp, Upgrade } from '@moostjs/event-http'
import { MoostWs, Message, MessageData, useWsRooms } from '@moostjs/event-ws'
import { Moost, Controller, Param, Inject } from 'moost'
import type { WooksWs } from '@moostjs/event-ws'

@Controller()
class AppController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}

  @Upgrade('ws')
  upgrade() { return this.ws.upgrade() }
}

@Controller('chat')
class ChatController {
  @Message('message', ':room')
  onMessage(@Param('room') room: string, @MessageData() data: unknown) {
    const { broadcast } = useWsRooms()
    broadcast('message', data)
  }
}

const app = new Moost()
const http = new MoostHttp()
const ws = new MoostWs({ httpApp: http.getHttpApp() })
app.adapter(http)
app.adapter(ws)
app.registerControllers(AppController, ChatController)
await http.listen(3000)
await app.init()
```

## [Official Documentation](https://moost.org/wsapp/)

## AI Agent Skills

This package ships skills for AI coding agents (Claude Code, Cursor, Windsurf, Codex, OpenCode). After installing `@moostjs/event-ws`, set up the skills:

```bash
# Project-local (recommended — version-locked, commits with your repo)
npx moostjs-event-ws-skill

# Global (available across all your projects)
npx moostjs-event-ws-skill --global
```

To auto-install skills on `npm install`, add to your `package.json`:

```json
{
  "scripts": {
    "postinstall": "moostjs-event-ws-skill --postinstall"
  }
}
```

## Contributing

We are excited to welcome contributors who are passionate about improving Moostjs. No matter your level of experience, your unique perspective and skills can make valuable contributions to our growing community.

Here are some basic steps to get you started:

1. **Fork the Repo:** Navigate to [moostjs](https://github.com/moostjs/moostjs) and fork the repository to your own GitHub account.

2. **Clone the Repo:** Clone the forked repository to your local machine.

3. **Create a Branch:** Make a new branch for your feature or bug fix.

4. **Make your Changes:** Implement your feature or fix the bug and commit the changes to your branch.

5. **Make a Pull Request:** Navigate back to your forked repo and press the "New pull request" button.

Don't hesitate to ask for help if you need it. We believe in fostering a friendly and respectful environment for all contributors.

Thank you for your interest in Moostjs. We look forward to building something amazing together!
