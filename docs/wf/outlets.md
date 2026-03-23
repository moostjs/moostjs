# Outlets

Outlets extend the pause/resume model with **state persistence** and **delivery channels**. Instead of manually serializing workflow state and building resume endpoints, outlets handle the full cycle: persist paused state into a token, deliver that token to the user (via HTTP response or email), and resume the workflow when the token comes back.

This is ideal for multi-step HTTP flows — login, registration, password recovery, checkout — where each step collects user input through a form, email link, or API call.

## How Outlets Work

1. A step pauses by returning an **outlet signal** (`outletHttp(...)` or `outletEmail(...)`)
2. The outlet handler **persists** the workflow state into a token (encrypted or server-stored)
3. The appropriate **outlet delivers** the token — HTTP outlet returns it in the response body, email outlet sends it in a link
4. The user **resumes** by sending the token back (in a form submission, query param, or cookie)
5. The outlet handler **retrieves** the state from the token and resumes the workflow

All of this is orchestrated by a single method: `moostWf.handleOutlet(config)`.

## Setup

Install or update the required packages:

```bash
pnpm add @moostjs/event-wf@latest
```

The outlet APIs come from the underlying packages (`@prostojs/wf` v0.1.1+ and `@wooksjs/event-wf` v0.7.8+), but everything is re-exported from `@moostjs/event-wf` for convenience — you only need one import source.

## Quick Example

A login flow with an HTTP outlet that serves forms and collects user input:

```ts
import { Controller, Post, Injectable } from 'moost'
import {
  MoostWf,
  Workflow, WorkflowSchema, Step, WorkflowParam,
  outletHttp, useWfFinished,
  createHttpOutlet, EncapsulatedStateStrategy,
} from '@moostjs/event-wf'

const state = new EncapsulatedStateStrategy({ // [!code focus]
  secret: process.env.WF_SECRET!, // 32-byte hex string // [!code focus]
}) // [!code focus]

const httpOutlet = createHttpOutlet() // [!code focus]

@Injectable()
@Controller('auth')
class AuthController {
  constructor(private wf: MoostWf) {}

  @Post('flow')
  async flow() {
    return this.wf.handleOutlet({ // [!code focus]
      allow: ['auth/login'], // [!code focus]
      state, // [!code focus]
      outlets: [httpOutlet], // [!code focus]
    }) // [!code focus]
  }

  @Workflow('auth/login')
  @WorkflowSchema(['credentials', 'create-session'])
  loginFlow() {}

  @Step('credentials')
  async credentials(
    @WorkflowParam('input') input?: { username: string; password: string },
    @WorkflowParam('context') ctx: any,
  ) {
    if (input) {
      ctx.userId = await verifyCredentials(input.username, input.password)
      return
    }
    return outletHttp({ type: 'login-form', fields: ['username', 'password'] }) // [!code focus]
  }

  @Step('create-session')
  async createSession(@WorkflowParam('context') ctx: any) {
    const session = await createUserSession(ctx.userId)
    useWfFinished().set({ // [!code focus]
      type: 'redirect',
      value: '/dashboard',
      cookies: { sid: { value: session.id, options: { httpOnly: true } } },
    })
  }
}
```

**What happens at runtime:**

1. Client sends `POST /auth/flow` with `{ "wfid": "auth/login" }`
2. Workflow starts → `credentials` step returns `outletHttp(...)` → workflow pauses
3. State is encrypted into a token → HTTP outlet returns the form payload + token (`wfs`) in the response
4. Client renders the form, user fills it in, sends `POST /auth/flow` with `{ "wfs": "<token>", "username": "...", "password": "..." }`
5. State is decrypted from token → workflow resumes at `credentials` with input → `create-session` runs → workflow finishes
6. Response includes the redirect and session cookie from `useWfFinished()`

## The `handleOutlet` Method

`MoostWf.handleOutlet(config)` is the single entry point for outlet-driven workflows. Call it from any HTTP handler — it reads `wfid` and `wfs` from the request, starts or resumes the workflow, and returns the result.

```ts
@Post('flow')
async flow() {
  return this.wf.handleOutlet({
    allow: ['auth/login', 'auth/recovery'],  // which workflows are allowed
    state: stateStrategy,                     // how to persist/retrieve paused state
    outlets: [httpOutlet, emailOutlet],       // delivery channels
  })
}
```

It routes through `MoostWf.start()` and `resume()` internally, so all Moost DI, interceptors, and pipes work normally in your workflow steps.

### Configuration

The full `WfOutletTriggerConfig` interface:

