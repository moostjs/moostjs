# Error Handling

When something goes wrong in a workflow step, you have two options: fail the workflow immediately with a regular error, or signal a recoverable failure with `StepRetriableError` that lets the workflow pause and be retried later.

## Regular Errors

Throwing a standard error fails the workflow: the error propagates up and the `start()`/`resume()` promise **rejects** — there is no output object to inspect. Wrap the call in `try/catch`:

```ts
@Step('validate-payment')
validatePayment(@WorkflowParam('context') ctx: TPaymentContext) {
  if (!ctx.paymentMethodId) {
    throw new Error('No payment method configured') // [!code focus]
  }
}
```

```ts
try {
  await wf.start('payment', paymentContext)
} catch (error) {
  // regular step errors land here — the workflow cannot be resumed // [!code focus]
}
```

There is no `resume` or `retry` function — the workflow is done. Use regular errors for unrecoverable situations (missing configuration, programming errors, invalid state).

## Retriable Errors

`StepRetriableError` signals a recoverable failure. The workflow pauses instead of failing, and can be retried with corrected input:

```ts
import { Step, StepRetriableError, WorkflowParam } from '@moostjs/event-wf'

@Step('charge-card')
chargeCard(@WorkflowParam('input') input?: TPaymentInput) {
  try {
    processPayment(input)
  } catch (e) {
    throw new StepRetriableError( // [!code focus]
      e as Error, // [!code focus] original error
      [{ code: 'CARD_DECLINED', message: 'Card was declined' }], // [!code focus] error details
      { type: 'payment-form', hint: 'Try a different card' }, // [!code focus] input required
    ) // [!code focus]
  }
}
```

### Constructor

```ts
new StepRetriableError(
  originalError: Error,       // the underlying error
  errorList?: unknown,        // structured error details (any shape)
  inputRequired?: IR,         // what input is needed to retry
  expires?: number,           // optional absolute deadline: Date.now() + ttlMs
)
```

`expires` is an **absolute epoch-ms timestamp**, not a duration — pass `Date.now() + ttlMs`. The [`@StepTTL`](/wf/outlets#step-ttl) decorator stamps it for you from a relative TTL.

All parameters except `originalError` are optional. You can throw a retriable error that just says "try again" without requesting specific input:

```ts
throw new StepRetriableError(new Error('Gateway timeout'))
```

## Retriable Error Output

When a `StepRetriableError` is thrown, the output signals a paused (not finished) workflow:

```ts
{
  finished: false,    // not done — can be retried // [!code focus]
  error: Error('Card was declined'), // [!code focus]
  errorList: [{ code: 'CARD_DECLINED', message: 'Card was declined' }],
  inputRequired: { type: 'payment-form', hint: 'Try a different card' },
  stepId: 'charge-card',
  retry: [Function],  // in-process retry — resumes from the failed step
  state: { schemaId: '...', context: {...}, indexes: [...] },
}
```

Key differences from a regular error:
- **the promise resolves** with `finished: false` instead of rejecting
- **`error`** is captured on the output (a retriable failure is the only case where `error` appears on a `TFlowOutput`)
- **`state`** available for serialization and later resumption

There is no `resume` function on a retriable failure — `resume` exists only on input-required pauses without an error.

## Retrying

Retry by resuming from the failed state — the saved `state` points at the failed step, so `wf.resume()` re-executes it with the new input:

```ts
const result = await wf.start('payment', paymentContext)

if (!result.finished && result.error) {
  // Show error to user, get new payment details
  const newInput = { cardNumber: '4111...', cvv: '123' }
  const retried = await wf.resume(result.state, { input: newInput }) // [!code focus]
}
```

`result.retry(input)` is an in-process shortcut for the same call — it re-enters through the workflow engine with a fresh event context, so Moost step handlers (DI, `@WorkflowParam`, composables) work as usual. For retries across process boundaries (e.g. after persisting the failed state), serialize `result.state` and call `wf.resume()`.

## When to Use Which

| Scenario | Approach |
|----------|----------|
| Invalid configuration, programming bug | `throw new Error(...)` |
| External service temporarily unavailable | `throw new StepRetriableError(...)` |
| User input fails validation | `StepRetriableError` with `errorList` and `inputRequired` |
| Data corruption, unrecoverable state | `throw new Error(...)` |
| Rate limit hit, try again later | `StepRetriableError` with `expires` |
| Payment declined, try different card | `StepRetriableError` with `inputRequired` |

::: info
A workflow can be retried multiple times. Each `resume()` call re-executes only the failed step and continues from there — it does not re-run previously completed steps.
:::
