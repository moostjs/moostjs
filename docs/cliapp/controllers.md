# Controllers

Controllers group related commands under a shared prefix. This keeps your code organized and creates natural command hierarchies — like `git remote add` or `docker compose up`.

## Basic controller

A controller is a class decorated with `@Controller()`. The optional argument sets a command prefix:

```ts
import { Cli, Controller, Param } from '@moostjs/event-cli'

@Controller('user')
export class UserController {
  @Cli('create/:name')
  create(@Param('name') name: string) {
    return `Created user: ${name}`
  }

  @Cli('delete/:name')
  delete(@Param('name') name: string) {
    return `Deleted user: ${name}`
  }
}
```

The prefix `user` is prepended to each command:

```bash
my-cli user create Alice
my-cli user delete Bob
```

Without a prefix (`@Controller()`), commands are registered at the root level.

## Registering controllers

With `CliApp`, use the `.controllers()` method:

```ts
import { CliApp } from '@moostjs/event-cli'
import { UserController } from './user.controller'
import { ConfigController } from './config.controller'

new CliApp()
  .controllers(UserController, ConfigController)
  .useHelp({ name: 'my-cli' })
  .start()
```

Or with the standard Moost setup:

```ts
const app = new Moost()
app.registerControllers(UserController, ConfigController)
```

## Nesting controllers

Use `@ImportController()` to nest one controller inside another. The child's prefix is appended to the parent's:

```ts
import { Cli, Controller, Param } from '@moostjs/event-cli'
import { ImportController } from 'moost'

@Controller('view')
export class ViewCommand {
  @Cli(':id')
  view(@Param('id') id: string) {
    return `Viewing profile ${id}`
  }
}

@Controller('profile')
@ImportController(ViewCommand)
export class ProfileController {
  @Cli('list')
  list() {
    return 'Listing profiles...'
  }
}
```

Register only the top-level controller — imported children are registered automatically:

```ts
new CliApp()
  .controllers(ProfileController)
  .start()
```

This produces:

```bash
my-cli profile list          # ProfileController.list()
my-cli profile view 42       # ViewCommand.view("42")
```

## Multi-level nesting

You can nest as deep as needed. Here's a `git`-like command structure:

```ts
@Controller('add')
class RemoteAddController {
  @Cli(':name/:url')
  add(
    @Param('name') name: string,
    @Param('url') url: string,
  ) {
    return `Adding remote ${name} → ${url}`
  }
}

@Controller('remote')
@ImportController(RemoteAddController)
class RemoteController {
  @Cli('list')
  list() {
    return 'Listing remotes...'
  }
}

@Controller()
@ImportController(RemoteController)
class GitController {
  @Cli('status')
  status() {
    return 'On branch main'
  }
}
```

```bash
my-cli status                           # GitController
my-cli remote list                      # RemoteController
my-cli remote add origin git@...        # RemoteAddController
```

## Path composition

The final command path is built by joining: **controller prefix** + **child prefix** + **command path**.

| Parent prefix | Child prefix | `@Cli()` path | Final command |
|--------------|-------------|---------------|---------------|
| `''` (root) | — | `status` | `status` |
| `remote` | — | `list` | `remote list` |
| `remote` | `add` | `:name/:url` | `remote add :name :url` |

## What's next

- [Help System](./help) — document commands with descriptions, examples, and auto-help
- [Interceptors](./interceptors) — add guards, logging, and error handling
