# Schemas & Flow Control

A workflow schema defines the execution order of steps. It's an array attached to a workflow entry point via `@WorkflowSchema`, describing which steps run, in what order, and under what conditions.

## Linear Schemas

The simplest schema is a flat list of step IDs. Steps run one after another:

```ts
@Workflow('deploy')
@WorkflowSchema(['build', 'test', 'publish'])
deploy() {}
```

## Conditional Steps

Add a `condition` to run a step only when the condition evaluates to `true`. Conditions receive the workflow context:

```ts
interface TCampaignContext {
  audienceSize: number
  approved: boolean
  sent: boolean
}

@Workflow('email-campaign')
@WorkflowSchema<TCampaignContext>([
  'prepare-audience',
  { condition: (ctx) => ctx.audienceSize > 0, id: 'request-approval' }, // [!code focus]
  { condition: (ctx) => ctx.approved, id: 'send-emails' }, // [!code focus]
  'generate-report',
])
emailCampaign() {}
```

If a condition returns `false`, that step is skipped and execution continues with the next item in the schema.

## String Conditions

Conditions can also be strings. String conditions are evaluated against the workflow context using a `with(ctx)` scope, making them easy to serialize and store in a database:

```ts
@WorkflowSchema<TCampaignContext>([
  'prepare-audience',
  { condition: 'audienceSize > 0', id: 'request-approval' }, // [!code focus]
  { condition: 'approved', id: 'send-emails' }, // [!code focus]
  'generate-report',
])
```

::: info
String conditions are evaluated using `new Function()` with the context properties available as globals. This means you can reference any context field directly: `'amount > 100'`, `'status === "active"'`, etc.
:::

## Loops

Use `while` with a nested `steps` array to repeat a group of steps until the condition becomes `false`:

```ts
@WorkflowSchema<TCampaignContext>([
  {
    while: (ctx) => !ctx.sent && ctx.retries < 3, // [!code focus]
    steps: [ // [!code focus]
      'attempt-send', // [!code focus]
      'increment-retries', // [!code focus]
    ], // [!code focus]
  },
  { condition: (ctx) => !ctx.sent, id: 'log-failure' },
])
```

The `while` condition (function or string) is checked before each iteration. When it returns `false`, execution moves past the loop.

## Break and Continue

Inside a loop's `steps` array, you can use `break` and `continue` for flow control:

```ts
@WorkflowSchema<TProcessContext>([
  {
    while: 'running',
    steps: [
      'check-temperature',
      { break: 'temperature > safeLimit' }, // [!code focus] exits the loop
      'process-batch',
      { continue: 'skipCooling' }, // [!code focus] skips to next iteration
      'cool-down',
    ],
  },
  'shutdown',
])
```

- **`break`** — exits the loop immediately when the condition is `true`
- **`continue`** — skips the remaining steps in the current iteration and starts the next one

Both accept function or string conditions, just like `condition` and `while`.

## Nested Sub-Workflows

You can nest a `steps` array without a `while` condition to group steps logically. This is useful for applying a shared condition to a block:

```ts
@WorkflowSchema<TCampaignContext>([
  'prepare-audience',
  {
    condition: (ctx) => ctx.audienceSize > 1000, // [!code focus]
    steps: [ // [!code focus] only run this block for large audiences
      'segment-audience',
      'schedule-batches',
      'warm-up-ips',
    ],
  },
  'send-emails',
])
```

## Input in Schema

You can pass input to a specific step directly from the schema:

```ts
@WorkflowSchema([
  { id: 'notify', input: { channel: 'email' } }, // [!code focus]
  { id: 'notify', input: { channel: 'sms' } },
])
```

The step receives this input via `@WorkflowParam('input')`.

## Complete Example

Here's a schema combining multiple features — an email campaign with retry logic:

```ts
interface TCampaignContext {
  audienceSize: number
  approved: boolean
  sent: boolean
  attempts: number
  maxAttempts: number
}

@Controller()
export class CampaignController {
  @WorkflowParam('context')
  ctx!: TCampaignContext

  @Workflow('email-campaign')
  @WorkflowSchema<TCampaignContext>([
    'prepare-audience',
    { condition: (ctx) => ctx.audienceSize === 0, id: 'no-audience' },
    'request-approval',
    { condition: (ctx) => !ctx.approved, id: 'cancelled' },
    {
      while: (ctx) => !ctx.sent && ctx.attempts < ctx.maxAttempts,
      steps: [
        'attempt-send',
        { break: 'sent' },
        'wait-before-retry',
      ],
    },
    { condition: (ctx) => ctx.sent, id: 'send-report' },
    { condition: (ctx) => !ctx.sent, id: 'escalate-failure' },
  ])
  emailCampaign() {}

  @Step('prepare-audience')
  prepareAudience() { /* ... */ }

  @Step('no-audience')
  noAudience() { this.ctx.sent = false }

  @Step('request-approval')
  requestApproval() {
    return { inputRequired: { question: 'Approve this campaign?' } }
  }

  @Step('cancelled')
  cancelled() { /* log cancellation */ }

  @Step('attempt-send')
  attemptSend() {
    this.ctx.attempts++
    // try sending...
    this.ctx.sent = true
  }

  @Step('wait-before-retry')
  waitBeforeRetry() { /* delay logic */ }

  @Step('send-report')
  sendReport() { /* generate report */ }

  @Step('escalate-failure')
  escalateFailure() { /* alert ops team */ }
}
```

## Schema Type Reference

A schema is an array of items. Each item can be:

| Form | Description |
|------|-------------|
| `'stepId'` | Run the step unconditionally |
| `{ id: 'stepId' }` | Run the step (same as string form) |
| `{ id: 'stepId', condition: fn \| string }` | Run only if condition passes |
| `{ id: 'stepId', input: value }` | Run with specific input |
| `{ steps: [...] }` | Nested group of steps |
| `{ steps: [...], condition: fn \| string }` | Conditional group |
| `{ steps: [...], while: fn \| string }` | Loop until condition is false |
| `{ break: fn \| string }` | Exit enclosing loop if condition passes |
| `{ continue: fn \| string }` | Skip to next loop iteration if condition passes |
