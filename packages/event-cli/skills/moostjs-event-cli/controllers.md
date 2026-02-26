# Controllers — @moostjs/event-cli

> Organizing commands into logical groups with prefixes and nesting.

## Concepts

Controllers group related commands under a shared prefix, creating natural command hierarchies like `git remote add` or `docker compose up`. A controller is a class with `@Controller(prefix?)`. The prefix is prepended to all command paths inside it.

Controllers can be nested via `@ImportController()` — the child's prefix appends to the parent's, building multi-level command trees.

## API Reference

### `@Controller(prefix?: string)`

Class decorator (re-exported from `moost`). Marks a class as a CLI controller. The optional `prefix` sets a command prefix for all methods inside.

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

```bash
my-cli user create Alice
my-cli user delete Bob
```

Without a prefix (`@Controller()`), commands are registered at the root level.

### `@ImportController(ctrl: Function)`

Class decorator (from `moost`). Nests a child controller inside the parent. The child's prefix appends to the parent's. Register only the top-level controller — imported children are registered automatically.

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

```bash
my-cli profile list          # ProfileController.list()
my-cli profile view 42       # ViewCommand.view("42")
```

## Common Patterns

### Pattern: Registering controllers

With `CliApp`:
```ts
new CliApp()
  .controllers(UserController, ConfigController)
  .useHelp({ name: 'my-cli' })
  .start()
```

With standard Moost:
```ts
const app = new Moost()
app.registerControllers(UserController, ConfigController)
```

### Pattern: Multi-level nesting

```ts
@Controller('add')
class RemoteAddController {
  @Cli(':name/:url')
  add(@Param('name') name: string, @Param('url') url: string) {
    return `Adding remote ${name} -> ${url}`
  }
}

@Controller('remote')
@ImportController(RemoteAddController)
class RemoteController {
  @Cli('list')
  list() { return 'Listing remotes...' }
}

@Controller()
@ImportController(RemoteController)
class GitController {
  @Cli('status')
  status() { return 'On branch main' }
}
```

```bash
my-cli status                        # GitController
my-cli remote list                   # RemoteController
my-cli remote add origin git@...     # RemoteAddController
```

## Path composition

The final command path is: **controller prefix** + **child prefix** + **@Cli() path**.

| Parent prefix | Child prefix | `@Cli()` path | Final command |
|--------------|-------------|---------------|---------------|
| `''` (root) | — | `status` | `status` |
| `remote` | — | `list` | `remote list` |
| `remote` | `add` | `:name/:url` | `remote add :name :url` |

## Best Practices

- Use `@Controller(prefix)` to create command namespaces — `user`, `config`, `remote`
- Only register top-level controllers with `.controllers()` — nested children auto-register
- Keep nesting to 2-3 levels max for usability
- Use `@Controller()` (no prefix) for root-level commands

## Gotchas

- Registering a child controller directly AND via `@ImportController` can cause duplicate command registrations
- The controller prefix uses the same space/slash equivalence as command paths
