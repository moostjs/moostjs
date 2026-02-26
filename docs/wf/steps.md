# Steps

Steps are the building blocks of a workflow. Each step is a controller method decorated with `@Step` that handles one unit of work. Steps read and write to the shared context, can receive input, and can signal that the workflow should pause.

## Defining a Step

Decorate a controller method with `@Step('id')`. The string is the step ID used in workflow schemas:

```ts
import { Step, WorkflowParam } from '@moostjs/event-wf'
import { Controller } from 'moost'

@Controller()
export class ApprovalController {
  @Step('review') // [!code focus]
  review(@WorkflowParam('context') ctx: TApprovalContext) {
    ctx.reviewedAt = new Date().toISOString()
    ctx.status = 'reviewed'
  }
}
```

If you omit the path, the method name is used as the step ID.

## Accessing Workflow Data

Use `@WorkflowParam` to inject workflow data into step methods:

| Parameter | Type | Description |
|-----------|------|-------------|
| `'context'` | `T` | Shared workflow context — read and mutate it freely |
| `'input'` | `I \| undefined` | Input passed to `start()` or `resume()` |
| `'stepId'` | `string \| null` | Current step identifier |
| `'schemaId'` | `string` | Workflow schema identifier |
| `'indexes'` | `number[]` | Position in nested schema (for sub-workflows) |
| `'resume'` | `boolean` | `true` when the workflow is being resumed, `false` on first run |
| `'state'` | `object` | Full workflow state (context, indexes, schemaId) |

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

## Class Property Injection

When using `@Injectable('FOR_EVENT')`, the controller is instantiated fresh for each step execution. This lets you inject context as a class property instead of a method parameter:

```ts
@Injectable('FOR_EVENT') // [!code focus]
@Controller()
export class ApprovalController {
  @WorkflowParam('context') // [!code focus]
  ctx!: TApprovalContext // [!code focus]

  @Step('review')
  review() {
    this.ctx.status = 'reviewed' // access via this.ctx
  }

  @Step('approve')
  approve() {
    this.ctx.status = 'approved' // same property, different step
  }
}
```

::: info
Without `@Injectable('FOR_EVENT')`, the controller is a singleton shared across events. In that case, use method parameters instead of class properties to avoid state leaking between concurrent workflows.
:::

## Parametric Steps

Steps can have parametric paths, just like HTTP routes. Use `@Param` from `moost` to extract values:

```ts
import { Param } from 'moost'

@Step('notify/:channel(email|sms)') // [!code focus]
notify(
  @Param('channel') channel: 'email' | 'sms', // [!code focus]
  @WorkflowParam('context') ctx: TApprovalContext,
) {
  if (channel === 'email') {
    sendEmail(ctx.userId, 'Your document was approved')
  } else {
    sendSms(ctx.userId, 'Your document was approved')
  }
}
```

Reference parametric steps in schemas with concrete values:

```ts
@WorkflowSchema<TApprovalContext>([
  'review',
  'approve',
  { id: 'notify/email' },
])
```

## What Steps Can Return

A step method can:

- **Return nothing** (`void`) — execution continues to the next step
- **Return `{ inputRequired }`** — pauses the workflow until input is provided (see [Pause & Resume](/wf/pause-resume))
- **Throw `StepRetriableError`** — pauses with an error that can be retried (see [Error Handling](/wf/errors))
- **Throw a regular error** — fails the workflow immediately

```ts
@Step('collect-data')
collectData(@WorkflowParam('input') input?: TFormData) {
  if (!input) {
    return { inputRequired: { fields: ['name', 'email'] } } // [!code focus]
  }
  // process input...
}
```

The `inputRequired` value can be anything your application understands — a boolean, a form schema object, or a string. Moost passes it through without interpretation.

## Reusing Steps Across Workflows

Steps are just methods on a controller. Multiple workflows can reference the same step by its ID:

```ts
@Controller()
export class SharedSteps {
  @Step('send-notification')
  sendNotification(@WorkflowParam('context') ctx: { email: string, message: string }) {
    sendEmail(ctx.email, ctx.message)
  }
}

// In another controller:
@WorkflowSchema(['validate', 'process', 'send-notification'])

// In yet another controller:
@WorkflowSchema(['review', 'approve', 'send-notification'])
```

::: info
Steps are resolved by their path (ID) through the Wooks router. As long as the step is registered (its controller is imported), any workflow schema can reference it.
:::
