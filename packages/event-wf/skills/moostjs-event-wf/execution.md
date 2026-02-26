# Execution & Lifecycle — @moostjs/event-wf

> Starting and resuming workflows, reading output, pause/resume patterns, error handling, and spies.

## Concepts

Workflows execute via `wf.start()` and produce a `TFlowOutput` describing the result. A workflow can complete, pause for input, or fail. Paused workflows can be resumed from serialized state. Spies observe execution in real time.

## API Reference

### `wf.start<I>(schemaId, initialContext, input?)`

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
const result = await wf.start('process-order', {
  orderId: '123',
  status: 'new',
})
```

### `wf.resume<I>(state, input?)`

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

### `wf.attachSpy<I>(fn)`

Attaches a spy function to observe workflow execution. Returns a detach function.

```ts
const detach = wf.attachSpy((event, eventOutput, flowOutput, ms) => {
  console.log(event, flowOutput.stepId, ms)
})
detach() // stop observing
```

### `wf.detachSpy<I>(fn)`

Removes a previously attached spy function.

### `wf.getWfApp()`

Returns the underlying `WooksWf` instance for advanced low-level access.

## TFlowOutput

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
  resume?: (input: I) => Promise<TFlowOutput<T, unknown, IR>>
  retry?: (input?: I) => Promise<TFlowOutput<T, unknown, IR>>
  error?: Error           // error if step threw
  errorList?: unknown     // structured error details from StepRetriableError
  expires?: number        // TTL in ms (if set by the step)
}
```

Key interpretation:
- `finished: true` — workflow completed all steps
- `finished: false` + `interrupt: true` — workflow is paused (input needed or retriable error)
- `finished: true` + `error` — workflow failed with an unrecoverable error

## Pause & Resume

### Pausing a Workflow

A step pauses the workflow by returning an object with `inputRequired`:

```ts
@Step('collect-address')
collectAddress(
  @WorkflowParam('input') input?: TAddress,
  @WorkflowParam('context') ctx: TRegistrationContext,
) {
  if (!input) {
    return { inputRequired: true }  // pauses the workflow
  }
  ctx.address = input
}
```

The `inputRequired` value can be anything — a boolean, a form schema, a structured object. Moost passes it through without interpretation.

### Reading Paused Output

```ts
const result = await wf.start('registration', initialContext)

if (!result.finished) {
  console.log(result.interrupt)      // true
  console.log(result.inputRequired)  // whatever the step returned
  console.log(result.stepId)         // 'collect-address'
  console.log(result.state)          // serializable state
}
```

### Resuming with Convenience Function

```ts
if (result.inputRequired && result.resume) {
  const resumed = await result.resume({ street: '123 Main St', city: 'Springfield' })
}
```

### Resuming from Stored State

For workflows that span time, serialize the state and resume later:

```ts
// Store
await db.save('pending', { state: result.state, inputRequired: result.inputRequired })

// Later, resume
const saved = await db.load('pending', workflowId)
const resumed = await wf.resume(saved.state, userInput)
```

### Multi-Step Pause/Resume

A workflow can pause and resume multiple times:

```ts
let result = await wf.start('registration', emptyContext)
result = await wf.resume(result.state, { name: 'Alice' })
result = await wf.resume(result.state, { email: 'alice@example.com' })
result = await wf.resume(result.state, { street: '123 Main' })
console.log(result.finished) // true
```

### Expiration

Steps can set an expiration time (in milliseconds) for paused state:

```ts
@Step('collect-payment')
collectPayment(@WorkflowParam('input') input?: TPayment) {
  if (!input) {
    return { inputRequired: { type: 'payment-form' }, expires: 15 * 60 * 1000 }
  }
}
```

The workflow engine does not enforce expiration — it provides the value for your application to check.

## Error Handling

### Regular Errors

Throwing a standard error fails the workflow immediately:

```ts
@Step('validate')
validate(@WorkflowParam('context') ctx: TCtx) {
  if (!ctx.paymentMethodId) throw new Error('No payment method')
}
// Output: { finished: true, error: Error(...) } — no resume/retry available
```

