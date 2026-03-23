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
| `'indexes'` | `number[] \| undefined` | Current position in nested schemas |
| `'resume'` | `boolean` | `true` when resuming, `false` on first run |
| `'state'` | `object` | Full state object from `useWfState()` |

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

**`TWooksWfOptions` fields:**

| Field | Type | Description |
|-------|------|-------------|
| `onError` | `(e: Error) => void` | Global error handler |
| `onNotFound` | `TWooksHandler` | Handler for unregistered steps |
| `onUnknownFlow` | `(schemaId: string, raiseError: () => void) => unknown` | Handler for unknown workflow schemas |
| `logger` | `TConsoleBase` | Custom logger instance |
| `eventOptions` | `EventContextOptions` | Event context configuration |
| `router` | `TWooksOptions['router']` | Router configuration |

### `start<I>(schemaId, initialContext, input?)`

Starts a new workflow execution.

```ts
start<I>(
  schemaId: string,
  initialContext: T,
  input?: I,
): Promise<TFlowOutput<T, I, IR>>
```

| Parameter | Description |
|-----------|-------------|
| `schemaId` | Workflow identifier (matching `@Workflow` path, including controller prefix) |
| `initialContext` | Initial context object passed to steps |
| `input` | Optional input for the first step |

```ts
const result = await wf.start('process-order', { orderId: '123', status: 'new' })
```

### `resume<I>(state, input?)`

Resumes a paused workflow from a saved state.

```ts
resume<I>(
  state: { schemaId: string, context: T, indexes: number[] },
  input?: I,
): Promise<TFlowOutput<T, I, IR>>
```

| Parameter | Description |
|-----------|-------------|
| `state` | State object from a previous `TFlowOutput.state` |
| `input` | Input for the paused step |

```ts
const resumed = await wf.resume(previousResult.state, { answer: 'yes' })
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

Returned by `start()` and `resume()`. Describes the workflow's current state.

```ts
interface TFlowOutput<T, I, IR> {
  state: {
    schemaId: string      // workflow identifier
    context: T            // current context (with all mutations)
    indexes: number[]     // position in schema (for resume)
  }
  finished: boolean       // true if workflow completed all steps
  stepId: string          // last executed step ID
  inputRequired?: IR      // present when a step needs input
  interrupt?: boolean     // true when paused (input or retriable error)
  break?: boolean         // true if a break condition ended the flow
  resume?: (input: I) => Promise<TFlowOutput<T, unknown, IR>>   // resume convenience function
  retry?: (input?: I) => Promise<TFlowOutput<T, unknown, IR>>   // retry convenience function
  error?: Error           // error if step threw (retriable or regular)
  errorList?: unknown     // structured error details from StepRetriableError
  expires?: number        // TTL in ms (if set by the step)
}
```

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
  flowOutput: TFlowOutput<T, I, IR>,
  ms?: number,
) => void
```

### `StepRetriableError<IR>`

Error class for recoverable step failures:

```ts
class StepRetriableError<IR> extends Error {
  constructor(
    originalError: Error,
    errorList?: unknown,
    inputRequired?: IR,
    expires?: number,
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
  state: WfStateStrategy | ((wfid: string) => WfStateStrategy)
  outlets: WfOutlet[]
  token?: WfOutletTokenConfig
  wfidName?: string
  initialContext?: (body: Record<string, unknown> | undefined, wfid: string) => unknown
  onFinished?: (ctx: { context: unknown; schemaId: string }) => unknown
}
```

### `WfOutletTokenConfig`

Token read/write configuration:

```ts
interface WfOutletTokenConfig {
  read?: Array<'body' | 'query' | 'cookie'>
  write?: 'body' | 'cookie'
  name?: string
  consume?: boolean | Record<string, boolean>
}
```

### `WfStateStrategy`

State persistence interface:

```ts
interface WfStateStrategy {
  persist(state: WfState, options?: { ttl?: number }): Promise<string>
  retrieve(token: string): Promise<WfState | null>
  consume(token: string): Promise<WfState | null>
}
```

### `WfOutlet`

Delivery channel interface:

```ts
interface WfOutlet {
  readonly name: string
  deliver(request: WfOutletRequest, token: string): Promise<WfOutletResult | void>
}
```

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
state.schemaId              // workflow schema ID
state.stepId()              // current step ID (or null)
state.indexes               // position in nested schemas
state.resume                // boolean: is this a resume?
```

::: info
In most cases, use `@WorkflowParam` decorators instead of calling `useWfState()` directly. The composable is useful for advanced scenarios like custom interceptors or utilities that need workflow context.
:::

### `useWfOutlet()`

Returns outlet infrastructure accessors. Available inside step handlers during outlet-driven workflows.

```ts
import { useWfOutlet } from '@moostjs/event-wf'

const { getStateStrategy, getOutlets, getOutlet } = useWfOutlet()
```

Most steps do not need this — use `outletHttp()` / `outletEmail()` / `outlet()` instead.

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