| Field | Type | Description |
|-------|------|-------------|
| `allow` | `string[]` | Whitelist of workflow IDs that can be started. Empty = all allowed |
| `block` | `string[]` | Blacklist of workflow IDs (checked after `allow`) |
| `state` | `WfStateStrategy \| (wfid: string) => WfStateStrategy` | State persistence strategy (required) |
| `outlets` | `WfOutlet[]` | Registered delivery channels (required) |
| `token` | `WfOutletTokenConfig` | Token read/write/naming configuration |
| `wfidName` | `string` | Request parameter name for workflow ID (default: `'wfid'`) |
| `initialContext` | `(body, wfid) => unknown` | Factory for initial workflow context |
| `onFinished` | `(ctx) => unknown` | Override the completion response |

### Token Configuration

Control where the state token is read from and written to:

```ts
this.wf.handleOutlet({
  // ...
  token: {
    read: ['body', 'query', 'cookie'],  // where to look for the token (default: all three)
    write: 'body',                       // where to write the token in the response (default: 'body')
    name: 'wfs',                         // parameter name (default: 'wfs')
    consume: { email: true },            // consume (invalidate) tokens per outlet
  },
})
```

When `consume` is enabled for an outlet, the token is deleted from the store after retrieval — useful for single-use email magic links. With `EncapsulatedStateStrategy` (stateless tokens), consumption has no effect since there is no server-side state to delete.

## State Strategies

A state strategy controls how paused workflow state is persisted and retrieved. Two strategies are provided.

### EncapsulatedStateStrategy

Encrypts the entire workflow state into the token itself using AES-256-GCM. No server-side storage needed — the token is self-contained.

```ts
import { EncapsulatedStateStrategy } from '@moostjs/event-wf'

const state = new EncapsulatedStateStrategy({
  secret: process.env.WF_SECRET!, // must be exactly 32 bytes (64-char hex string)
  defaultTtl: 30 * 60 * 1000,    // optional: default expiration (30 minutes)
})
```

**Pros:** Zero infrastructure, horizontally scalable, no cleanup needed.
**Cons:** Tokens are larger (they contain the full state), cannot be revoked server-side.

### HandleStateStrategy

Stores state server-side with an opaque handle as the token. Requires a `WfStateStore` implementation.

```ts
import { HandleStateStrategy, WfStateStoreMemory } from '@moostjs/event-wf'

// In-memory store (for development/testing)
const store = new WfStateStoreMemory()

const state = new HandleStateStrategy({
  store,
  defaultTtl: 30 * 60 * 1000,
  generateHandle: () => crypto.randomUUID(), // optional custom handle generator
})
```

**Pros:** Small tokens, server-side revocation, true token consumption.
**Cons:** Requires a persistent store in production.

#### Custom Store

Implement `WfStateStore` to use your own database:

```ts
import type { WfStateStore, WfState } from '@moostjs/event-wf'

class RedisStateStore implements WfStateStore {
  constructor(private redis: RedisClient) {}

  async set(handle: string, state: WfState, expiresAt?: number) {
    const ttl = expiresAt ? Math.ceil((expiresAt - Date.now()) / 1000) : 0
    await this.redis.set(`wf:${handle}`, JSON.stringify(state), ttl ? { EX: ttl } : {})
  }

  async get(handle: string) {
    const data = await this.redis.get(`wf:${handle}`)
    return data ? { state: JSON.parse(data) } : null
  }

  async delete(handle: string) {
    await this.redis.del(`wf:${handle}`)
  }

  async getAndDelete(handle: string) {
    const data = await this.get(handle)
    if (data) await this.delete(handle)
    return data
  }
}
```

### Per-Workflow Strategy

Pass a function to use different strategies per workflow:

```ts
this.wf.handleOutlet({
  state: (wfid) => {
    if (wfid.startsWith('auth/')) return authStrategy
    return defaultStrategy
  },
  // ...
})
```

## Outlets

An outlet is a delivery channel that sends the state token to the user. Two outlets are provided.

### HTTP Outlet

Returns the outlet payload as the HTTP response body. The client receives the form definition and the state token, renders the form, and submits back to the same endpoint.

```ts
import { createHttpOutlet } from '@moostjs/event-wf'

const httpOutlet = createHttpOutlet()

// With a transform function to reshape the payload:
const httpOutlet = createHttpOutlet({
  transform: (payload, context) => ({
    ...payload,
    csrfToken: generateCsrf(),
  }),
})
```

In your step, return `outletHttp(payload)` to trigger the HTTP outlet:

```ts
@Step('collect-address')
async collectAddress(
  @WorkflowParam('input') input?: TAddress,
  @WorkflowParam('context') ctx: TCheckoutContext,
) {
  if (input) {
    ctx.address = input
    return
  }
  return outletHttp({
    type: 'address-form',
    fields: ['street', 'city', 'zip', 'country'],
    defaults: ctx.address,
  })
}
```

The response the client receives looks like:

