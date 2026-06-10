# HTTP Authentication — @moostjs/event-http

Declarative auth guards with credential extraction and Swagger security-scheme auto-discovery.

Key imports: `defineAuthGuard`, `AuthGuard`, `Authenticate`, `extractTransports`, `HttpError` ← `@moostjs/event-http`; `Injectable`, `Intercept`, `defineBeforeInterceptor`, `TInterceptorPriority` ← `moost`. See also: [event-http.md](event-http.md) (adapter/routing), [http-request.md](http-request.md) (`@Authorization` for raw header parts).

- [Concepts](#concepts)
- [defineAuthGuard](#defineauthguard)
- [AuthGuard (class)](#authguard-class)
- [@Authenticate](#authenticate)
- [Transports](#transports)
- [Patterns](#patterns)
- [extractTransports](#extracttransports)
- [Types](#types)
- [Gotchas](#gotchas)

## Concepts

Three pieces: **transport declaration** (where credentials come from), **handler** (verification logic), **`@Authenticate`** (attach guard to controller/handler). Guards run at `GUARD` priority. Transport declarations are stored in metadata so `@moostjs/swagger` auto-generates OpenAPI security schemes.

Two APIs: `defineAuthGuard` (functional, stateless) and `AuthGuard` (class-based, DI).

## defineAuthGuard

```ts
const jwtGuard = defineAuthGuard(
  { bearer: { format: 'JWT' } },
  (transports) => {
    const user = verifyJwt(transports.bearer)
    if (!user) throw new HttpError(401, 'Invalid token')
    // return a value to short-circuit with that response (instead of continuing to the handler)
  },
)
```

Returns `TAuthGuardDef` — a `TInterceptorDef` plus transport metadata.

## AuthGuard (class)

Use when DI is needed.

```ts
@Injectable()
class JwtGuard extends AuthGuard<{ bearer: { format: 'JWT' } }> {
  static transports = { bearer: { format: 'JWT' } } as const
  constructor(private userService: UserService) {}
  handle(t: { bearer: string }) {
    const user = this.userService.verifyToken(t.bearer)
    if (!user) throw new HttpError(401, 'Invalid token')
  }
}
```

Requirements: extend `AuthGuard<T>`, set `static transports` matching `T` (read at runtime, not inferred from the generic), implement `handle(transports)`, add `@Injectable()`.

## @Authenticate

Accepts either a `defineAuthGuard` result or an `AuthGuard` subclass.

```ts
// Controller-level — all handlers protected
@Authenticate(jwtGuard)
@Controller('users')
class UsersController {}

// Handler-level ADDS a second guard — both must pass
@Authenticate(apiKeyGuard)
@Controller('products')
class ProductsController {
  @Get('') list() { /* apiKeyGuard */ }
  @Authenticate(basicGuard) @Post('') create() { /* apiKeyGuard AND basicGuard */ }
}
```

Guards stack — they never replace each other. For a different guard per endpoint, apply `@Authenticate` only at the handler level. (Exception: the generated OpenAPI security requirement uses only the handler-level transports when present.)

## Transports

```ts
// Bearer — extracts raw token (no "Bearer " prefix)
{ bearer: { format?: string; description?: string } }
// → string

// Basic — extracts { username, password }
{ basic: { description?: string } }
// → { username: string; password: string }

// API key — from header / query / cookie
{ apiKey: { name: string; in: 'header' | 'query' | 'cookie'; description?: string } }
// → string

// Cookie
{ cookie: { name: string; description?: string } }
// → string
```

## Patterns

### API key guard

```ts
const apiKeyGuard = defineAuthGuard(
  { apiKey: { name: 'X-API-Key', in: 'header' } },
  (t) => { if (!isValidApiKey(t.apiKey)) throw new HttpError(401, 'Invalid API key') },
)
```

### Auth + authorization stacking

`@Authenticate` only verifies credentials. Add a separate authorization interceptor (also at `GUARD` priority — runs after auth in declaration order):

```ts
const adminGuard = defineBeforeInterceptor((reply) => {
  // read principal from context (set by jwtGuard) and check role
}, TInterceptorPriority.GUARD)

@Authenticate(jwtGuard)
@Intercept(adminGuard)
@Controller('admin')
class AdminController {}
```

### Class-based session guard

```ts
@Injectable()
class SessionGuard extends AuthGuard<{ cookie: { name: 'session' } }> {
  static transports = { cookie: { name: 'session' } } as const
  constructor(private sessions: SessionService) {}
  handle(t: { cookie: string }) {
    if (!this.sessions.validate(t.cookie)) throw new HttpError(401, 'Invalid session')
  }
}
```

## extractTransports

Low-level primitive — usually not needed directly. Extracts credentials from the current request and throws `HttpError(401, 'No authentication credentials provided')` if none present.

```ts
const values = extractTransports({ bearer: { format: 'JWT' } })  // { bearer: 'eyJ…' }
```

## Types

`TAuthTransportDeclaration`, `TAuthTransportValues`, `TAuthGuardDef`, `TAuthGuardClass`, `TAuthGuardHandler` and the per-transport option interfaces (`TAuthTransportBearer`/`Basic`/`ApiKey`/`Cookie`) are exported from `@moostjs/event-http`. The exact declaration/value shapes are shown in [Transports](#transports).

## Gotchas

1. Missing all declared transports → `extractTransports` throws 401 automatically; handler is never called.
2. Controller-level + handler-level `@Authenticate` are additive — both guards run; there is no runtime override.
3. Class-based guards: `static transports` is read at runtime — the generic alone is not enough.
4. Guard's `handle` returning a value short-circuits with that value (useful for redirects / custom auth responses). `undefined` continues.
5. Guards run at `GUARD` priority — execute before `INTERCEPTOR` priority.
6. Transport declarations feed `@moostjs/swagger` — keep them accurate.
