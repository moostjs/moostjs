# Decorators & Composables — @moostjs/event-wf

> All decorators and composables exported by @moostjs/event-wf for defining and accessing workflow handlers.

## API Reference

### `@Step(path?)`

Marks a controller method as a workflow step handler.

- **`path`** *(string, optional)* — Step identifier used in schemas. Defaults to the method name.

```ts
import { Step, WorkflowParam } from '@moostjs/event-wf'

@Step('validate')
validate(@WorkflowParam('context') ctx: TOrderContext) {
  ctx.validated = true
}
```

Steps can have parametric paths (like HTTP routes):

```ts
import { Param } from 'moost'

@Step('notify/:channel(email|sms)')
notify(@Param('channel') channel: 'email' | 'sms') {
  // Reference in schema: { id: 'notify/email' }
}
```

### `@Workflow(path?)`

Marks a controller method as a workflow entry point. Must be paired with `@WorkflowSchema`.

- **`path`** *(string, optional)* — Workflow identifier. Defaults to the method name.

The effective schema ID combines the controller prefix and the workflow path. For `@Controller('admin')` + `@Workflow('order')`, the schema ID is `admin/order`.

```ts
@Workflow('order-processing')
@WorkflowSchema<TOrderContext>(['validate', 'charge', 'ship'])
processOrder() {}
```

### `@WorkflowSchema<T>(schema)`

Attaches a workflow schema (step sequence) to a `@Workflow` method.

- **`T`** *(generic)* — Workflow context type for type-checked conditions.
- **`schema`** *(`TWorkflowSchema<T>`)* — Array of step definitions.

```ts
@WorkflowSchema<TMyContext>([
  'step-a',
  { condition: (ctx) => ctx.ready, id: 'step-b' },
  { while: 'retries < 3', steps: ['attempt', 'increment'] },
])
```

See [schemas.md](schemas.md) for full schema syntax.

### `WorkflowParam(name)`

Parameter and property decorator that injects workflow runtime values.

| Name | Type | Description |
|------|------|-------------|
| `'context'` | `T` | Shared workflow context object |
| `'input'` | `I \| undefined` | Input passed to `start()` or `resume()` |
| `'stepId'` | `string \| null` | Current step ID (`null` in entry point) |
| `'schemaId'` | `string` | Active workflow schema identifier |
| `'indexes'` | `number[] \| undefined` | Current position in nested schemas |
| `'resume'` | `boolean` | `true` when resuming, `false` on first run |
| `'state'` | `object` | Full state object from `useWfState()` |

**As method parameter:**

```ts
@Step('process')
process(
  @WorkflowParam('context') ctx: TMyContext,
  @WorkflowParam('input') input: TMyInput | undefined,
  @WorkflowParam('resume') isResume: boolean,
) {
  if (isResume) {
    console.log('Resuming with new input:', input)
  }
  ctx.processed = true
}
```

**As class property** (requires `@Injectable('FOR_EVENT')`):

```ts
@Injectable('FOR_EVENT')
@Controller()
export class MyController {
  @WorkflowParam('context')
  ctx!: TMyContext

  @Step('review')
  review() {
    this.ctx.status = 'reviewed'
  }
}
```

### `useWfState()`

Composable that returns the current workflow execution state. Available inside step and entry point handlers.

```ts
import { useWfState } from '@moostjs/event-wf'

const state = useWfState()
state.ctx<TMyContext>()     // workflow context
state.input<TMyInput>()    // step input (or undefined)
state.schemaId             // workflow schema ID
state.stepId()             // current step ID (or null)
state.indexes              // position in nested schemas
state.resume               // boolean: is this a resume?
```

In most cases, prefer `@WorkflowParam` decorators. The composable is useful for advanced scenarios like custom interceptors or utilities that need workflow context.

### `wfKind`

Event kind marker for workflow events. Used internally by the adapter and useful for building custom event-type-aware logic.

```ts
import { wfKind } from '@moostjs/event-wf'
```

## Common Patterns

### Pattern: Class Property Injection

When using `@Injectable('FOR_EVENT')`, inject context as a class property. Multiple steps in the same controller share the property declaration but get separate instances per execution.

```ts
@Injectable('FOR_EVENT')
@Controller()
export class OnboardingController {
  @WorkflowParam('context')
  ctx!: TOnboardingContext

  @Step('verify-email')
  verifyEmail() { this.ctx.emailVerified = true }

  @Step('collect-profile')
  collectProfile() { this.ctx.profileComplete = true }
}
```

### Pattern: Reusing Steps Across Workflows

Steps are resolved by their path through the Wooks router. Any workflow schema can reference any registered step:

```ts
@Controller()
export class SharedSteps {
  @Step('send-notification')
  sendNotification(@WorkflowParam('context') ctx: { email: string, message: string }) {
    sendEmail(ctx.email, ctx.message)
  }
}

// Referenced from multiple schemas:
@WorkflowSchema(['validate', 'process', 'send-notification'])
@WorkflowSchema(['review', 'approve', 'send-notification'])
```

## Gotchas

- `WorkflowParam('resume')` returns a **boolean**, not a function. It indicates whether the current execution is a resume. The resume *function* is on the `TFlowOutput` object returned by `start()` or `resume()`.
- Without `@Injectable('FOR_EVENT')`, the controller is a singleton. Using class property injection in a singleton causes state to leak between concurrent workflows — use method parameters instead.
- If you omit the `path` argument from `@Step()` or `@Workflow()`, the method name is used as the identifier.