```json
{
  "wfs": "<encrypted-or-handle-token>",
  "inputRequired": {
    "outlet": "http",
    "payload": {
      "type": "address-form",
      "fields": ["street", "city", "zip", "country"],
      "defaults": null
    }
  }
}
```

### Email Outlet

Sends a token via email. You provide the send function — the outlet handles token generation and delivery orchestration.

```ts
import { createEmailOutlet } from '@moostjs/event-wf'

const emailOutlet = createEmailOutlet(async ({ target, template, context, token }) => {
  await mailer.send({
    to: target,
    subject: getSubject(template),
    html: renderTemplate(template, {
      ...context,
      actionUrl: `https://app.example.com/auth/flow?wfs=${token}`,
    }),
  })
})
```

In your step, return `outletEmail(target, template, context?)` to send an email:

```ts
@Step('send-verification')
@StepTTL(30 * 60 * 1000) // link valid for 30 minutes
async sendVerification(@WorkflowParam('context') ctx: TRegistrationContext) {
  return outletEmail(ctx.email, 'verify-email', { name: ctx.name })
}
```

When the user clicks the link, the `wfs` token in the query string resumes the workflow.

### Custom Outlets

Implement the `WfOutlet` interface for other delivery channels (SMS, push notifications, webhooks):

```ts
import type { WfOutlet, WfOutletRequest, WfOutletResult } from '@moostjs/event-wf'

const smsOutlet: WfOutlet = {
  name: 'sms',
  async deliver(request: WfOutletRequest, token: string): Promise<WfOutletResult | void> {
    await smsService.send({
      to: request.target!,
      body: `Your code: ${token.slice(0, 6)}`, // short code from token
    })
    // Return void — no HTTP response needed for SMS
  },
}
```

Use the generic `outlet()` helper in your step:

```ts
import { outlet } from '@moostjs/event-wf'

@Step('send-sms-code')
async sendSmsCode(@WorkflowParam('context') ctx: any) {
  return outlet('sms', { target: ctx.phone })
}
```

## Step TTL

The `@StepTTL(ms)` decorator sets an expiration time on the paused state token. The state strategy uses this to auto-expire persisted state.

```ts
import { StepTTL } from '@moostjs/event-wf'

@Step('send-recovery-email')
@StepTTL(30 * 60 * 1000) // 30 minutes // [!code focus]
async sendRecoveryEmail(@WorkflowParam('context') ctx: any) {
  return outletEmail(ctx.email, 'recovery', { name: ctx.name })
}
```

Without `@StepTTL`, the strategy's `defaultTtl` is used (or no expiration if that is also unset).

You can also set expiration inline without the decorator:

```ts
return { ...outletEmail(ctx.email, 'recovery'), expires: Date.now() + 30 * 60 * 1000 }
```

## Workflow Completion

Use the `useWfFinished()` composable in the final step to control what the HTTP trigger returns when the workflow completes:

```ts
import { useWfFinished } from '@moostjs/event-wf'

@Step('complete')
async complete(@WorkflowParam('context') ctx: any) {
  useWfFinished().set({
    type: 'redirect',             // 'redirect' or 'data'
    value: '/dashboard',          // URL for redirect, or response body for data
    status: 302,                  // optional HTTP status
    cookies: {                    // optional cookies to set
      'session-id': {
        value: ctx.sessionId,
        options: { httpOnly: true, secure: true },
      },
    },
  })
}
```

If no `useWfFinished()` is called, the outlet handler returns the raw workflow output.

## Complete Example: Auth Workflows

A real-world controller with login and password recovery flows sharing a single HTTP endpoint:

```ts
import { Controller, Post, Injectable } from 'moost'
import {
  MoostWf,
  Workflow, WorkflowSchema, Step, WorkflowParam, StepTTL,
  outletHttp, outletEmail, useWfFinished,
  createHttpOutlet, createEmailOutlet,
  EncapsulatedStateStrategy,
} from '@moostjs/event-wf'

const stateStrategy = new EncapsulatedStateStrategy({
  secret: process.env.WF_SECRET!,
})

const httpOutlet = createHttpOutlet()

const emailOutlet = createEmailOutlet(async ({ target, template, context, token }) => {
  await mailer.send({
    to: target,
    template,
    data: { ...context, verifyUrl: `/auth/flow?wfs=${token}` },
  })
})

@Injectable()
@Controller('auth')
class AuthController {
  constructor(
    private wf: MoostWf,
    private users: UserService,
    private sessions: SessionService,
  ) {}

  // --- Single HTTP endpoint for all auth workflows ---

  @Post('flow')
  async flow() {
    return this.wf.handleOutlet({
      allow: ['auth/login', 'auth/recovery'],
      state: stateStrategy,
      outlets: [httpOutlet, emailOutlet],
      token: { consume: { email: true } },
    })
  }

  // --- Login workflow ---

