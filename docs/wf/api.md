# API Reference

Complete reference for all exports from `@moostjs/event-wf`.

[[toc]]

## Decorators

### `@Workflow(path?)`

Marks a controller method as a workflow entry point. Must be paired with `@WorkflowSchema`.

- **`path`** *(string, optional)* — Workflow identifier. Defaults to the method name. Can include route parameters (e.g., `'process/:type'`).

```ts
import { Workflow, WorkflowSchema } from '@moostjs/event-wf'

@Workflow('order-processing')
@WorkflowSchema<TOrderContext>(['validate', 'charge', 'ship'])
processOrder() {}
```

The effective schema ID combines the controller prefix and the workflow path. For `@Controller('admin')` + `@Workflow('order')`, the schema ID is `admin/order`.

### `@WorkflowSchema<T>(schema)`

Attaches a workflow schema (step sequence) to a `@Workflow` method.

- **`T`** *(generic)* — Workflow context type. Provides type checking in condition functions.
- **`schema`** *(`TWorkflowSchema<T>`)* — Array of step definitions.

```ts
@WorkflowSchema<TMyContext>([
  'step-a',
  { condition: (ctx) => ctx.ready, id: 'step-b' },
  { while: 'retries < 3', steps: ['attempt', 'increment'] },
])
```

See [Schemas & Flow Control](/wf/schemas) for full schema syntax.

### `@Step(path?)`

Marks a controller method as a workflow step handler.

- **`path`** *(string, optional)* — Step identifier used in schemas. Defaults to the method name. Can include route parameters (e.g., `'notify/:channel'`).

```ts
@Step('validate')
validate(@WorkflowParam('context') ctx: TOrderContext) {
  ctx.validated = true
}
```

### `WorkflowParam(name)`

Parameter and property decorator that injects workflow runtime values.

- **`name`** — One of the following:

