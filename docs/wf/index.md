# Getting Started

This guide walks you through creating your first Moost workflow — a simple order processing pipeline with three linear steps.

## Installation

Add the workflow adapter to your Moost project:

::: code-group
```bash [npm]
npm install @moostjs/event-wf
```
```bash [pnpm]
pnpm add @moostjs/event-wf
```
:::

### AI Agent Skills (Optional)

Give your AI coding agent (Claude Code, Cursor, etc.) deep knowledge of the workflow API:

```bash
npx moostjs-event-wf-skill        # project-local
npx moostjs-event-wf-skill --global # global
```

## Define a Workflow Controller

Create a controller with a workflow entry point and its steps:

```ts
// src/order.controller.ts
import { Controller, Injectable } from 'moost'
import {
  Step,
  Workflow,
  WorkflowParam,
  WorkflowSchema,
} from '@moostjs/event-wf'

interface TOrderContext {
  orderId: string
  validated: boolean
  charged: boolean
  shipped: boolean
}

@Injectable('FOR_EVENT')
@Controller()
export class OrderController {
  @WorkflowParam('context')
  ctx!: TOrderContext

  @Workflow('process-order') // [!code focus]
  @WorkflowSchema<TOrderContext>([ // [!code focus]
    'validate', // [!code focus]
    'charge', // [!code focus]
    'ship', // [!code focus]
  ]) // [!code focus]
  processOrder() {}

  @Step('validate') // [!code focus]
  validate() {
    console.log(`Validating order ${this.ctx.orderId}`)
    this.ctx.validated = true
  }

  @Step('charge') // [!code focus]
  charge() {
    console.log(`Charging for order ${this.ctx.orderId}`)
    this.ctx.charged = true
  }

  @Step('ship') // [!code focus]
  ship() {
    console.log(`Shipping order ${this.ctx.orderId}`)
    this.ctx.shipped = true
  }
}
```

A few things to notice:

- `@Workflow('process-order')` marks the method as a workflow entry point with the ID `process-order`
- `@WorkflowSchema` defines the step execution order — here it's a simple linear sequence
- `@Step('validate')` registers a method as a workflow step that can be referenced in schemas
- `@WorkflowParam('context')` injects the shared workflow context into a class property
- The entry point method body is empty — all logic lives in the steps

## Register the Adapter

Wire up the workflow adapter in your application entry point:

```ts
// src/main.ts
import { Moost } from 'moost'
import { MoostWf } from '@moostjs/event-wf'
import { OrderController } from './order.controller'

const app = new Moost()

const wf = new MoostWf() // [!code focus]
app.adapter(wf) // [!code focus]

app.registerControllers(OrderController)

await app.init()

// Start the workflow // [!code focus]
const result = await wf.start('process-order', { // [!code focus]
  orderId: 'ORD-001', // [!code focus]
  validated: false, // [!code focus]
  charged: false, // [!code focus]
  shipped: false, // [!code focus]
}) // [!code focus]

console.log(result.finished) // true
console.log(result.state.context)
// { orderId: 'ORD-001', validated: true, charged: true, shipped: true }
```

`wf.start()` takes a schema ID and an initial context object. It returns a `TFlowOutput` with the final state.

## Understanding the Output

Every `start()` or `resume()` call returns a `TFlowOutput` object:

```ts
{
  state: {
    schemaId: 'process-order',
    context: { orderId: 'ORD-001', validated: true, charged: true, shipped: true },
    indexes: [3],
  },
  finished: true,        // workflow completed all steps
  stepId: 'ship',        // last executed step
  interrupt: undefined,  // not paused
  inputRequired: undefined,
}
```

Key fields:
- **`finished`** — `true` if the workflow ran to completion
- **`state`** — serializable snapshot (schema ID, context, step position)
- **`interrupt`** — `true` if the workflow paused (waiting for input or after a retriable error)
- **`inputRequired`** — present when a step needs input before it can proceed

## What's Next?

You've built a linear workflow. From here, explore:

- [**Steps**](/wf/steps) — accessing context, input, and parametric paths
- [**Schemas & Flow Control**](/wf/schemas) — conditions, loops, and branching
- [**Pause & Resume**](/wf/pause-resume) — pausing for user input and resuming later