  @Workflow('auth/login')
  @WorkflowSchema([
    'login-form',
    { condition: (ctx) => ctx.mfaRequired, steps: ['mfa-verify'] },
    'create-session',
  ])
  loginFlow() {}

  @Step('login-form')
  async loginForm(
    @WorkflowParam('input') input?: { username: string; password: string },
    @WorkflowParam('context') ctx: any,
  ) {
    if (input) {
      const user = await this.users.authenticate(input.username, input.password)
      ctx.userId = user.id
      ctx.mfaRequired = user.mfaEnabled
      return
    }
    return outletHttp({ type: 'login', fields: ['username', 'password'] })
  }

  @Step('mfa-verify')
  async mfaVerify(
    @WorkflowParam('input') input?: { code: string },
    @WorkflowParam('context') ctx: any,
  ) {
    if (input) {
      await this.users.verifyMfa(ctx.userId, input.code)
      return
    }
    return outletHttp({ type: 'mfa', fields: ['code'] })
  }

  // --- Recovery workflow ---

  @Workflow('auth/recovery')
  @WorkflowSchema(['recovery-email', 'send-link', 'reset-password', 'create-session'])
  recoveryFlow() {}

  @Step('recovery-email')
  async recoveryEmail(
    @WorkflowParam('input') input?: { email: string },
    @WorkflowParam('context') ctx: any,
  ) {
    if (input) {
      const user = await this.users.findByEmail(input.email)
      ctx.userId = user.id
      ctx.email = user.email
      ctx.name = user.name
      return
    }
    return outletHttp({ type: 'email-form', fields: ['email'] })
  }

  @Step('send-link')
  @StepTTL(30 * 60 * 1000) // 30-minute magic link
  async sendLink(@WorkflowParam('context') ctx: any) {
    return outletEmail(ctx.email, 'recovery', { name: ctx.name })
  }

  @Step('reset-password')
  async resetPassword(
    @WorkflowParam('input') input?: { password: string },
    @WorkflowParam('context') ctx: any,
  ) {
    if (input) {
      await this.users.resetPassword(ctx.userId, input.password)
      return
    }
    return outletHttp({ type: 'password-form', fields: ['password'] })
  }

  // --- Shared completion step ---

  @Step('create-session')
  async createSession(@WorkflowParam('context') ctx: any) {
    const session = await this.sessions.create(ctx.userId)
    useWfFinished().set({
      type: 'redirect',
      value: '/dashboard',
      cookies: { sid: { value: session.id, options: { httpOnly: true } } },
    })
  }
}
```

**Client-side flow for login:**

```
POST /auth/flow  { "wfid": "auth/login" }
  ← 200  { "wfs": "...", "inputRequired": { "outlet": "http", "payload": { "type": "login", ... } } }

POST /auth/flow  { "wfs": "...", "username": "alice", "password": "s3cret" }
  ← 200  { "wfs": "...", "inputRequired": { "outlet": "http", "payload": { "type": "mfa", ... } } }
  (or skip MFA if not required → redirect directly)

POST /auth/flow  { "wfs": "...", "code": "123456" }
  ← 302  Location: /dashboard   Set-Cookie: sid=...
```

**Client-side flow for recovery:**

```
POST /auth/flow  { "wfid": "auth/recovery" }
  ← 200  { "wfs": "...", "inputRequired": { "outlet": "http", "payload": { "type": "email-form", ... } } }

POST /auth/flow  { "wfs": "...", "email": "alice@example.com" }
  ← 200  (email sent, workflow paused at email outlet — no wfs in response)

GET /auth/flow?wfs=<token-from-email-link>
  ← 200  { "wfs": "...", "inputRequired": { "outlet": "http", "payload": { "type": "password-form", ... } } }

POST /auth/flow  { "wfs": "...", "password": "n3wP@ss" }
  ← 302  Location: /dashboard   Set-Cookie: sid=...
```

## Initial Context

Use `initialContext` to seed the workflow context from the request body when starting:

```ts
this.wf.handleOutlet({
  // ...
  initialContext: (body, wfid) => ({
    startedAt: Date.now(),
    source: body?.referrer ?? 'direct',
  }),
})
```

The function receives the parsed request body and the workflow ID.

## Composables

### `useWfOutlet()`

Advanced composable for accessing outlet infrastructure from within a workflow step:

```ts
import { useWfOutlet } from '@moostjs/event-wf'

const { getStateStrategy, getOutlets, getOutlet } = useWfOutlet()
```

Most steps do not need this — use `outletHttp()` / `outletEmail()` / `outlet()` instead.

### `useWfFinished()`

Sets the completion response when the workflow finishes. See [Workflow Completion](#workflow-completion) above.

```ts
import { useWfFinished } from '@moostjs/event-wf'

useWfFinished().set({ type: 'data', value: { success: true } })
```
