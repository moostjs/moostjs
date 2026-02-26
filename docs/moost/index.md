# Moost Flavors

Moost is event-agnostic by design. The core — controllers, DI, interceptors, pipes — works the same regardless of what triggered the event. On top of this core, Moost provides **adapters** for specific event domains, each wrapping the corresponding [Wooks](https://wooks.moost.org/wooks/what) adapter with a decorator layer.

## HTTP

**Package:** `@moostjs/event-http`

Build REST APIs and web servers with decorator-based routing, automatic parameter extraction, and the full Wooks HTTP composable set.

```ts
import { MoostHttp, Get, Post } from '@moostjs/event-http'
import { Moost, Controller, Param } from 'moost'
import { useBody } from '@wooksjs/event-http'

@Controller('api')
class ApiController {
  @Get('hello/:name')
  greet(@Param('name') name: string) {
    return `Hello, ${name}!`
  }

  @Post('users')
  async createUser() {
    const { parseBody } = useBody()
    const user = await parseBody<{ name: string }>()
    return { created: user.name }
  }
}

const app = new Moost()
const http = new MoostHttp()
app.adapter(http)
app.registerControllers(ApiController).init()
http.listen(3000)
```

Supports Express and Fastify adapters, Swagger generation, static file serving, and reverse proxy.

[Get started with HTTP &rarr;](/webapp/)

## WebSocket

**Package:** `@moostjs/event-ws`

Build real-time WebSocket servers with routed message handlers, rooms, broadcasting, and composable state. Integrates with HTTP for upgrade handling.

```ts
import { MoostHttp, Upgrade } from '@moostjs/event-http'
import { MoostWs, Message, Connect, MessageData, ConnectionId } from '@moostjs/event-ws'
import { Moost, Controller, Param } from 'moost'
import { useWsRooms } from '@wooksjs/event-ws'

@Controller('chat')
class ChatController {
  @Connect()
  onConnect(@ConnectionId() id: string) {
    console.log(`Connected: ${id}`)
  }

  @Message('message', ':room')
  onMessage(@Param('room') room: string, @MessageData() data: { text: string }) {
    const { broadcast } = useWsRooms()
    broadcast('message', { from: room, text: data.text })
  }
}

const app = new Moost()
const http = new MoostHttp()
const ws = new MoostWs({ httpApp: http.getHttpApp() })
app.adapter(http).adapter(ws)
app.registerControllers(ChatController).init()
http.listen(3000)
```

Available composables: `useWsConnection()`, `useWsMessage()`, `useWsRooms()`, `useWsServer()`. HTTP composables work transparently via the upgrade request context.

[Get started with WebSocket &rarr;](/wsapp/)

## CLI

**Package:** `@moostjs/event-cli`

Build command-line applications with decorator-based command routing, typed options, and auto-generated help.

```ts
import { MoostCli, Cli, CliOption } from '@moostjs/event-cli'
import { Moost, Controller, Param } from 'moost'

@Controller()
class DeployController {
  @Cli('deploy/:env')
  deploy(
    @Param('env') env: string,
    @CliOption('verbose', 'v', { description: 'Verbose output' }) verbose: boolean,
  ) {
    return `Deploying to ${env}${verbose ? ' (verbose)' : ''}...`
  }
}

const app = new Moost()
app.adapter(new MoostCli())
app.registerControllers(DeployController).init()
```

Commands use the same route-style patterns as HTTP. Options are parsed automatically. Help output is generated from decorator metadata.

[Get started with CLI &rarr;](/cliapp/)

## Workflows

**Package:** `@moostjs/event-wf`

Build multi-step pipelines with decorator-based step definitions, state management, pause/resume support, and conditional branching.

```ts
import { MoostWf, WfStep, WfFlow, WfInput } from '@moostjs/event-wf'
import { Moost, Controller } from 'moost'
import { useWfState } from '@wooksjs/event-wf'

@Controller()
class ApprovalWorkflow {
  @WfStep('review')
  @WfInput('approval')
  review() {
    const { ctx, input } = useWfState()
    ctx<{ approved: boolean }>().approved = input<boolean>() ?? false
  }

  @WfFlow('approval-process', [
    'validate',
    'review',
    { condition: 'approved', steps: ['notify-success'] },
    { condition: '!approved', steps: ['notify-rejection'] },
  ])
  approvalFlow() {}
}
```

Workflows are **interruptible** — when a step needs input, the workflow pauses and returns serializable state. Resume it later with the input, minutes or days later.

[Get started with Workflows &rarr;](/wf/)

## Multiple Adapters

Moost supports registering multiple adapters at once. Each adapter operates independently — controllers are registered once and each adapter picks up only the decorators it understands:

```ts
import { Moost, Controller, Param } from 'moost'
import { MoostHttp, Get } from '@moostjs/event-http'
import { MoostCli, Cli } from '@moostjs/event-cli'

@Controller()
class AppController {
  @Get('status')
  httpStatus() { return { ok: true } }

  @Cli('status')
  cliStatus() { return 'OK' }
}

const app = new Moost()
app.adapter(new MoostHttp()).adapter(new MoostCli())
app.registerControllers(AppController).init()
```

## Custom Adapters

You can build your own adapter for any event-driven scenario — job queues, message brokers, custom protocols. All adapters implement the `TMoostAdapter` interface and share the same controller, DI, interceptor, and pipe infrastructure.
