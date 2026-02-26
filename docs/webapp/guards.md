# Guards & Authorization

Guards are interceptors that control access to handlers. While [Authentication](./auth) covers *who* the user is, guards decide *what* they're allowed to do.

::: tip
For credential extraction (bearer tokens, basic auth, API keys), use the dedicated [Authentication](./auth) system. The patterns below are for **authorization** — checking roles, permissions, and policies after the user is identified.
:::

## Basic guard

A guard is an interceptor with `GUARD` priority that throws on unauthorized access:

```ts
import { defineInterceptorFn, TInterceptorPriority } from 'moost'
import { HttpError } from '@moostjs/event-http'

const adminGuard = defineInterceptorFn(() => {
    const user = getCurrentUser() // your auth logic
    if (!user?.isAdmin) {
        throw new HttpError(403, 'Admin access required')
    }
}, TInterceptorPriority.GUARD)
```

Apply with `@Intercept`:

```ts
import { Intercept, Controller } from 'moost'
import { Get } from '@moostjs/event-http'

@Intercept(adminGuard)
@Controller('admin')
export class AdminController {
    @Get('dashboard')
    dashboard() { return { stats: '...' } }
}
```

## Guard decorator

Turn the interceptor into a reusable decorator:

```ts
import { Intercept } from 'moost'

const AdminOnly = Intercept(adminGuard)

@AdminOnly
@Controller('admin')
export class AdminController { /* ... */ }
```

## Role-based guard

Create a decorator factory that accepts a role:

```ts
import { Intercept, defineInterceptorFn, TInterceptorPriority } from 'moost'
import { HttpError } from '@moostjs/event-http'

const RequireRole = (role: string) => {
    const fn = defineInterceptorFn(() => {
        const user = getCurrentUser()
        if (!user?.roles.includes(role)) {
            throw new HttpError(403, `Role "${role}" required`)
        }
    }, TInterceptorPriority.GUARD)
    return Intercept(fn)
}
```

Usage:

```ts
@RequireRole('editor')
@Controller('articles')
export class ArticleController {
    @Get('')
    list() { /* editors only */ }

    @RequireRole('admin')
    @Delete(':id')
    remove() { /* admins only — overrides controller-level guard */ }
}
```

## Permission-based guard

Check specific permissions instead of roles:

```ts
const RequirePermission = (...permissions: string[]) => {
    const fn = defineInterceptorFn(() => {
        const user = getCurrentUser()
        const missing = permissions.filter(p => !user?.permissions.includes(p))
        if (missing.length > 0) {
            throw new HttpError(403, `Missing permissions: ${missing.join(', ')}`)
        }
    }, TInterceptorPriority.GUARD)
    return Intercept(fn)
}

@Controller('users')
export class UserController {
    @RequirePermission('users:read')
    @Get('')
    list() { /* ... */ }

    @RequirePermission('users:write')
    @Post('')
    create() { /* ... */ }

    @RequirePermission('users:write', 'users:delete')
    @Delete(':id')
    remove() { /* ... */ }
}
```

## Class-based guard with DI

When your guard needs services from the DI container:

```ts
import { Injectable, TInterceptorPriority } from 'moost'
import type { TInterceptorClass, TInterceptorFn } from 'moost'
import { HttpError } from '@moostjs/event-http'

@Injectable()
export class PermissionGuard implements TInterceptorClass {
    static priority = TInterceptorPriority.GUARD

    constructor(private permissionService: PermissionService) {}

    handler: TInterceptorFn = () => {
        if (!this.permissionService.check()) {
            throw new HttpError(403)
        }
    }
}
```

For a parameterized class-based guard, pair the class with a factory:

```ts
@Injectable('FOR_EVENT')
export class RoleGuard implements TInterceptorClass {
    static priority = TInterceptorPriority.GUARD

    constructor(private authService: AuthService) {}

    // role is set externally via metadata or factory
    role = ''

    handler: TInterceptorFn = () => {
        if (!this.authService.hasRole(this.role)) {
            throw new HttpError(403, `Role "${this.role}" required`)
        }
    }
}
```

## Combining authentication + authorization

A common pattern is to stack auth and guard decorators:

```ts
@Authenticate(jwtGuard)        // step 1: extract and verify credentials
@RequireRole('admin')          // step 2: check authorization
@Controller('admin')
export class AdminController {
    @Get('dashboard')
    dashboard() { /* authenticated + admin role */ }

    @RequirePermission('analytics:view')
    @Get('analytics')
    analytics() { /* authenticated + admin + analytics permission */ }
}
```

Authentication runs at `GUARD` priority. Custom guards also run at `GUARD` priority. Within the same priority, interceptors run in the order they're declared (outermost decorator first).

## Applying guards globally

Protect the entire application:

```ts
const app = new Moost()
app.applyGlobalInterceptors(adminGuard)
```

For per-controller or per-handler exceptions to a global guard, you'll need a guard that checks metadata or route info to decide whether to enforce. Consider the [Authentication](./auth) system with handler-level overrides for this pattern.
