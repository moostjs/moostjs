# Workflow Adapter — @moostjs/event-wf

Moost adapter over `@wooksjs/event-wf` + `@prostojs/wf` for multi-step workflows with pause/resume, schemas, and HTTP/email outlets.

- [Concepts](#concepts)
- [MoostWf](#moostwf)
- [Decorators & composables](#decorators--composables)
- [Schemas & flow control](#schemas--flow-control)
- [Start / resume / TFlowOutput](#start--resume--tflowoutput)
- [Error handling](#error-handling)
- [Spies](#spies)
- [Outlets](#outlets)
- [Integration (HTTP / CLI)](#integration-http--cli)
- [Gotchas](#gotchas)

## Concepts

- **Step** — method with `@Step('id')`; reads/mutates shared context.
- **Schema** — array defining execution order, conditions, loops.
- **Context** — typed shared state across steps.
- **Workflow entry** — `@Workflow('id')` + `@WorkflowSchema<T>([...])`.
- **`TFlowOutput`** — result of `start()`/`resume()`: finished | paused (resume) | failed (retry).

Use workflows for multi-stage processes needing branching, pause for external input, auditability, or time-spanning execution.

**Key imports.** Every symbol in this file is exported from `'@moostjs/event-wf'` — the single entry point. That includes the outlet toolkit re-exported from `@wooksjs/event-wf` (`createHttpOutlet`, `createEmailOutlet`, `createOutletHandler`, `handleWfOutletRequest`, `useWfOutlet`, `useWfFinished`, `useWfStrategy`, `swapStrategy`, `useWfState`, `wfKind`) and the outlet primitives re-exported from `@prostojs/wf/outlets` (`outlet`, `outletHttp`, `outletEmail`, `EncapsulatedStateStrategy`, `HandleStateStrategy`, `WfStateStoreMemory`, plus their types). Do NOT import these from `@wooksjs/event-wf` or `@prostojs/wf` directly — they are not direct dependencies of the app, and cross-package class identity (e.g. `StepRetriableError`) is not guaranteed.

```ts
import { Controller, Injectable, Moost } from 'moost'
import { MoostWf, Step, Workflow, WorkflowParam, WorkflowSchema } from '@moostjs/event-wf'

interface TOrderCtx { orderId: string; validated: boolean; charged: boolean }

@Injectable('FOR_EVENT')
@Controller()
class OrderCtrl {
  @WorkflowParam('context') ctx!: TOrderCtx
  @Workflow('process-order')
  @WorkflowSchema<TOrderCtx>(['validate', 'charge'])
  processOrder() {}
  @Step('validate') validate() { this.ctx.validated = true }
  @Step('charge')   charge()   { this.ctx.charged = true }
}

const app = new Moost()
const wf = new MoostWf()
app.adapter(wf)
app.registerControllers(OrderCtrl)
await app.init()
const result = await wf.start('process-order', { orderId: 'ORD-001', validated: false, charged: false })
```

## MoostWf

```ts
new MoostWf<T, IR>(opts?: WooksWf<T, IR> | TWooksWfOptions, debug?: boolean)
```

`TWooksWfOptions`: `onError`, `onNotFound`, `onUnknownFlow`, `logger`, `eventOptions`, `router`, `strictStepIds` (`true` = duplicate `@Step` id registration throws instead of warning).

Adapter name is `'workflow'`.

Methods beyond `start`/`resume`/`handleOutlet`:

- `wf.resolveSchemaId(id, { eventContext? })` → registered flow id `start()` would run (`'auth/login'` → `'/auth/login'`, `'user/42'` → `'/user/:id'`) or `undefined`. moost registers flows as `/${path}`, so `state.schemaId` starts with `/`; compare ids with `normalizeWfId()` (strips leading slashes; re-exported).
- `wf.mint({ wfid, context?, input?, state, ttl?, meta?, eventContext? })` → `{ token, inputRequired, expiresAt, output }` — headless start (no request) persisting the first pause like the trigger; `token` (`<strategy>.<handle>`) resumes through the trigger with the SAME `state` config. No outlet called (deliver the token yourself); `allow`/`block` NOT checked at mint, enforced on resume. `ttl` in **ms**.
- Run DI scope: every run releases its `FOR_EVENT` scope when it ends/pauses, WHOEVER starts it — `wf.start()`, `wf.getWfApp().start()/resume()`, `createOutletHandler(wf.getWfApp())`, `mintWfToken(wf.getWfApp())` (MoostWf replaces its `WooksWf` instance's `start`/`resume`, so build `createOutletHandler(wooksWf)` AFTER `new MoostWf(wooksWf)` — one built before captured the unpatched methods — or use `wf.handleOutlet()`; a run-option `cleanup` runs BEFORE the scope is released; up to and including `0.6.53` only `MoostWf.start/resume` released it → leaked scopes).

## Decorators & composables

### `@Step(path?)`

Method = step handler. Path = method name by default. Parametric paths resolve via Wooks router:

```ts
@Step('notify/:channel(email|sms)')
notify(@Param('channel') c: 'email' | 'sms') {}
// schema reference: { id: 'notify/email' }
```

### `@Workflow(path?)` + `@WorkflowSchema<T>(schema)`

Workflow entry. Effective schema ID = controller prefix + workflow path (e.g. `@Controller('admin')` + `@Workflow('order')` = `admin/order`).

### `@StepTTL(ttlMs)`

Set TTL for paused state when this step pauses — on BOTH pause paths: returning an `inputRequired` object and throwing a `StepRetriableError`/`requireInput()` (since 0.6.23). The adapter stamps `expires: Date.now() + ttlMs` on the signal (an `expires` already set on a thrown error is respected); the outlet trigger converts it back to `strategy.persist(state, { ttl })`.

### `WorkflowParam(name)` (param or property)

| name | type |
|---|---|
| `'context'` | `T` — shared context |
| `'input'` | `I \| undefined` — from `start()`/`resume()` |
| `'stepId'` | `string \| null` (null in entry) |
| `'schemaId'` | `string` |
| `'indexes'` | `number[] \| undefined` — position in nested schemas |
| `'resume'` | `boolean` (true when resuming) |
| `'state'` | full `useWfState()` accessor object |

Property form requires `@Injectable('FOR_EVENT')`.

### `useWfState()`

Alternative to `@WorkflowParam`: returns `{ ctx<T>(), input<I>(), schemaId, stepId(), indexes(), resume }` — `schemaId` and `resume` are plain properties; `ctx`, `input`, `stepId`, `indexes` are functions you must call.

### `wfKind`

Event kind marker for workflow events.

## Schemas & flow control

### Linear

```ts
@WorkflowSchema(['build', 'test', 'publish'])
```

### Conditional

Function condition (type-safe) or string condition (serializable). String conditions use `new Function()` + `with(ctx)` — context props available directly: `'amount > 100'`.

```ts
@WorkflowSchema<TCtx>([
  'prepare',
  { condition: (ctx) => ctx.audienceSize > 0, id: 'request-approval' },
  { condition: 'approved', id: 'send-emails' },
])
```

### Loops

`while` with nested `steps`. `break` / `continue` accept function or string:

```ts
@WorkflowSchema<TCtx>([
  { while: 'running', steps: [
    'check-temperature',
    { break:    'temperature > safeLimit' },
    'process-batch',
    { continue: 'skipCooling' },
    'cool-down',
  ]},
  'shutdown',
])
```

### Nested sub-workflows (shared condition)

```ts
{ condition: (ctx) => ctx.size > 1000, steps: ['segment', 'schedule', 'warm-up'] }
```

### Inline input

```ts
@WorkflowSchema([
  { id: 'notify', input: { channel: 'email' } },
  { id: 'notify', input: { channel: 'sms' } },
])
```

### Schema item forms

`TWorkflowSchema<T>` (exported from `@moostjs/event-wf`) is an array; each item is one of:

1. `'step-id'` — run unconditionally (step objects use `id`, NOT `step`)
2. `{ id, condition?, input? }` — step with optional condition / inline input
3. `{ steps: [...], condition? }` — nested group; `{ steps: [...], while: cond }` — loop
4. `{ break: cond }` / `{ continue: cond }` — loop control (only inside `steps`)

All conditions accept a `(ctx) => boolean | Promise<boolean>` function or a serializable string.

## Start / resume / TFlowOutput

```ts
wf.start<I>(schemaId, initialContext, opts?): Promise<TFlowOutput<T, I, IR>>
wf.resume<I>(state, opts?):                    Promise<TFlowOutput<T, I, IR>>
```

Opts bag (`TWfRunOptions`): `input?` (step input), `eventContext?` (parent ctx for composable inheritance, e.g. `current()` from an HTTP handler; the run still gets its OWN DI scope — `FOR_EVENT` instances are not shared with the parent, see [di.md#scopes](di.md#scopes)), `strategy?: { name }` (initial state strategy in named-registry mode).

**Breaking in 0.6.18.** Both methods used to take `input` as a positional arg; now it lives on the opts bag. `wf.start('flow', ctx, val)` → `wf.start('flow', ctx, { input: val })`.

`TFlowOutput` (exported from `@moostjs/event-wf`) is a discriminated union — switch on `finished` then `error`:

- **finished**: `{ finished: true, state, stepId }` — nothing else; no error/resume/retry.
- **paused** (step returned `{ inputRequired }`): `finished: false` + `inputRequired` + `resume(input)` + optional `expires`/`errorList`. No `error`.
- **failed** (step threw `StepRetriableError`): `finished: false` + `error` + `retry(input?)` + optional `inputRequired`/`expires`/`errorList`. No `resume`.

There is NO `interrupt` or `break` field on any variant. `state` is `{ schemaId, context, indexes, meta? }` — plain JSON, safe to persist; pass it back to `wf.resume()`.

### Pause & resume

Return `{ inputRequired: ... }` from a step to pause (value is anything — form schema, enum, …):

```ts
@Step('collect-address')
collectAddress(@WorkflowParam('context') ctx: TCtx, @WorkflowParam('input') input?: TAddr) {
  if (!input) return { inputRequired: { fields: ['street', 'city'] } }
  ctx.address = input
}
```

Resume:

```ts
if (!result.finished) await result.resume({ street: '123 Main St' })
// or cross-process:
const r2 = await wf.resume(savedState, { input: userInput })
```

**Expiration.** `@StepTTL(ms)` or return `{ inputRequired, expires: Date.now() + ttl }`. Informational — the engine does NOT enforce it; your app must reject stale resumes.

## Error handling

- **Regular `Error`** → rejects the promise (no retry, not captured in output).
- **`StepRetriableError`** → produces `finished: false` + `error` + `retry()`.

```ts
@Step('charge-card')
charge(@WorkflowParam('input') input?: TPayment) {
  try { processPayment(input) }
  catch (e) {
    throw new StepRetriableError(e as Error, [{ code: 'DECLINED' }], { type: 'payment-form' })
    // new StepRetriableError(originalError, errorList?, inputRequired?, expires?)
  }
}
```

| Scenario | Use |
|---|---|
| Bug, invalid config | `Error` |
| External service down | `StepRetriableError` |
| User validation failure | `StepRetriableError` with `errorList` + `inputRequired` |
| Rate limit hit | `StepRetriableError` with `expires` |

## Spies

```ts
const detach = wf.attachSpy((event, eventOutput, spyData, ms) => {
  console.log(`[${event}] step=${spyData.stepId} (${ms}ms)`)
})
```

Events: `workflow-start` / `workflow-end` / `workflow-interrupt` (fresh runs, eventOutput = schemaId), `resume-start` / `resume-end` / `resume-interrupt` (resumed runs use the `resume` base event, NOT `workflow`), `subflow-start` / `subflow-end` / `subflow-interrupt` (eventOutput = `''`), `step` (eventOutput = stepId, `ms` = step duration), `eval-condition-fn` / `eval-while-cond` / `eval-break-fn` / `eval-continue-fn` (eventOutput = `{ fn, result }`, `ms` = eval duration), `error` (non-retriable throw, eventOutput = error message). `ms` is present only on `step`/`eval-*`. The third arg is a `TFlowSpyData` snapshot (has `interrupt?`, no `resume`/`retry`).

## Outlets

Delivery channels for pause/resume. When a step pauses, an outlet delivers payload (HTTP response, email) and accepts the resume trigger.

### Signal helpers — return from step to pause + trigger outlet

```ts
outlet(name, data?)                      // generic
outletHttp(payload, context?)            // pause, reply over HTTP
outletEmail(target, template, context?)  // pause, trigger email
```

### State strategies

**Selection rule.** Any flow with real-world side effects (auth, credentials, money, permissions, invites) MUST use `HandleStateStrategy` — only it has server-side state (required for revocation and fail-closed semantics on unexpected errors). Use `EncapsulatedStateStrategy` only when every step is idempotent and replay-within-TTL is harmless.

**`EncapsulatedStateStrategy`** — encrypts state into a self-contained token (stateless).

```ts
new EncapsulatedStateStrategy({ secret: process.env.SECRET!, defaultTtl: 3_600_000 })
```
Pros: zero infra, scales horizontally. Cons: **stateless — cannot be invalidated** (`consume()` is a no-op alias for `retrieve()`; a copy of the token remains valid until TTL). The ciphertext changes when state mutates, so the response token differs from the request token on every state-mutating resume — clients must read the renewed `wfs` from each response. NOT for auth / password reset / invite accept / financial ops.

**`HandleStateStrategy`** — state server-side, token is a stable handle.

```ts
new HandleStateStrategy({
  store: new WfStateStoreMemory(),    // or custom WfStateStore
  defaultTtl: 3_600_000,
  generateHandle: () => crypto.randomUUID(),
})
```
Pros: small tokens, server-side revocation, **fail-closed on unexpected errors** (the engine re-persists under the same handle only *after* the step returns — an unexpected throw burns the handle). The `wfs` is minted on start and reused for the entire workflow run (engine passes `{ handle: token }` to `persist()` since `@wooksjs/event-wf` 0.7.14), so refresh / bookmark / lost-connection retry / magic-link reopen all keep working with the same URL token. Cons: needs persistent store in production (`WfStateStoreMemory` is dev-only — loses state on restart).

**`WfStateStoreMemory`** — in-memory store for dev/testing. `WfStateStore` interface: `set`, `get`, `delete`, `getAndDelete`, `cleanup?`.

All strategies implement `WfStateStrategy`: `persist(state, { ttl? }, { handle? }): token`, `retrieve(token)`, `consume(token)`. The `handle` override (third arg) is the 0.7.14+ hint for handle reuse; `HandleStateStrategy` honors it, `EncapsulatedStateStrategy` ignores it.

**Named strategy registry (since `@wooksjs/event-wf` 0.7.16).** `state` accepts either a single `WfStateStrategy` (shortcut, auto-promoted under name `'default'`) or `{ strategies: Record<name, WfStateStrategy>, default: name | ((wfid, flowId) => name) }` (`flowId` = the registered flow id `wfid` resolved to). The active strategy name is embedded in the issued token as `<name>.<raw>`, so resume always picks the strategy that persisted the state — each strategy can have its own independent storage. Names must match `/^[A-Za-z0-9_-]+$/`. The old `(wfid) => WfStateStrategy` function form was removed in this version.

**Swapping strategies mid-run.** A step can call `swapStrategy('kv')` (sugar for `useWfStrategy().swap('kv')`) to escalate from cheap encapsulated state to durable storage right before a long-running pause. The new name applies to the **next** pause — it travels back to the trigger via `output.inputRequired.stateStrategy` and prefixes the issued token. The composable only validates name format; the trigger validates existence at pause time and throws loudly on unknown names. `useWfStrategy().current()` reports the active name. Removed `useWfOutlet().getStateStrategy()` — use `useWfStrategy().current()` instead.

### Trigger handlers

**`wf.handleOutlet(config)`** — call inside an HTTP handler. Reads `wfid`/`wfs` from request, starts or resumes, dispatches pauses to outlets.

```ts
@Post('workflow')
async triggerWorkflow() {
  return this.wf.handleOutlet({
    state: strategy,
    outlets: [createHttpOutlet(), createEmailOutlet(sendFn)],
    allow: ['onboarding'],
    token: { read: ['body', 'query'], write: 'body', name: 'wfs' },
    initialContext: (body) => ({ email: body?.email }),
  })
}
```

**`createOutletHandler(wfApp)`** — pre-wired handler factory (wires `resolveSchemaId` too).

**Access control (`allow` / `block`)** — enforced on START and RESUME, judged on the RESOLVED registered flow id (not the caller's spelling): `block: ['admin']` refuses `'/admin'`, `'adm%69n'`, any `ignoreCase` casing and every instance of a parametric flow. `allow` fails closed: an entry must equal the registered id (the pattern for a parametric flow), `allow: []` admits NOTHING (omit `allow` for no restriction). A refused resume → 403 and the token is NOT consumed. With lists set, a `wfid` resolving to no flow → 404. `handleOutlet` wires `resolveSchemaId`.

**Refusals are THROWN `HttpError`s with a `code`** (were returned `{ error }` bodies up to wooks 0.7.x / moost `0.6.53`): `WF_MISSING` / `WF_INVALID` (400), `WF_INVALID_TOKEN` / `WF_EXPIRED` (410), `WF_FORBIDDEN` (403, `params.reason` `'not-allowed' | 'blocked'`, `params.wfid` on start), `WF_NOT_FOUND` (404, `params.wfid`), `WF_UNKNOWN_OUTLET` (500, `params.outlet`). Text is in `body.message` (`body.error` = status text) — clients read `body.message ?? body.error`. They reach error interceptors (translate via `code`). Table: `WF_TRIGGER_ERRORS`, type `WfTriggerErrorCode` (re-exported).

**`createHttpOutlet(opts?)`** — HTTP outlet (pass payload as response). Optional `transform` callback.

**`createEmailOutlet(send)`** — delegates to a send function receiving `{ target, template, context, token }`.

### Token semantics

- **Stable session credential (since `@wooksjs/event-wf` 0.7.14).** With `HandleStateStrategy` the `wfs` is minted on start, reused across every resume (engine re-persists under the same handle), and dies on finish or unexpected error. With `EncapsulatedStateStrategy` the ciphertext rotates on every state-mutating persist — clients must always read the renewed `wfs` from the response.
- **`consume()` as concurrent-resume mutex**: every resume calls `strategy.consume(token)` atomically before the step. Two tabs racing the same `wfs`: one wins, the other gets a thrown `HttpError` **410 Gone** with `code: 'WF_EXPIRED'` (`message: 'Invalid or expired workflow state'`). After the winner re-persists, the loser's *next* attempt succeeds — the token is alive again.
- **Fail-closed**: consume fires before the step; re-persist happens only after the step returns. An unexpected throw during resume skips re-persist, the handle is gone, user must restart. Handle expected failures (wrong password, invalid input, rate limit) by returning an outlet signal instead of throwing; the engine re-persists under the same handle on the re-pause, so the same `wfs` keeps working.
- **Replay protection at workflow layer, not transport.** The record advances after each successful step — a replayed token resumes from the current step, not a previous one. Steps with non-idempotent side effects should guard themselves (idempotency keys, advance counters), not rely on token rotation.
- **`tokenDelivery`** on `WfOutlet`: `'caller'` (default for `createHttpOutlet`) merges token into HTTP response; `'out-of-band'` (default for `createEmailOutlet`) suppresses body/cookie write so the HTTP caller doesn't receive the token. Custom outlets whose resumer is a different principal than the HTTP caller (SMS, Slack, webhook) MUST declare `'out-of-band'` — otherwise it's a privilege escalation vector.

### Outlet composables

- **`useWfOutlet()`** — `getOutlets()`, `getOutlet(name)`. (`getStateStrategy()` removed in 0.7.16 — use `useWfStrategy().current()`.)
- **`useWfStrategy()`** — `current(): string` (active strategy name) / `swap(name)` (apply to next pause). `swapStrategy(name)` is sugar for `swap`.
- **`useWfFinished()`** — `.set({ type: 'redirect', value: '/dashboard' })` / `.set({ type: 'data', value, status })` / `.get(): WfFinishedResponse | undefined`.

### Outlet types — usage rules

All exported from `@moostjs/event-wf` (do not import from `@wooksjs/event-wf` / `@prostojs/wf`):

- **`WfOutletTriggerConfig`** (the `handleOutlet` arg): `state` (strategy or named registry — required), `outlets: WfOutlet[]` (required), `allow?`/`block?` (flow-id white/blacklist on start AND resume; omitted `allow` = no restriction, `allow: []` = NOTHING allowed), `token?: WfOutletTokenConfig`, `wfidName?` (default `'wfid'`), `initialContext?: (body, wfid, flowId) => ctx`, `onFinished?: ({ context, schemaId }) => response`.
- **`WfOutletTokenConfig`**: `read` (default `['body','query','cookie']`), `write` (`'body'` default | `'cookie'`), `name` (default `'wfs'`).
- **`WfOutlet`** (implement for custom channels): `name`, optional `tokenDelivery: 'caller' | 'out-of-band'` (default `'caller'`), `deliver(req, token)` returning `WfOutletResult | void`. `WfOutletResult` carries `response`/`status`/`headers`/`cookies`; return `void` for out-of-band channels.
- **`WfOutletRequest`** (what `deliver` receives, what `outlet()` produces): `{ outlet, payload?, target?, template?, context? }`. `WfPauseRequest` = same + `stateStrategy?` (set when a step swapped strategy).
- **`WfStateStrategy`** (implement for custom persistence): `persist(state, { ttl? }, { handle? })` → token, `retrieve(token)`, `consume(token)` (atomic retrieve+invalidate — used as concurrent-resume mutex). The `handle` override is the hint to reuse a storage key so `wfs` stays stable; `HandleStateStrategy` honors it, `EncapsulatedStateStrategy` ignores it.
- **`WfStateStore`** (backend for `HandleStateStrategy`): `set(handle, state, expiresAt?)`, `get`, `delete`, `getAndDelete`, optional `cleanup()`. `WfState` is the persisted flow-state record.
- **`WfFinishedResponse`** (set via `useWfFinished().set(...)`): `{ type: 'redirect' | 'data', value, status?, cookies? }`.
- **`WfOutletTriggerDeps`** (`{ start, resume }` callbacks): only needed with the low-level `handleWfOutletRequest(config, deps)`; `wf.handleOutlet()` / `createOutletHandler()` supply it for you.

### Full outlet example

```ts
@Injectable('FOR_EVENT')
@Controller('onboarding')
class OnboardingWf {
  @WorkflowParam('context') ctx!: TOnboardingCtx
  @Workflow('signup')
  @WorkflowSchema(['collect-email', 'verify', 'welcome'])
  signup() {}

  @Step('collect-email')
  collectEmail(@WorkflowParam('input') input?: { email: string }) {
    if (!input) return outletHttp({ fields: ['email'] })
    this.ctx.email = input.email
  }
  @Step('verify')
  @StepTTL(60 * 60 * 1000)
  verify() { return outletEmail(this.ctx.email, 'verify-email') }
  @Step('welcome')
  welcome() { useWfFinished().set({ type: 'redirect', value: '/dashboard' }) }
}

@Controller('api')
class ApiController {
  constructor(private wf: MoostWf) {}
  @Post('onboarding')
  async handle() {
    return this.wf.handleOutlet({
      allow: ['onboarding/signup'],
      // Security-sensitive — HandleStateStrategy gives server-side state, revocation, and fail-closed semantics.
      state: new HandleStateStrategy({ store: redisStore }),
      outlets: [createHttpOutlet(), createEmailOutlet(sendMail)],
    })
  }
}
```

## Integration (HTTP / CLI)

Inject `MoostWf` via constructor DI.

```ts
@Controller('tickets')
class TicketController {
  constructor(private wf: MoostWf<TTicketCtx>) {}
  @Post() async create(@Body() body: { description: string }) {
    const result = await this.wf.start('support-ticket', {
      ticketId: generateId(), description: body.description, status: 'new',
    })
    return { finished: result.finished, state: result.finished ? undefined : result.state }
  }
  @Post(':id/resume') async resume(@Body() body: { state: any; input: any }) {
    return this.wf.resume(body.state, { input: body.input })
  }
}
```

Standard Moost features work on steps (interceptors, pipes, DI).

## Gotchas

- `@WorkflowParam('resume')` is a **boolean**, not a function. Resume *function* is on `TFlowOutput`.
- Regular errors reject the promise (not captured in output). Only `StepRetriableError` produces `finished: false` + `retry()`.
- `expires` is informational — engine doesn't enforce.
- `result.resume` / `result.retry` are in-process closures (re-enter the engine with a fresh event context, equivalent to `wf.resume(result.state, { input })`). Across process boundaries, serialize `result.state` and call `wf.resume()`.
- Duplicate `@Step` ids warn and the FIRST registration wins by default; set `strictStepIds: true` (e.g. in CI) to fail loudly.
- `MoostWf.start` / `.resume` take an opts bag since 0.6.18 (`{ input, eventContext, strategy }`). Calling with a positional `input` arg silently passes the value as the opts object — the step will read `undefined` for input. Always wrap: `{ input }`.
- String conditions use `new Function()` + `with(ctx)`; only context props are in scope.
- Step IDs are router paths: `'process/items'` = two segments.
- Adapter name is `'workflow'` (`wf.name === 'workflow'`).
- `@Workflow` entry method body should be empty — all logic in steps.
- Controllers holding per-workflow state MUST be `@Injectable('FOR_EVENT')`; otherwise class properties leak between concurrent workflows.
- `app.init()` must complete before calling `wf.start()` — steps are registered during init.
- `state` object is plain JSON — safe to serialize/store.

## See also

- [event-http.md](./event-http.md) — HTTP handlers that trigger/resume workflows (outlet endpoints)
- [interceptors.md](./interceptors.md) — cross-cutting concerns around steps and workflow entry
- [di.md](./di.md) — `FOR_EVENT` scoping for per-workflow controller state
