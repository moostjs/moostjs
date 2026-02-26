# Error Handling

When something goes wrong in a workflow step, you have two options: fail the workflow immediately with a regular error, or signal a recoverable failure with `StepRetriableError` that lets the workflow pause and be retried later.

## Regular Errors

Throwing a standard error fails the workflow. The output contains the error, and the workflow is marked as finished:

```ts
@Step('validate-payment')
validatePayment(@WorkflowParam('context') ctx: TPaymentContext) {
  if (!ctx.paymentMethodId) {
    throw new Error('No payment method configured') // [!code focus]
  }
}
```

Output when a regular error is thrown:

```ts
{
  finished: true,   // workflow ended
  error: Error('No payment method configured'),
  stepId: 'validate-payment',
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
  expires?: number,           // optional TTL in ms
)
```

All parameters except `originalError` are optional. You can throw a retriable error that just says "try again" without requesting specific input:

```ts
throw new StepRetriableError(new Error('Gateway timeout'))
```

## Retriable Error Output

When a `StepRetriableError` is thrown, the output signals a paused (not finished) workflow:

```ts
{
  finished: false,    // not done — can be retried // [!code focus]
  interrupt: true,    // execution paused // [!code focus]
  error: Error('Card was declined'),
  errorList: [{ code: 'CARD_DECLINED', message: 'Card was declined' }],
  inputRequired: { type: 'payment-form', hint: 'Try a different card' },
  stepId: 'charge-card',
  retry: [Function],  // retry from the same step // [!code focus]
  resume: [Function], // same as retry for retriable errors
  state: { schemaId: '...', context: {...}, indexes: [...] },
}
```

Key differences from a regular error:
- **`finished: false`** instead of `true`
- **`interrupt: true`** — workflow is paused, not failed
- **`retry`** function available to retry the same step
- **`state`** available for serialization and later resumption

## Retrying

Use the `retry` function to re-execute the failed step with new input:

```ts
const result = await wf.start('payment', paymentContext)

if (result.error && result.retry) {
  // Show error to user, get new payment details
  const newInput = { cardNumber: '4111...', cvv: '123' }
  const retried = await result.retry(newInput) // [!code focus]
}
```

Or resume from stored state:

```ts
const retried = await wf.resume(result.state, newInput)
```

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
A workflow can be retried multiple times. Each `retry()` or `resume()` call re-executes only the failed step and continues from there — it does not re-run previously completed steps.
:::
