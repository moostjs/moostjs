# Request Handlers

Moost HTTP provides a set of decorators that can be used to define handlers for specific HTTP methods.
These decorators make it easy to map your methods to HTTP endpoints with the corresponding HTTP verb. 

## Available HTTP Method Decorators

Below are the decorators provided by Moost HTTP:

- `@Get(path?: string)`
- `@Post(path?: string)`
- `@Put(path?: string)`
- `@Delete(path?: string)`
- `@Patch(path?: string)`
- `@All(path?: string)`

Each decorator corresponds to an HTTP method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`). The `@All` decorator can be used to apply a handler to all HTTP methods.

The `path` parameter is optional. This parameter specifies the route path for the decorated method. If the path is not provided, the path will be calculated based on the name of the method being decorated.

For example, if you have a method named `getUser`, and you decorate it with `@Get()`, the path will default to `/getUser`.

If you want the handler to respond to the root route (`/`), you should provide an empty string (`''`) as the `path` argument, like so: `@Get('')`.

## Using HTTP Method Decorators

The HTTP method decorators can be used in your controllers to define your request handlers. Here is an example:

```ts
import { Controller, Param } from 'moost'
import { Get, Post } from '@moostjs/event-http'

@Controller()
export class UserController {
    @Get()
    getUsers() {
        // handle get users
    }

    @Get('/:id')
    getUser(@Param('id') id: string) {
        // handle get user
    }

    @Post('')
    createUser() {
        // handle create user
    }
}
```

In the above example:

- `getUsers()` will respond to `GET /getUsers`
- `getUser(id)` will respond to `GET /:id` (for example: `GET /123`)
- `createUser()` will respond to `POST /`

The decorators help you to quickly set up your endpoints, keeping your controllers organized and your code clean. 

Remember, you can use multiple decorators to define handlers for different HTTP methods on the same path, or use `@All` to handle requests from all HTTP methods.