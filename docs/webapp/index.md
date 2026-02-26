# Getting Started

Build an HTTP server with Moost in under a minute.

## Prerequisites

- Node.js 18 or higher
- npm, pnpm, or yarn

## Scaffold a project

```bash
npm create moost -- --http
```

Or with a project name:

```bash
npm create moost my-web-app -- --http
```

The scaffolder creates:

```
my-web-app/
├── src/
│   ├── controllers/
│   │   └── app.controller.ts
│   └── main.ts
├── package.json
└── tsconfig.json
```

## What you get

**main.ts** — the entry point:
```ts
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'
import { AppController } from './controllers/app.controller'

const app = new Moost()

void app.adapter(new MoostHttp()).listen(3000, () => {
    app.getLogger('moost-app').info('Up on port 3000')
})

void app
    .registerControllers(AppController)
    .init()
```

**app.controller.ts** — your first handler:
```ts
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller()
export class AppController {
    @Get('hello/:name')
    greet(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
```

## Run it

```bash
npm install && npm run dev
```

Open [http://localhost:3000/hello/World](http://localhost:3000/hello/World) — you'll see `Hello, World!`.

## How it works

1. `new Moost()` creates the application instance
2. `new MoostHttp()` creates the HTTP adapter — the bridge between Moost and Node's HTTP server
3. `registerControllers()` tells Moost which classes contain route handlers
4. `init()` wires everything together — resolves dependencies, binds routes, prepares interceptors

The `@Get('hello/:name')` decorator registers the method as a `GET` handler. The `:name` segment becomes a route parameter, extracted by `@Param('name')`.

## What's next

- [Routing & Handlers](./routing) — HTTP methods, route patterns, and handler basics
- [Reading Request Data](./request) — extract query params, headers, cookies, and body
- [Controllers](./controllers) — organize handlers into logical groups
