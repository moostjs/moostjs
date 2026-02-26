# Schemas & Flow Control — @moostjs/event-wf

> Defining step sequences, conditional execution, loops, break/continue, and nested sub-workflows.

## Concepts

A workflow schema is an array attached to a `@Workflow` entry point via `@WorkflowSchema`. It declares which steps run, in what order, and under what conditions. Schemas support linear sequences, conditional steps, loops, break/continue flow control, and nesting.

## Linear Schemas

The simplest schema is a flat list of step IDs:

```ts
@Workflow('deploy')
@WorkflowSchema(['build', 'test', 'publish'])
deploy() {}
```

Steps run one after another in order.

## Conditional Steps

Add a `condition` to run a step only when it evaluates to `true`:

```ts
@WorkflowSchema<TCampaignContext>([
  'prepare-audience',
  { condition: (ctx) => ctx.audienceSize > 0, id: 'request-approval' },
  { condition: (ctx) => ctx.approved, id: 'send-emails' },
  'generate-report',
])
```

If a condition returns `false`, that step is skipped and execution continues.

## String Conditions

Conditions can be strings evaluated against the workflow context using a `with(ctx)` scope. This makes them serializable for database storage:

```ts
@WorkflowSchema<TCampaignContext>([
  'prepare-audience',
  { condition: 'audienceSize > 0', id: 'request-approval' },
  { condition: 'approved', id: 'send-emails' },
])
```

String conditions reference context fields directly: `'amount > 100'`, `'status === "active"'`, etc. They are evaluated using `new Function()` with context properties as globals.

## Loops

Use `while` with a nested `steps` array to repeat steps until the condition becomes `false`:

```ts
@WorkflowSchema<TContext>([
  {
    while: (ctx) => !ctx.sent && ctx.retries < 3,
    steps: ['attempt-send', 'increment-retries'],
  },
  { condition: (ctx) => !ctx.sent, id: 'log-failure' },
])
```

The `while` condition (function or string) is checked before each iteration.

## Break and Continue

Inside a loop's `steps` array:

```ts
@WorkflowSchema<TProcessContext>([
  {
    while: 'running',
    steps: [
      'check-temperature',
      { break: 'temperature > safeLimit' },   // exits the loop
      'process-batch',
      { continue: 'skipCooling' },             // skips to next iteration
      'cool-down',
    ],
  },
  'shutdown',
])
```

- **`break`** — exits the loop immediately when the condition is `true`
- **`continue`** — skips remaining steps in the current iteration and starts the next one

Both accept function or string conditions.

## Nested Sub-Workflows

Group steps with a `steps` array without `while` to apply a shared condition to a block:

```ts
@WorkflowSchema<TCampaignContext>([
  'prepare-audience',
  {
    condition: (ctx) => ctx.audienceSize > 1000,
    steps: ['segment-audience', 'schedule-batches', 'warm-up-ips'],
  },
  'send-emails',
])
```

## Input in Schema

Pass input to a specific step directly from the schema:

```ts
@WorkflowSchema([
  { id: 'notify', input: { channel: 'email' } },
  { id: 'notify', input: { channel: 'sms' } },
])
```

The step receives this via `@WorkflowParam('input')`.

## Schema Type Reference

A schema is an array of items (`TWorkflowSchema<T>`). Each item can be:

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

## TypeScript Types

```ts
type TWorkflowSchema<T> = TWorkflowItem<T>[]

type TWorkflowItem<T> =
  | string                              // simple step ID
  | TWorkflowStepSchemaObj<T, any>      // step with condition/input
  | TSubWorkflowSchemaObj<T>            // nested steps
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

## Common Patterns

### Pattern: Retry Loop with Break

```ts
@WorkflowSchema<TContext>([
  {
    while: (ctx) => ctx.attempts < ctx.maxAttempts,
    steps: [
      'attempt-operation',
      { break: 'succeeded' },
      'wait-before-retry',
    ],
  },
  { condition: (ctx) => ctx.succeeded, id: 'report-success' },
  { condition: (ctx) => !ctx.succeeded, id: 'escalate-failure' },
])
```

### Pattern: Type-Safe Conditions

Pass your context type as a generic to get autocomplete and compile-time checks on conditions:

```ts
@WorkflowSchema<TOnboardingContext>([
  'verify-email',
  { condition: (ctx) => ctx.emailVerified, id: 'collect-profile' },  // ctx is typed
  { condition: (ctx) => ctx.profileComplete, id: 'send-welcome' },
])
```

## Best Practices

- Use function conditions for type safety; use string conditions when schemas are stored in a database.
- Keep schemas flat when possible — deep nesting reduces readability.
- The `@Workflow` entry point method body should be empty — all logic lives in the steps.

## Gotchas

- String conditions are evaluated with `new Function()` and `with(ctx)`. Only context properties are available as globals — no access to imports or closures.
- Condition functions can be async (return `Promise<boolean>`).
