# Pause & Resume

Workflows can pause mid-execution to wait for external input — user data, approvals, API callbacks — and then resume exactly where they left off. The workflow state is fully serializable, so you can store it in a database and resume hours or days later.

## Pausing a Workflow

A step pauses the workflow by returning an object with `inputRequired`:

```ts
@Step('collect-address')
collectAddress(
  @WorkflowParam('input') input?: TAddress,
  @WorkflowParam('context') ctx: TRegistrationContext,
) {
  if (!input) {
    return { inputRequired: true } // [!code focus] pauses the workflow
  }
  ctx.address = input
}
```

The `inputRequired` value can be anything your application needs — a boolean, a form schema, a list of required fields, or a structured object. Moost passes it through to the output without interpretation.

```ts
// Flexible inputRequired examples:
return { inputRequired: true }
return { inputRequired: { fields: ['name', 'email'] } }
return { inputRequired: { formId: 'address-form', version: 2 } }
```

## Reading the Paused Output

When a step requests input, the output signals that the workflow is paused:

```ts
const result = await wf.start('registration', {
  userId: 'usr-1',
  name: '',
  email: '',
  address: null,
})

if (!result.finished) { // [!code focus]
  console.log(result.interrupt)      // true
  console.log(result.inputRequired)  // true (or whatever you returned)
  console.log(result.stepId)         // 'collect-address'
  console.log(result.state)          // serializable state
}
```

Key output fields when paused:
- **`finished: false`** — workflow did not complete
- **`interrupt: true`** — execution was paused (not failed)
- **`inputRequired`** — the value returned by the step
- **`state`** — full state needed to resume (schema ID, context, step position)
- **`resume`** — convenience function to resume immediately

## Resuming with the Convenience Function

The output includes a `resume` function you can call directly:

```ts
const result = await wf.start('registration', initialContext)

if (result.inputRequired && result.resume) {
  const resumed = await result.resume({ // [!code focus]
    street: '123 Main St',
    city: 'Springfield',
    zip: '62701',
  })
  console.log(resumed.finished) // true (if no more input needed)
}
```

This is handy for in-process resumption where you don't need to serialize the state.

## Resuming from Stored State

For workflows that span time (user goes away, comes back later), serialize the state and resume with `wf.resume()`:

```ts
// Step 1: Start workflow, get paused state
const result = await wf.start('registration', initialContext)

if (result.inputRequired) {
  // Step 2: Store the state (it's plain JSON) // [!code focus]
  await db.save('pending-workflows', {
    id: result.state.schemaId,
    state: result.state, // { schemaId, context, indexes } // [!code focus]
    inputRequired: result.inputRequired,
  })
}

// ... later, when the user provides input ...

// Step 3: Load and resume // [!code focus]
const saved = await db.load('pending-workflows', workflowId)
const resumed = await wf.resume(saved.state, userInput) // [!code focus]
```

The `state` object contains everything needed to resume:
- **`schemaId`** — which workflow to resume
- **`context`** — the workflow context as it was when paused
- **`indexes`** — position in the schema (including nested sub-workflows)

## Multi-Step Pause/Resume

A workflow can pause and resume multiple times. Each resume continues from the paused step and runs until the next pause or completion:

```ts
@WorkflowSchema<TRegistrationContext>([
  'collect-name',     // may pause for input
  'collect-email',    // may pause for input
  'collect-address',  // may pause for input
  'create-account',
  'send-welcome',
])
```

```ts
// First run — pauses at 'collect-name'
let result = await wf.start('registration', emptyContext)

// Resume with name — runs 'collect-name', then pauses at 'collect-email'
result = await wf.resume(result.state, { name: 'Alice' })

// Resume with email — runs 'collect-email', then pauses at 'collect-address'
result = await wf.resume(result.state, { email: 'alice@example.com' })

// Resume with address — runs remaining steps
result = await wf.resume(result.state, { street: '123 Main', city: 'Springfield' })
console.log(result.finished) // true
```

## Expiration

Steps can set an expiration time (in milliseconds) for paused state:

```ts
@Step('collect-payment')
collectPayment(@WorkflowParam('input') input?: TPayment) {
  if (!input) {
    return {
      inputRequired: { type: 'payment-form' },
      expires: 15 * 60 * 1000, // [!code focus] 15 minutes
    }
  }
  // process payment...
}
```

The `expires` value appears in the output. It's up to your application to check it and reject stale resumes:

```ts
if (result.expires && Date.now() > result.expires) {
  throw new Error('Workflow session expired')
}
```

::: info
The workflow engine does not enforce expiration automatically — it provides the value for your application to use. This gives you control over how to handle expired states (reject, extend, restart, etc.).
:::
