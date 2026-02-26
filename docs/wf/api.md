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

### `getWfApp()`

Returns the underlying `WooksWf` instance for advanced low-level access.

```ts
getWfApp(): WooksWf<T, IR>
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

### `wfKind`

Event kind marker for workflow events. Used internally by the adapter and useful for building custom event-type-aware logic.

```ts
import { wfKind } from '@moostjs/event-wf'
```