| Name | Type | Description |
|------|------|-------------|
| `'context'` | `T` | Shared workflow context object |
| `'input'` | `I \| undefined` | Input passed to `start()` or `resume()` |
| `'stepId'` | `string \| null` | Current step ID (`null` in entry point) |
| `'schemaId'` | `string` | Active workflow schema identifier |
| `'indexes'` | `number[] \| undefined` | Position in nested schemas |
| `'resume'` | `boolean` | `true` when resuming, `false` on first run |
| `'state'` | `object` | The full accessor object from [`useWfState()`](#usewfstate) |

```ts
// As method parameter:
@Step('process')
process(@WorkflowParam('context') ctx: TCtx, @WorkflowParam('input') input?: TInput) {}

// As class property (requires @Injectable('FOR_EVENT')):
@WorkflowParam('context')
ctx!: TMyContext
```

::: info
`WorkflowParam('resume')` returns a **boolean**, not a function. It indicates whether the current execution is a resume (`true`) or a fresh start (`false`). The resume *function* is available on the `TFlowOutput` object returned by `start()` or `resume()`.
:::

## MoostWf Class

`MoostWf<T, IR>` is the workflow adapter. Register it with `app.adapter(new MoostWf())`.

- **`T`** — Workflow context type
- **`IR`** — Input-required type (the type of `inputRequired` values)

### Constructor

```ts
new MoostWf<T, IR>(opts?: WooksWf<T, IR> | TWooksWfOptions, debug?: boolean)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `opts` | `WooksWf \| TWooksWfOptions \| undefined` | Pre-existing WooksWf instance, configuration options, or `undefined` for defaults |
| `debug` | `boolean` | Enable error logging |

::: info
`WooksWf` is an upstream type — import it from `@wooksjs/event-wf`, not from `@moostjs/event-wf` (it is not re-exported).
:::

**`TWooksWfOptions` fields:**

| Field | Type | Description |
|-------|------|-------------|
| `onError` | `(e: Error) => void` | Global error handler |
| `onNotFound` | `TWooksHandler` | Handler for unregistered steps |
| `onUnknownFlow` | `(schemaId: string, raiseError: () => void) => unknown` | Handler for unknown workflow schemas |
| `logger` | `TConsoleBase` | Custom logger instance |
| `eventOptions` | `EventContextOptions` | Event context configuration |
| `router` | `TWooksOptions['router']` | Router configuration |
| `strictStepIds` | `boolean` | When `true`, registering a duplicate step ID throws instead of warning |

::: warning Duplicate step IDs
By default (`strictStepIds: false`), registering a `@Step` ID that already exists logs a warning and the **first** registration wins — later registrations are silently ignored. Set `strictStepIds: true` (e.g. in CI) to fail loudly on step-id collisions.
:::

### `start<I>(schemaId, initialContext, opts?)`

Starts a new workflow execution.

```ts
start<I>(
  schemaId: string,
  initialContext: T,
  opts?: {
    input?: I
    eventContext?: EventContext
    strategy?: { name: string }
  },
): Promise<TFlowOutput<T, I, IR>>
```

| Parameter | Description |
|-----------|-------------|
| `schemaId` | Workflow identifier (matching `@Workflow` path, including controller prefix) |
| `initialContext` | Initial context object passed to steps |
| `opts.input` | Optional input for the first step |
| `opts.eventContext` | Parent event context (e.g. from `current()` inside an HTTP handler) — links the run to a parent scope so steps can read its composables |
| `opts.strategy` | `{ name }` of the initial state strategy. A step may later swap it via `swapStrategy(name)` |

```ts
const result = await wf.start('process-order', { orderId: '123' }, { input: { source: 'web' } })
```

::: warning Breaking change in 0.6.18
Prior versions accepted `input` as a positional third argument. Wrap it in `{ input }`.
:::

### `resume<I>(state, opts?)`

Resumes a paused workflow from a saved state.

```ts
resume<I>(
  state: { schemaId: string, context: T, indexes: number[] },
  opts?: {
    input?: I
    eventContext?: EventContext
    strategy?: { name: string }
  },
): Promise<TFlowOutput<T, I, IR>>
```

| Parameter | Description |
|-----------|-------------|
| `state` | State object from a previous `TFlowOutput.state` |
| `opts.input` | Input for the paused step |
| `opts.eventContext` | Parent event context (see `start` above) |
| `opts.strategy` | `{ name }` of the strategy that loaded this state — used by offline resume drivers; the HTTP trigger passes it automatically |

```ts
const resumed = await wf.resume(previousResult.state, { input: { answer: 'yes' } })
```

### `attachSpy<I>(fn)`

Attaches a spy function to observe workflow execution. Returns a detach function.

```ts
attachSpy<I>(fn: TWorkflowSpy<T, I, IR>): () => void
```

```ts
const detach = wf.attachSpy((event, eventOutput, flowOutput, ms) => {
  console.log(event, flowOutput.stepId, ms)
})
detach() // stop observing
```

See [Spies & Observability](/wf/spies) for event types and usage patterns.

### `detachSpy<I>(fn)`

Removes a previously attached spy function.

```ts
detachSpy<I>(fn: TWorkflowSpy<T, I, IR>): void
```

### `handleOutlet(config)`

Handles an outlet trigger request within an HTTP handler. Reads `wfid` and `wfs` from the request, starts or resumes a workflow, and dispatches pauses to registered outlets.

```ts
handleOutlet(config: WfOutletTriggerConfig): Promise<unknown>
```

| Parameter | Description |
|-----------|-------------|
| `config` | Outlet trigger configuration — see [Outlets](/wf/outlets) for full details |

```ts
@Post('flow')
async flow() {
  return this.wf.handleOutlet({
    allow: ['auth/login'],
    state: new EncapsulatedStateStrategy({ secret: process.env.WF_SECRET! }),
    outlets: [createHttpOutlet()],
  })
}
```

::: info
Must be called from within an HTTP event context so that wooks HTTP composables are available. Routes through `MoostWf.start()` and `resume()` internally to preserve DI scope cleanup.
:::

### `getWfApp()`

Returns the underlying `WooksWf` instance for advanced low-level access.

```ts
getWfApp(): WooksWf<T, IR>
```

## Decorators (Outlets)

### `@StepTTL(ttlMs)`

Sets TTL (in ms) for the workflow state when this step pauses. The adapter wraps the step handler to set `expires` on the outlet signal.

- **`ttlMs`** *(number)* — Time-to-live in milliseconds.

```ts
@Step('send-email')
@StepTTL(30 * 60 * 1000) // 30 minutes
async sendEmail(@WorkflowParam('context') ctx: any) {
  return outletEmail(ctx.email, 'verify')
}
```

## Types

### `TFlowOutput<T, I, IR>`

Returned by `start()` and `resume()`. A discriminated union of three shapes — finished, paused, or failed:

```ts
type TFlowOutput<T, I, IR> = TFlowFinished<T, IR> | TFlowPaused<T, I, IR> | TFlowFailed<T, I, IR>

// shared by all three:
state: {
  schemaId: string      // workflow identifier
  context: T            // current context (with all mutations)
  indexes: number[]     // position in schema ([] on completion)
}
stepId: string          // last executed step ID

// finished — workflow completed all steps
{ finished: true, state, stepId }

// paused — a step returned { inputRequired }
{
  finished: false, state, stepId,
  inputRequired: IR     // the value the step returned
  resume: (input: I) => Promise<TFlowOutput<T, unknown, IR>>
  expires?: number      // absolute epoch-ms deadline (Date.now() + ttl)
  errorList?: unknown
}

// failed — a step threw StepRetriableError
{
  finished: false, state, stepId,
  error: Error          // the original error
  retry: (input?: I) => Promise<TFlowOutput<T, unknown, IR>>
  inputRequired?: IR
  expires?: number
  errorList?: unknown
}
```

Notes:

- `error` implies `finished: false` — a **regular** (non-retriable) error makes `start()`/`resume()` reject instead of returning an output.
- `resume` exists only on paused outputs; `retry` only on failed ones. Both are in-process closures that re-enter through the workflow engine (with a fresh event context) — equivalent to calling `wf.resume(result.state, { input })`. For retries that cross process boundaries, serialize `result.state` and call `wf.resume()` — see [Error Handling](/wf/errors#retrying).
- `expires` is an absolute timestamp, conventionally stamped via [`@StepTTL`](#stepttl-ttlms).

### `TWorkflowSchema<T>`

Schema definition — an array of workflow items:

```ts
type TWorkflowSchema<T> = TWorkflowItem<T>[]

type TWorkflowItem<T> =
  | string                              // simple step ID
  | TWorkflowStepSchemaObj<T, any>      // step with condition/input
  | TSubWorkflowSchemaObj<T>            // nested steps (with optional while)
  | TWorkflowControl<T>                 // break or continue

interface TWorkflowStepSchemaObj<T, I> {
  id: string
  condition?: string | ((ctx: T) => boolean | Promise<boolean>)
  input?: I
}

interface TSubWorkflowSchemaObj<T> {
  steps: TWorkflowSchema<T>
  condition?: string | ((ctx: T) => boolean | Promise<boolean>)
  while?: string | ((ctx: T) => boolean | Promise<boolean>)
}

type TWorkflowControl<T> =
  | { continue: string | ((ctx: T) => boolean | Promise<boolean>) }
  | { break: string | ((ctx: T) => boolean | Promise<boolean>) }
```

### `TWorkflowSpy<T, I, IR>`

Spy callback type for observing workflow execution:

```ts
type TWorkflowSpy<T, I, IR> = (
  event: string,
  eventOutput: string | undefined | {
    fn: string | ((ctx: T) => boolean | Promise<boolean>)
    result: boolean
  },
  flowOutput: TFlowSpyData<T, IR>,
  ms?: number,
) => void
```

`flowOutput` is a `TFlowSpyData` snapshot (`state`, `finished`, `stepId`, `inputRequired?`, `interrupt?`, `error?`, `expires?`, `errorList?`) — unlike `TFlowOutput`, it carries **no** `resume`/`retry` functions. See [Spies & Observability](/wf/spies).

### `StepRetriableError<IR>`

Error class for recoverable step failures:

```ts
class StepRetriableError<IR> extends Error {
  constructor(
    originalError: Error,
    errorList?: unknown,
    inputRequired?: IR,
    expires?: number, // absolute deadline: Date.now() + ttlMs
  )

  readonly originalError: Error
  errorList?: unknown
  readonly inputRequired?: IR
  expires?: number
}
```

## Outlet Types

### `WfOutletTriggerConfig`

Configuration for `handleOutlet()`:

```ts
interface WfOutletTriggerConfig {
  allow?: string[]
  block?: string[]
  state: WfStateStrategy | { strategies: Record<string, WfStateStrategy>; default: string | ((wfid: string) => string) }
  outlets: WfOutlet[]
  token?: WfOutletTokenConfig
  wfidName?: string
  initialContext?: (body: Record<string, unknown> | undefined, wfid: string) => unknown
  onFinished?: (ctx: { context: unknown; schemaId: string }) => unknown
}
```

### `WfOutletTriggerDeps`

The `{ start, resume }` dependency callbacks consumed by [`handleWfOutletRequest()`](#handlewfoutletrequest-config-deps). Provided automatically by `MoostWf.handleOutlet()` / `createOutletHandler()` — implement it only for custom trigger wiring.

### `WfOutletTokenConfig`

Token read/write configuration:

```ts
interface WfOutletTokenConfig {
  read?: Array<'body' | 'query' | 'cookie'>
  write?: 'body' | 'cookie'
  name?: string
}
```

### `WfStateStrategy`

State persistence interface:

```ts
interface WfStateStrategy {
  persist(
    state: WfState,
    options?: { ttl?: number },
    overrides?: { handle?: string }, // hint to reuse a handle so the wfs stays stable across resumes
  ): Promise<string>
  retrieve(token: string): Promise<WfState | null>          // no invalidation
  consume(token: string): Promise<WfState | null>           // atomic retrieve + invalidate (mutex against concurrent resumes)
}
```

`HandleStateStrategy` honors the `handle` hint and reuses the same storage key on every resume — the `wfs` token is a stable session credential, not single-use. `EncapsulatedStateStrategy` ignores the hint (the ciphertext is a function of the state, so the token changes on every state mutation regardless). See [Outlets — Token Stability & Resume Semantics](./outlets.md#token-stability--resume-semantics).

### `WfOutlet`

Delivery channel interface:

```ts
interface WfOutlet {
  readonly name: string
  readonly tokenDelivery?: 'caller' | 'out-of-band' // default 'caller'
  deliver(request: WfOutletRequest, token: string): Promise<WfOutletResult | void>
}
```

`tokenDelivery` controls whether the state token is returned to the HTTP caller or only delivered through the outlet's own channel — security-critical for custom outlets. See [Outlets — Out-of-Band Outlets](/wf/outlets#out-of-band-outlets).

### `WfOutletRequest`

Argument passed to `WfOutlet.deliver()` — the outlet name plus the step's payload/target/template/context. See the custom-outlet example in [Outlets — Custom Outlets](/wf/outlets#custom-outlets).

### `WfOutletResult`

Optional return from `WfOutlet.deliver()` describing the HTTP response (`response`, `status`, `headers`, `cookies`). Return `void` for out-of-band channels.

### `WfPauseRequest`

The `WfOutletRequest` extended with an optional `stateStrategy` name — the pause signal carried back to the trigger when a step swaps strategy. See [Outlets — Swapping the Strategy at Runtime](/wf/outlets#swapping-the-strategy-at-runtime).

### `WfState`

Serializable workflow state record persisted by a `WfStateStrategy` / stored by a `WfStateStore`.

### `WfStateStore`

Storage backend used by `HandleStateStrategy` (`set`, `get`, `delete`, `getAndDelete`, optional `cleanup`). Implement it to back state with Redis or a database. See [Outlets — Custom Store](/wf/outlets#custom-store).

### `WfFinishedResponse`

Completion response set via `useWfFinished()`:

```ts
interface WfFinishedResponse {
  type: 'redirect' | 'data'
  value: unknown
  status?: number
  cookies?: Record<string, { value: string; options?: Record<string, unknown> }>
}
```

See [Outlets](/wf/outlets) for full usage details and examples.

## Outlet Helpers

### `outletHttp(payload, context?)`

Returns an outlet signal that pauses the workflow and triggers the HTTP outlet.

```ts
return outletHttp({ type: 'form', fields: ['email'] })
```

### `outletEmail(target, template, context?)`

Returns an outlet signal that pauses the workflow and triggers the email outlet.

```ts
return outletEmail('user@example.com', 'verify', { name: 'Alice' })
```

### `outlet(name, data?)`

Generic outlet signal for custom delivery channels.

```ts
return outlet('sms', { target: '+1234567890' })
```

### `createHttpOutlet(opts?)`

Creates an HTTP delivery outlet.

```ts
const httpOutlet = createHttpOutlet({ transform: (payload) => ({ ...payload, extra: true }) })
```

### `createEmailOutlet(send)`

Creates an email delivery outlet with a user-provided send function.

```ts
const emailOutlet = createEmailOutlet(async ({ target, template, context, token }) => {
  await mailer.send({ to: target, template, data: { ...context, link: `/flow?wfs=${token}` } })
})
```

### `createOutletHandler(wfApp)`

Lower-level building block: binds an outlet trigger to anything exposing `start`/`resume` (a `WooksWf` instance or a `MoostWf`). Returns a `(config) => Promise<unknown>` handler. `MoostWf.handleOutlet()` is this, pre-bound — use it unless you are wiring a raw `WooksWf` app.

```ts
const handler = createOutletHandler(wf.getWfApp())
// later, inside an HTTP handler:
return handler({ allow: ['auth/login'], state, outlets: [httpOutlet] })
```

### `handleWfOutletRequest(config, deps)`

The lowest-level trigger function: `createOutletHandler` and `MoostWf.handleOutlet` both delegate here. `deps` is a `WfOutletTriggerDeps` object — `{ start, resume }` callbacks the trigger uses to run the workflow. Only needed when you must intercept or wrap start/resume yourself.

### `EncapsulatedStateStrategy`

Stateless strategy — encrypts workflow state into the token (AES-256-GCM).

```ts
new EncapsulatedStateStrategy({ secret: '...', defaultTtl?: number })
```

### `HandleStateStrategy`

Server-side strategy — stores state in a `WfStateStore`, token is an opaque handle.

```ts
new HandleStateStrategy({ store: WfStateStore, defaultTtl?: number, generateHandle?: () => string })
```

### `WfStateStoreMemory`

In-memory `WfStateStore` for development and testing.

```ts
const store = new WfStateStoreMemory()
```

## Composables

### `useWfState()`

Returns the current workflow execution state. Available inside step and entry point handlers.

```ts
import { useWfState } from '@moostjs/event-wf'

const state = useWfState()
state.ctx<TMyContext>()      // workflow context
state.input<TMyInput>()     // step input (or undefined)
state.schemaId              // workflow schema ID (property)
state.stepId()              // current step ID (or null)
state.indexes()             // position in nested schemas (accessor function)
state.resume                // boolean: is this a resume? (property)
```

::: info
In most cases, use `@WorkflowParam` decorators instead of calling `useWfState()` directly. The composable is useful for advanced scenarios like custom interceptors or utilities that need workflow context.
:::

### `useWfOutlet()`

Returns outlet infrastructure accessors. Available inside step handlers during outlet-driven workflows.

```ts
import { useWfOutlet } from '@moostjs/event-wf'

const { getOutlets, getOutlet } = useWfOutlet()
```

Most steps do not need this — use `outletHttp()` / `outletEmail()` / `outlet()` instead.

### `useWfStrategy()`

Inspects or swaps the active state strategy name from within a step. Returns `{ current(), swap(name) }`; the swapped name applies to the **next** pause. See [Outlets — Swapping the Strategy at Runtime](/wf/outlets#swapping-the-strategy-at-runtime).

```ts
import { useWfStrategy } from '@moostjs/event-wf'

const { current, swap } = useWfStrategy()
```

### `swapStrategy(name)`

Sugar for `useWfStrategy().swap(name)` — switches the strategy used for the next pause. Use when a step escalates from cheap encapsulated state to durable storage before a long-running pause. See [Outlets — Swapping the Strategy at Runtime](/wf/outlets#swapping-the-strategy-at-runtime).

```ts
import { swapStrategy } from '@moostjs/event-wf'

swapStrategy('kv')
```

### `useWfFinished()`

Sets the completion response for a finished workflow. The outlet handler uses this to determine the HTTP response when the workflow completes.

```ts
import { useWfFinished } from '@moostjs/event-wf'

useWfFinished().set({ type: 'redirect', value: '/dashboard' })
useWfFinished().get() // returns the set response, or undefined
```

See [Outlets — Workflow Completion](/wf/outlets#workflow-completion) for details.

### `wfKind`

Event kind marker for workflow events. Used internally by the adapter and useful for building custom event-type-aware logic.

```ts
import { wfKind } from '@moostjs/event-wf'
```
