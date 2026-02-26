# Dependency Injection

Moost uses dependency injection (DI) to manage object creation and wiring. Every controller is automatically injectable. This page covers scopes, injection patterns, and how scopes unlock property-level resolvers.

## Scopes

Every injectable class has a scope that controls its lifecycle:

| Scope | Behavior | Default |
|---|---|---|
| `SINGLETON` | One instance shared across all requests | Yes |
| `FOR_EVENT` | New instance created for each request | No |

### SINGLETON (default)

Controllers are singletons by default — one instance handles all requests. This is efficient and works well when handlers don't store per-request state:

```ts
@Controller('users')
export class UserController {
    @Get(':id')
    find(@Param('id') id: string) {
        return { id } // id comes from parameters, not instance state
    }
}
```

### FOR_EVENT

Use `@Injectable('FOR_EVENT')` when you need per-request state on the controller instance. This is particularly useful for property-level resolvers:

```ts
import { Get } from '@moostjs/event-http'
import { Controller, Injectable, Param } from 'moost'

@Injectable('FOR_EVENT')
@Controller('greet')
export class GreetController {
    @Param('name')
    name!: string

    @Get(':name')
    hello() {
        return `Hello, ${this.name}!` // resolved per-request
    }
}
```

Because a new `GreetController` is created for each request, `this.name` safely holds the current request's `:name` parameter.

## Property-level resolvers

In `FOR_EVENT` controllers, all resolver decorators (`@Param`, `@Query`, `@Header`, `@Cookie`, `@Body`, etc.) can be used on class properties instead of handler arguments:

```ts
import { Get, Post, Header, Body, Cookie } from '@moostjs/event-http'
import { Controller, Injectable, Param } from 'moost'

@Injectable('FOR_EVENT')
@Controller('api')
export class ApiController {
    @Param('id')
    id!: string

    @Header('authorization')
    authHeader!: string

    @Cookie('session')
    sessionToken!: string

    @Get('items/:id')
    getItem() {
        // all properties are resolved before the handler runs
        return { id: this.id, auth: this.authHeader }
    }
}
```

## Response hooks as properties

`FOR_EVENT` scope makes response hooks especially elegant. Instead of using hook objects in handler parameters, bind them to properties:

```ts
import { Get, StatusHook, HeaderHook, CookieHook, CookieAttrsHook } from '@moostjs/event-http'
import type { TCookieAttributes } from '@moostjs/event-http'
import { Controller, Injectable } from 'moost'

@Injectable('FOR_EVENT')
@Controller()
export class ResponseController {
    @StatusHook()
    status = 200

    @HeaderHook('x-custom')
    customHeader = ''

    @CookieHook('session')
    sessionCookie = ''

    @CookieAttrsHook('session')
    sessionAttrs: TCookieAttributes = { httpOnly: true }

    @Get('example')
    example() {
        this.status = 201
        this.customHeader = 'some-value'
        this.sessionCookie = 'new-token'
        this.sessionAttrs = { maxAge: '1h', httpOnly: true }
        return { ok: true }
    }
}
```

Assigning to `this.status`, `this.customHeader`, etc. directly sets the response status, headers, and cookies. The initial values serve as defaults.

## Constructor injection

Any `@Injectable()` class can be injected through constructor parameters:

```ts
import { Injectable } from 'moost'

@Injectable()
export class UserService {
    findById(id: string) {
        return { id, name: 'John' }
    }
}
```

```ts
import { Controller, Param } from 'moost'
import { Get } from '@moostjs/event-http'
import { UserService } from './user.service'

@Controller('users')
export class UserController {
    constructor(private userService: UserService) {}

    @Get(':id')
    find(@Param('id') id: string) {
        return this.userService.findById(id)
    }
}
```

Moost resolves `UserService` automatically when creating `UserController`.

## @Provide and @Inject

For interface-based injection or when you need custom factories:

```ts
import { Provide, Inject, Controller } from 'moost'

// Register a factory for a token
@Provide('CONFIG', () => ({ apiUrl: 'https://api.example.com' }))
@Controller()
export class AppController {
    constructor(@Inject('CONFIG') private config: { apiUrl: string }) {}

    @Get('config')
    getConfig() {
        return this.config
    }
}
```

## Scope rules

::: warning
A `SINGLETON` class **cannot** depend on a `FOR_EVENT` class. The singleton is created once, so it can't receive a new instance per request.

A `FOR_EVENT` class **can** depend on a `SINGLETON` class — it just receives the shared instance.
:::

```
SINGLETON → SINGLETON    ✅
FOR_EVENT → SINGLETON    ✅
FOR_EVENT → FOR_EVENT    ✅
SINGLETON → FOR_EVENT    ❌ will not work correctly
```

When in doubt, keep your controllers as singletons and use handler parameters for request-specific data. Switch to `FOR_EVENT` only when property-level resolvers or per-request state provide a clear benefit.
