# Workflow Adapter — @moostjs/event-wf

Moost adapter for multi-step workflow processes, wrapping @wooksjs/event-wf and @prostojs/wf.

## Table of Contents

1. [Setup & Concepts](#setup--concepts)
2. [Decorators & Composables](#decorators--composables)
3. [Schemas & Flow Control](#schemas--flow-control)
4. [Execution & Lifecycle](#execution--lifecycle)
5. [Outlets](#outlets)
6. [Integration](#integration)
7. [Best Practices](#best-practices)
8. [Gotchas](#gotchas)

## Setup & Concepts

### Key Abstractions

- **Steps** -- Controller methods decorated with `@Step` that read/write shared context.
- **Schemas** -- Declarative arrays defining execution order, conditions, and loops.
- **Context** -- A typed object holding shared state across all steps in a workflow.
- **MoostWf** -- The adapter class bridging `@wooksjs/event-wf` into Moost's decorator/DI system.
- **TFlowOutput** -- The result object from `start()`/`resume()` containing state, completion status, and resume functions.

Use workflows when a process has multiple stages, needs branching, can be interrupted for external input, requires auditability, or spans time.

### Installation

```bash
pnpm add @moostjs/event-wf
```

Peer dependencies: `moost`, `@wooksjs/event-core`, `@prostojs/infact`, `@prostojs/mate`, `wooks`.

### Getting Started

```ts
import { Controller, Injectable, Moost } from 'moost'
import { MoostWf, Step, Workflow, WorkflowParam, WorkflowSchema } from '@moostjs/event-wf'

interface TOrderCtx { orderId: string, validated: boolean, charged: boolean }

@Injectable('FOR_EVENT')
@Controller()
class OrderController {
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
app.registerControllers(OrderController)
await app.init()
const result = await wf.start('process-order', { orderId: 'ORD-001', validated: false, charged: false })
// result.finished === true
```

### MoostWf Constructor

```ts
new MoostWf<T, IR>(opts?: WooksWf<T, IR> | TWooksWfOptions, debug?: boolean)
```

Pass an existing `WooksWf` instance, a config object, or nothing for defaults. Set `debug` to enable error logging.

| TWooksWfOptions Field | Type | Description |
|---|---|---|
| `onError` | `(e: Error) => void` | Global error handler |
| `onNotFound` | `TWooksHandler` | Handler for unregistered steps |
| `onUnknownFlow` | `(schemaId, raiseError) => unknown` | Handler for unknown workflow schemas |
| `logger` | `TConsoleBase` | Custom logger instance |
| `eventOptions` | `EventContextOptions` | Event context configuration |
| `router` | `TWooksOptions['router']` | Router configuration |

### Lifecycle

1. `app.adapter(wf)` -- register the adapter
2. `app.registerControllers(...)` -- register controllers
3. `app.init()` -- process decorators, bind `@Step`/`@Workflow` handlers
4. `wf.start(schemaId, context)` -- start workflow execution
5. Steps execute in sequence, reading/mutating shared context
6. Workflow completes or pauses (if a step needs input)

## Decorators & Composables

### `@Step(path?)`

Mark a method as a workflow step handler. `path` defaults to the method name. Supports parametric paths resolved via the Wooks router:

```ts
@Step('validate')
validate(@WorkflowParam('context') ctx: TCtx) { ctx.validated = true }

@Step('notify/:channel(email|sms)')
notify(@Param('channel') channel: 'email' | 'sms') { /* schema: { id: 'notify/email' } */ }
```

### `@Workflow(path?)` + `@WorkflowSchema<T>(schema)`

Mark a method as workflow entry point and attach a step sequence. The effective schema ID combines controller prefix + workflow path (`@Controller('admin')` + `@Workflow('order')` = `admin/order`):

```ts
@Workflow('order-processing')
@WorkflowSchema<TOrderCtx>(['validate', 'charge', 'ship'])
processOrder() {}
```

### `WorkflowParam(name)`

Parameter and property decorator injecting workflow runtime values:

| Name | Type | Description |
|---|---|---|
| `'context'` | `T` | Shared workflow context object |
| `'input'` | `I \| undefined` | Input passed to `start()` or `resume()` |
| `'stepId'` | `string \| null` | Current step ID (`null` in entry point) |
| `'schemaId'` | `string` | Active workflow schema identifier |
| `'indexes'` | `number[] \| undefined` | Current position in nested schemas |
| `'resume'` | `boolean` | `true` when resuming, `false` on first run |
| `'state'` | `object` | Full state object from `useWfState()` |

As method parameter or class property (class properties require `@Injectable('FOR_EVENT')`):

```ts
@Step('process')
process(@WorkflowParam('context') ctx: TCtx, @WorkflowParam('input') input?: TInput) { ... }

// Or as class property:
@Injectable('FOR_EVENT')
@Controller()
export class MyCtrl {
  @WorkflowParam('context') ctx!: TCtx
  @Step('review') review() { this.ctx.status = 'reviewed' }
}
```

### `@StepTTL(ttlMs)`

Set TTL (ms) for paused workflow state when this step returns `inputRequired`. The adapter sets `expires` on the output:

```ts
@Step('send-invite')
@StepTTL(60 * 60 * 1000)
sendInvite() { return outletEmail(this.ctx.email, 'invite') }
```

### `useWfState()`

Composable returning current workflow execution state. Prefer `@WorkflowParam` in most cases:

```ts
const state = useWfState()
state.ctx<T>()    // workflow context
state.input<I>()  // step input (or undefined)
state.schemaId    // workflow schema ID
state.stepId()    // current step ID (or null)
state.indexes     // position in nested schemas
state.resume      // boolean: is this a resume?
```

### `wfKind`

Event kind marker for workflow events. Use for event-type-aware logic.

### Pattern: Reusing Steps Across Workflows

Steps are resolved by path through the Wooks router. Any workflow schema can reference any registered step from any controller.

## Schemas & Flow Control

### Linear Schemas

A flat list of step IDs runs in order:

```ts
@WorkflowSchema(['build', 'test', 'publish'])
```

### Conditional Steps

Use function conditions for type safety or string conditions for serializability:

```ts
@WorkflowSchema<TCtx>([
  'prepare',
  { condition: (ctx) => ctx.audienceSize > 0, id: 'request-approval' },
  { condition: 'approved', id: 'send-emails' },
])
```

String conditions are evaluated with `new Function()` using `with(ctx)` scope. Context properties are accessed directly: `'amount > 100'`, `'status === "active"'`.

### Loops

Use `while` with a nested `steps` array. `break` exits the loop, `continue` skips to next iteration. Both accept function or string conditions:

```ts
@WorkflowSchema<TCtx>([
  {
    while: 'running',
    steps: [
      'check-temperature',
      { break: 'temperature > safeLimit' },
      'process-batch',
      { continue: 'skipCooling' },
      'cool-down',
    ],
  },
  'shutdown',
])
```

### Nested Sub-Workflows

Group steps with `steps` array without `while` to apply a shared condition:

```ts
@WorkflowSchema<TCtx>([
  'prepare',
  { condition: (ctx) => ctx.size > 1000, steps: ['segment', 'schedule', 'warm-up'] },
  'send',
])
```

### Input in Schema

Pass input to a step directly. The step receives it via `@WorkflowParam('input')`:

```ts
@WorkflowSchema([
  { id: 'notify', input: { channel: 'email' } },
  { id: 'notify', input: { channel: 'sms' } },
])
```

### Schema Type Reference

| Form | Description |
|---|---|
| `'stepId'` | Run unconditionally |
| `{ id, condition?, input? }` | Step with optional condition/input |
| `{ steps, condition?, while? }` | Nested group or loop |
| `{ break: fn \| string }` | Exit enclosing loop |
| `{ continue: fn \| string }` | Skip to next iteration |

### TypeScript Types

```ts
type TWorkflowSchema<T> = TWorkflowItem<T>[]
type TWorkflowItem<T> = string | TWorkflowStepSchemaObj<T, any>
  | TSubWorkflowSchemaObj<T> | TWorkflowControl<T>

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

## Execution & Lifecycle

### `wf.start<I>(schemaId, initialContext, input?)`

Start a new workflow. `schemaId` matches `@Workflow` path (including controller prefix). Returns `Promise<TFlowOutput<T, I, IR>>`.

### `wf.resume<I>(state, input?)`

Resume a paused workflow. `state` is the state object from `TFlowOutput.state`.

### `wf.attachSpy<I>(fn)` / `wf.detachSpy<I>(fn)`

Observe step executions. `attachSpy` returns a detach function. The callback receives internal spy data (not the same as `TFlowOutput`):

```ts
const detach = wf.attachSpy((event, eventOutput, spyData, ms) => {
  // spyData has: stepId, state, finished, interrupt, etc. (internal TFlowSpyData type)
  console.log(`[${event}] step=${spyData.stepId} (${ms}ms)`)
})
```

### TFlowOutput (discriminated union)

```ts
type TFlowOutput<T, I, IR> = TFlowFinished<T, IR> | TFlowPaused<T, I, IR> | TFlowFailed<T, I, IR>

interface TFlowState<T> {
  schemaId: string, context: T, indexes: number[], meta?: Record<string, unknown>
}

// Completed successfully
interface TFlowFinished<T, _IR> {
  finished: true
  state: TFlowState<T>
  stepId: string
  // resume, retry, error, inputRequired, expires are `never`
}

// Paused — needs input to continue
interface TFlowPaused<T, I, IR> {
  finished: false
  state: TFlowState<T>
  stepId: string
  inputRequired: IR                                    // what the step needs
  resume: (input: I) => Promise<TFlowOutput<T, unknown, IR>>
  expires?: number                                     // TTL timestamp (informational)
  errorList?: unknown
}

// Failed — retriable via StepRetriableError
interface TFlowFailed<T, I, IR> {
  finished: false
  state: TFlowState<T>
  stepId: string
  error: Error
  retry: (input?: I) => Promise<TFlowOutput<T, unknown, IR>>
  inputRequired?: IR
  expires?: number
  errorList?: unknown
}
```

- `finished: true` -- completed. `finished: false` + `inputRequired` -- paused (resume). `finished: false` + `error` -- retriable (retry). Regular (non-retriable) errors reject the promise.

### Pause & Resume

Return `{ inputRequired: ... }` from a step to pause. The value can be anything (boolean, form schema, etc.):

```ts
@Step('collect-address')
collectAddress(@WorkflowParam('input') input?: TAddress, @WorkflowParam('context') ctx: TCtx) {
  if (!input) return { inputRequired: { fields: ['street', 'city'] } }
  ctx.address = input
}
```

Resume with the convenience function or from stored state:

```ts
// Convenience
if (result.resume) await result.resume({ street: '123 Main St' })

// From stored state
const resumed = await wf.resume(savedState, userInput)

// Multi-step
let r = await wf.start('registration', {})
r = await wf.resume(r.state, { name: 'Alice' })
r = await wf.resume(r.state, { email: 'a@b.com' })
```

**Expiration:** Use `@StepTTL(ms)` or return `{ inputRequired: ..., expires: Date.now() + ttl }`. The engine provides the value; your application enforces it.

### Error Handling

**Regular errors** fail the workflow immediately (no retry). **StepRetriableError** pauses instead:

```ts
import { StepRetriableError } from '@moostjs/event-wf'

@Step('charge-card')
chargeCard(@WorkflowParam('input') input?: TPayment) {
  try { processPayment(input) }
  catch (e) {
    throw new StepRetriableError(e as Error, [{ code: 'DECLINED' }], { type: 'payment-form' })
  }
}
// Constructor: new StepRetriableError(originalError, errorList?, inputRequired?, expires?)
// Retry: result.retry(newInput) or wf.resume(result.state, newInput)
```

| Scenario | Approach |
|---|---|
| Programming bug, invalid config | `throw new Error(...)` |
| External service unavailable | `throw new StepRetriableError(...)` |
| User input fails validation | `StepRetriableError` with `errorList` + `inputRequired` |
| Rate limit hit | `StepRetriableError` with `expires` |

### Spy Events

| Event | When | eventOutput |
|---|---|---|
| `'workflow-start'` / `'workflow-end'` | Begin / complete | `undefined` |
| `'workflow-interrupt'` | Pause | `undefined` |
| `'subflow-start'` / `'subflow-end'` | Nested sub-workflow | `undefined` |
| `'step'` | Step finishes | Step ID (string) |
| `'eval-condition-fn'` | Condition evaluated | `{ fn, result }` |
| `'eval-while-cond'` | Loop condition | `{ fn, result }` |
| `'eval-break-fn'` / `'eval-continue-fn'` | Break/continue condition | `{ fn, result }` |

## Outlets

Outlets are delivery channels for pause/resume interactions. When a step pauses, an outlet handles delivery (HTTP response, email) and later accepts the resume trigger.

### Outlet Signal Helpers

Return from step handlers to pause and trigger a specific outlet:

```ts
outlet(name, data?)                      // generic outlet signal
outletHttp(payload, context?)            // pause, return payload as HTTP response
outletEmail(target, template, context?)  // pause, trigger email delivery
```

```ts
@Step('collect-info')
collectInfo(@WorkflowParam('input') input?: TForm) {
  if (!input) return outletHttp({ fields: ['email', 'name'] })
}

@Step('send-verification')
@StepTTL(24 * 60 * 60 * 1000)
sendVerification() { return outletEmail(this.ctx.email, 'verify-email', { name: this.ctx.name }) }
```

### State Strategies

**`EncapsulatedStateStrategy`** -- Encrypt state into a self-contained token (stateless):

```ts
const strategy = new EncapsulatedStateStrategy({ secret: process.env.SECRET!, defaultTtl: 3600_000 })
```

**`HandleStateStrategy`** -- Store state server-side, return a handle reference:

```ts
const strategy = new HandleStateStrategy({
  store: new WfStateStoreMemory(),  // or custom WfStateStore
  defaultTtl: 3600_000,
  generateHandle: () => crypto.randomUUID(),
})
```

**`WfStateStoreMemory`** -- In-memory `WfStateStore` for dev/testing. Interface: `set()`, `get()`, `delete()`, `getAndDelete()`, `cleanup?()`.

All strategies implement `WfStateStrategy`: `persist(state, { ttl? })`, `retrieve(token)`, `consume(token)`.

### Trigger Handlers

**`wf.handleOutlet(config)`** -- Handle an outlet trigger within an HTTP handler. Reads `wfid`/`wfs` from request, starts or resumes workflow, dispatches pauses to outlets:

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

**`createOutletHandler(wfApp)`** -- Pre-wired handler from MoostWf/WooksWf instance.

**`createHttpOutlet(opts?)`** -- Outlet passing payload as HTTP response. Optional `transform` callback.

**`createEmailOutlet(send)`** -- Outlet delegating to a send function receiving `{ target, template, context, token }`.

### Outlet Composables

**`useWfOutlet()`** -- Access outlet infrastructure: `getStateStrategy()`, `getOutlets()`, `getOutlet(name)`.

**`useWfFinished()`** -- Set or read completion response:

```ts
useWfFinished().set({ type: 'redirect', value: '/dashboard' })
useWfFinished().set({ type: 'data', value: { success: true }, status: 200 })

// Read a previously set response
const response = useWfFinished().get()  // WfFinishedResponse | undefined
```

### Outlet Types

```ts
interface WfOutletTriggerConfig {
  allow?: string[]            // whitelist of workflow IDs
  block?: string[]            // blacklist (checked after allow)
  state: WfStateStrategy | ((wfid: string) => WfStateStrategy)
  outlets: WfOutlet[]
  token?: WfOutletTokenConfig
  wfidName?: string           // default: 'wfid'
  initialContext?: (body: Record<string, unknown> | undefined, wfid: string) => unknown
  onFinished?: (ctx: { context: unknown, schemaId: string }) => unknown
}
interface WfOutletTokenConfig {
  read?: Array<'body' | 'query' | 'cookie'>  // default: ['body', 'query', 'cookie']
  write?: 'body' | 'cookie'                  // default: 'body'
  name?: string                              // default: 'wfs'
  consume?: boolean | Record<string, boolean> // default: { email: true }
}
interface WfOutlet {
  readonly name: string
  deliver(request: WfOutletRequest, token: string): Promise<WfOutletResult | void>
}
interface WfOutletRequest<P = unknown> {
  outlet: string, payload?: P, target?: string, template?: string
  context?: Record<string, unknown>
}
interface WfOutletResult {
  response?: unknown, status?: number
  headers?: Record<string, string>
  cookies?: Record<string, { value: string, options?: Record<string, unknown> }>
}
interface WfStateStrategy {
  persist(state: WfState, options?: { ttl?: number }): Promise<string>
  retrieve(token: string): Promise<WfState | null>
  consume(token: string): Promise<WfState | null>
}
interface WfStateStore {
  set(handle: string, state: WfState, expiresAt?: number): Promise<void>
  get(handle: string): Promise<{ state: WfState, expiresAt?: number } | null>
  delete(handle: string): Promise<void>
  getAndDelete(handle: string): Promise<{ state: WfState, expiresAt?: number } | null>
  cleanup?(): Promise<number>
}
interface WfFinishedResponse {
  type: 'redirect' | 'data', value: unknown, status?: number
  cookies?: Record<string, { value: string, options?: Record<string, unknown> }>
}
```

### Pattern: Full Outlet Workflow

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
      state: new EncapsulatedStateStrategy({ secret: process.env.SECRET! }),
      outlets: [createHttpOutlet(), createEmailOutlet(sendMail)],
    })
  }
}
```

## Integration

### Triggering Workflows from HTTP

Inject `MoostWf` via constructor DI:

```ts
@Controller('tickets')
export class TicketController {
  constructor(private wf: MoostWf<TTicketCtx>) {}

  @Post()
  async create(@Body() body: { description: string }) {
    const result = await this.wf.start('support-ticket', {
      ticketId: generateId(), description: body.description, status: 'new',
    })
    return { finished: result.finished, state: result.finished ? undefined : result.state }
  }

  @Post(':id/resume')
  async resume(@Body() body: { state: any, input: any }) {
    return this.wf.resume(body.state, body.input)
  }
}
```

### Triggering Workflows from CLI

```ts
@Cli('deploy :env')
async deploy(@Param('env') env: string) {
  const result = await this.wf.start('deploy', { environment: env })
  return result.finished ? `Deployed to ${env}` : `Paused: ${JSON.stringify(result.inputRequired)}`
}
```

### Multi-Adapter Setup

```ts
const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
app.adapter(new MoostWf())
app.registerControllers(HttpCtrl, WfCtrl).init()
```

### Interceptors, Pipes, and DI

All standard Moost features work on workflow steps:

```ts
@Step('assign')
@Intercept(LogStepExecution)  // all priority levels work, including global interceptors
assign(@WorkflowParam('context') ctx: TCtx) { ctx.assignee = findAgent() }

@Step('process')
process(@WorkflowParam('input') @Pipe(validateInput) input: TInput) { ... }
```

DI works normally -- inject services via constructor. Use `@Injectable('FOR_EVENT')` for per-execution instances.

## Best Practices

- Use `@Injectable('FOR_EVENT')` on workflow controllers for fresh instances per step. Without it, class properties leak between concurrent workflows.
- Keep `@Workflow` entry point method body empty -- all logic belongs in steps.
- Pass a TypeScript interface as generic to `@WorkflowSchema<T>()` for type-safe conditions.
- Use function conditions for type safety; string conditions for database-stored schemas.
- Inject `MoostWf` via constructor DI from HTTP/CLI controllers.
- Keep spy callbacks lightweight -- they run synchronously.
- The `state` object is plain JSON -- safe for serialization and storage.

## Gotchas

- `WorkflowParam('resume')` returns a boolean, not a function. The resume *function* is on `TFlowOutput`.
- Regular errors reject the promise (not captured in output). Only `StepRetriableError` produces `finished: false` + `error` + `retry()`.
- `expires` is informational -- the engine does not enforce it. Check and reject stale resumes yourself.
- `result.resume`/`result.retry` are for in-process use. For cross-process, use `wf.resume(state, input)`.
- String conditions use `new Function()` + `with(ctx)`. Only context properties are available.
- Call `app.init()` before starting workflows -- steps must be registered first.
- Step IDs are router paths. `'process/items'` = two segments. Use `'process-items'` for flat IDs.
- The adapter name is `'workflow'` (`wf.name === 'workflow'`).
