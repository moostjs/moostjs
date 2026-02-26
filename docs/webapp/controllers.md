# Controllers

Controllers group related route handlers into a single class. They're the primary way to organize your Moost application.

## Defining a controller

Apply `@Controller()` to a class. The optional argument sets a path prefix for all handlers inside:

```ts
import { Get, Post, Delete } from '@moostjs/event-http'
import { Controller, Param, Body } from 'moost'

@Controller('users')
export class UserController {
    @Get('')
    list() { /* GET /users */ }

    @Get(':id')
    find(@Param('id') id: string) { /* GET /users/123 */ }

    @Post('')
    create(@Body() data: unknown) { /* POST /users */ }

    @Delete(':id')
    remove(@Param('id') id: string) { /* DELETE /users/123 */ }
}
```

Without a prefix, handlers register at the root:

```ts
@Controller()
export class RootController {
    @Get('health')
    health() { /* GET /health */ }
}
```

## Registering controllers

Controllers must be registered with the Moost instance. Two approaches:

### Using `registerControllers()`

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { UserController } from './user.controller'
import { ProductController } from './product.controller'

const app = new Moost()

void app.adapter(new MoostHttp()).listen(3000)
void app
    .registerControllers(UserController, ProductController)
    .init()
```

### Using `@ImportController`

When extending the Moost class, use the decorator:

```ts
import { Moost, ImportController } from 'moost'
import { UserController } from './user.controller'

@ImportController(UserController)
class MyServer extends Moost {
    // handlers defined here also work
    @Get('health')
    health() { return 'ok' }
}
```

## Nested controllers

Controllers can import other controllers. The child inherits the parent's prefix:

```ts
import { Controller, ImportController, Param } from 'moost'
import { Get } from '@moostjs/event-http'

@Controller('user')
export class UserController {
    @Get(':id')
    getUser(@Param('id') id: string) {
        return { id }
    }
}

@Controller('api')
@ImportController(UserController)
export class ApiController {}
```

Result: `GET /api/user/:id`

You can nest multiple levels deep. Each level adds its prefix to the chain.

## Overriding prefixes

When importing a controller, you can replace its prefix:

```ts
@ImportController('people', UserController)
```

Now `UserController`'s routes use `/people/` instead of `/user/`.

## Reusing controllers

The same controller class can be imported multiple times with different prefixes and constructor arguments:

```ts
import { Controller, Param, Body } from 'moost'
import { Get, Post, Delete } from '@moostjs/event-http'

@Controller()
export class CrudController<T> {
    constructor(private collection: string) {}

    @Get(':id')
    find(@Param('id') id: string) {
        return db.find(this.collection, id)
    }

    @Post('')
    create(@Body() data: T) {
        return db.insert(this.collection, data)
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return db.remove(this.collection, id)
    }
}
```

Import it twice with different configs:

```ts
@ImportController('users', () => new CrudController('users'))
@ImportController('products', () => new CrudController('products'))
class MyServer extends Moost {}
```

This gives you `GET /users/:id`, `POST /users`, `DELETE /users/:id` and the same set for `/products/`.

### Practical applications

- **API versioning** — `@ImportController('v1', LegacyApi)` alongside `@ImportController('v2', NewApi)`
- **Multi-tenant** — separate controller instances per tenant, each with its own prefix and config
- **Generic CRUD** — one controller class, many resource endpoints

## Global prefix

Set a prefix for the entire application:

```ts
const app = new Moost({ globalPrefix: 'api/v1' })
```

All routes will be prefixed with `/api/v1/`.