### StepRetriableError

Signals a recoverable failure. The workflow pauses instead of failing:

```ts
import { StepRetriableError } from '@moostjs/event-wf'

@Step('charge-card')
chargeCard(@WorkflowParam('input') input?: TPaymentInput) {
  try {
    processPayment(input)
  } catch (e) {
    throw new StepRetriableError(
      e as Error,                                              // original error
      [{ code: 'CARD_DECLINED', message: 'Card declined' }],  // errorList
      { type: 'payment-form', hint: 'Try a different card' }, // inputRequired
    )
  }
}
```

**Constructor:**

```ts
new StepRetriableError(
  originalError: Error,       // the underlying error
  errorList?: unknown,        // structured error details (any shape)
  inputRequired?: IR,         // what input is needed to retry
  expires?: number,           // optional TTL in ms
)
```

**Retriable output:**

```ts
{
  finished: false,       // not done — can be retried
  interrupt: true,       // execution paused
  error: Error('...'),
  errorList: [...],
  inputRequired: { ... },
  retry: [Function],     // retry from the same step
  resume: [Function],    // same as retry for retriable errors
  state: { ... },
}
```

**Retrying:**

```ts
const result = await wf.start('payment', paymentContext)
if (result.error && result.retry) {
  const retried = await result.retry(newPaymentInput)
}
// Or from stored state:
const retried = await wf.resume(result.state, newInput)
```

### When to Use Which

| Scenario | Approach |
|----------|----------|
| Invalid configuration, programming bug | `throw new Error(...)` |
| External service temporarily unavailable | `throw new StepRetriableError(...)` |
| User input fails validation | `StepRetriableError` with `errorList` and `inputRequired` |
| Rate limit hit | `StepRetriableError` with `expires` |

## Spies & Observability

### Attaching a Spy

```ts
const detach = wf.attachSpy((event, eventOutput, flowOutput, ms) => {
  console.log(`[${event}] step=${flowOutput.stepId} (${ms}ms)`)
})
```

### Spy Callback Signature

```ts
type TWorkflowSpy<T, I, IR> = (
  event: string,
  eventOutput: string | undefined | { fn: string | Function, result: boolean },
  flowOutput: TFlowOutput<T, I, IR>,
  ms?: number,
) => void
```

### Spy Events

| Event | When | eventOutput |
|-------|------|-------------|
| `'workflow-start'` | Workflow begins | `undefined` |
| `'subflow-start'` | Nested sub-workflow begins | `undefined` |
| `'step'` | A step finishes executing | Step ID (string) |
| `'eval-condition-fn'` | Step condition evaluated | `{ fn, result }` |
| `'eval-while-cond'` | Loop condition evaluated | `{ fn, result }` |
| `'eval-break-fn'` | Break condition evaluated | `{ fn, result }` |
| `'eval-continue-fn'` | Continue condition evaluated | `{ fn, result }` |
| `'workflow-end'` | Workflow completes | `undefined` |
| `'workflow-interrupt'` | Workflow pauses | `undefined` |
| `'subflow-end'` | Sub-workflow completes | `undefined` |

### Detaching

```ts
// Option 1: returned function
const detach = wf.attachSpy(mySpy)
detach()

// Option 2: explicit
wf.detachSpy(mySpy)
```

## Best Practices

- A `retry()` or `resume()` call re-executes only the paused/failed step and continues — it does not re-run previously completed steps.
- Keep spy callbacks lightweight — they run synchronously during execution. Buffer heavy processing.
- The `state` object is plain JSON — safe for serialization, database storage, and API responses.
- Type the `MoostWf` instance generically (`MoostWf<TMyContext>`) to get typed output.

## Gotchas

- `finished: true` with an `error` means unrecoverable failure (regular `throw`). `finished: false` with `error` means retriable (`StepRetriableError`).
- The `expires` field is informational — the engine does not enforce it. Your application must check and reject stale resumes.
- `result.resume` and `result.retry` are convenience functions for in-process use. For cross-process resumption, use `wf.resume(state, input)` instead.
