# moost

<p align="center">
<img src="https://raw.githubusercontent.com/moostjs/moostjs/main/moost-logo.png" width="450px"><br>
<a  href="https://github.com/moostjs/moostjs/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

`moost` is the core of [Moostjs](https://github.com/moostjs/moostjs) — a metadata-driven Event Processing Framework inspired by [NestJS](https://nestjs.com/) and powered by [Wooks](https://wooks.moost.org). This package provides the `Moost` application class, the decorator system (`@Controller`, `@Injectable`, `@Intercept`, `@Pipe`, ...), dependency injection, interceptors, and pipes shared by every event adapter (`@moostjs/event-http`, `@moostjs/event-cli`, `@moostjs/event-ws`, `@moostjs/event-wf`).

## Quick Start

```ts
import { Moost, Controller, Param } from 'moost'
import { MoostHttp, Get } from '@moostjs/event-http'

@Controller()
class AppController {
  @Get('hello/:name')
  greet(@Param('name') name: string) {
    return `Hello, ${name}!`
  }
}

const app = new Moost()
void app.adapter(new MoostHttp()).listen(3000)
void app.registerControllers(AppController).init()
```

## [Official Documentation](https://moost.org/)

## AI Agent Skill

A unified AI agent skill with framework guidance across all Moost packages is available for AI coding assistants (Claude Code, Cursor, Windsurf, Codex, OpenCode):

```bash
npx skills add moostjs/moostjs
```

## Contributing

See the [repository README](https://github.com/moostjs/moostjs#contributing) for motivation and contribution guidelines.
