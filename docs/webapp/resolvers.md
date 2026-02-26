# Custom Resolvers & Pipes

Moost's built-in decorators (`@Param`, `@Body`, `@Query`, etc.) cover common cases. When you need custom parameter resolution or value transformation, use `@Resolve` and `@Pipe`.

## Custom resolvers with @Resolve

The `@Resolve` decorator lets you create a parameter that resolves its value from any logic:

```ts
import { Resolve } from 'moost'
import { Get } from '@moostjs/event-http'
import { useRequest } from '@wooksjs/event-http'

function CurrentUser() {
    return Resolve(() => {
        const req = useRequest()
        const token = req.headers.authorization?.replace('Bearer ', '')
        return token ? verifyAndDecodeToken(token) : null
    }, 'currentUser')
}
```

The second argument (`'currentUser'`) is a label used in error messages and swagger documentation.

Use it like any other resolver decorator:

```ts
@Controller('profile')
export class ProfileController {
    @Get('')
    getProfile(@CurrentUser() user: User) {
        return user
    }
}
```

### Resolver with access to metadata

The resolver function receives metadata about the decorated parameter and the decoration level:

```ts
function FromConfig(key: string) {
    return Resolve((metas, level) => {
        // metas.instance — the controller instance (if available)
        // metas.key — the property/parameter name
        // level — 'PARAM' for handler params, 'PROP' for class properties
        return config.get(key)
    }, `config:${key}`)
}

@Controller()
export class AppController {
    @Get('settings')
    settings(@FromConfig('app.name') appName: string) {
        return { appName }
    }
}
```

### Resolver on class properties

In `FOR_EVENT` controllers, custom resolvers work on properties too:

```ts
@Injectable('FOR_EVENT')
@Controller()
export class ApiController {
    @CurrentUser()
    user!: User

    @Get('profile')
    profile() {
        return this.user
    }
}
```

## Pipes

Pipes transform, validate, or modify resolved values as they flow through the parameter pipeline. Every parameter goes through this pipeline:

```
BEFORE_RESOLVE → RESOLVE → AFTER_RESOLVE → BEFORE_TRANSFORM → TRANSFORM
→ AFTER_TRANSFORM → BEFORE_VALIDATE → VALIDATE → AFTER_VALIDATE
```

The built-in resolvers (`@Param`, `@Body`, etc.) operate at `RESOLVE` priority. You can add pipes at any other stage.

### Writing a pipe

Use `definePipeFn` to create a pipe function:

```ts
import { definePipeFn, TPipePriority } from 'moost'

const toNumber = definePipeFn((value, metas, level) => {
    if (typeof value === 'string') {
        const num = Number(value)
        if (Number.isNaN(num)) {
            throw new Error(`"${metas.paramName}" must be a number`)
        }
        return num
    }
    return value
}, TPipePriority.TRANSFORM)
```

Arguments:
- `value` — the current value (output of previous pipe)
- `metas` — metadata about the parameter (name, type, decorators)
- `level` — decoration level (`'PARAM'` or `'PROP'`)

### Applying pipes

#### Per parameter

```ts
import { Pipe } from 'moost'

@Get('items/:id')
getItem(@Param('id') @Pipe(toNumber) id: number) {
    return { id, type: typeof id } // { id: 42, type: 'number' }
}
```

#### Per handler

All parameters of the handler pass through the pipe:

```ts
@Pipe(toNumber)
@Get('range/:min/:max')
range(@Param('min') min: number, @Param('max') max: number) {
    return { min, max }
}
```

#### Per controller

All parameters across all handlers:

```ts
@Pipe(toNumber)
@Controller('api')
export class ApiController { /* ... */ }
```

#### Globally

```ts
const app = new Moost()
app.applyGlobalPipes(toNumber)
```

### Validation pipe

A pipe at `VALIDATE` priority can reject invalid values:

```ts
const validatePositive = definePipeFn((value, metas) => {
    if (typeof value === 'number' && value <= 0) {
        throw new HttpError(400, `"${metas.paramName}" must be positive`)
    }
    return value
}, TPipePriority.VALIDATE)
```

Stack multiple pipes — they run in priority order:

```ts
@Get('items/:id')
getItem(
    @Param('id')
    @Pipe(toNumber)
    @Pipe(validatePositive)
    id: number,
) {
    return { id }
}
```

### Turning pipes into decorators

For cleaner syntax, wrap a pipe:

```ts
const ToNumber = Pipe(toNumber)
const Positive = Pipe(validatePositive)

@Get('items/:id')
getItem(@Param('id') @ToNumber @Positive id: number) {
    return { id }
}
```

Or combine multiple pipes into one decorator:

```ts
import { ApplyDecorators } from 'moost'

const PositiveInt = ApplyDecorators(Pipe(toNumber), Pipe(validatePositive))

@Get('items/:id')
getItem(@Param('id') @PositiveInt id: number) {
    return { id }
}
```

## Pipe priority reference

| Priority | Value | Use case |
|---|---|---|
| `BEFORE_RESOLVE` | 0 | Pre-processing before resolution |
| `RESOLVE` | 1 | Value resolution (built-in) |
| `AFTER_RESOLVE` | 2 | Post-resolution adjustment |
| `BEFORE_TRANSFORM` | 3 | Pre-transform checks |
| `TRANSFORM` | 4 | Type coercion, formatting |
| `AFTER_TRANSFORM` | 5 | Post-transform verification |
| `BEFORE_VALIDATE` | 6 | Pre-validation setup |
| `VALIDATE` | 7 | Validation logic |
| `AFTER_VALIDATE` | 8 | Post-validation cleanup |
