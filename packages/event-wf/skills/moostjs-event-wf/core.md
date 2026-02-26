# Core Concepts & Setup — @moostjs/event-wf

> Installation, mental model, adapter configuration, and getting started with Moost workflows.

## Concepts

Moost Workflows model multi-step processes as composable, typed sequences of operations. The key abstractions:

- **Steps** — Individual units of work. Controller methods decorated with `@Step` that read/write shared context.
- **Schemas** — Declarative arrays defining execution order, conditions, and loops.
- **Context** — A typed object that holds shared state across all steps in a workflow.
- **MoostWf** — The adapter class that bridges `@wooksjs/event-wf` into Moost's decorator/DI system.
- **TFlowOutput** — The result object from `start()`/`resume()` containing state, completion status, and resume functions.

Workflows are a good fit when your process has multiple stages, needs branching, can be interrupted for external input, requires auditability, or spans time.

## Installation

```bash
npm install @moostjs/event-wf
# or
pnpm add @moostjs/event-wf
```

Peer dependencies: `moost`, `@wooksjs/event-core`, `@prostojs/infact`, `@prostojs/mate`, `wooks`.

## Getting Started

### 1. Define a workflow controller

```ts
import { Controller, Injectable } from 'moost'
import { Step, Workflow, WorkflowParam, WorkflowSchema } from '@moostjs/event-wf'

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

  @Workflow('process-order')
  @WorkflowSchema<TOrderContext>(['validate', 'charge', 'ship'])
  processOrder() {}

  @Step('validate')
  validate() {
    this.ctx.validated = true
  }

  @Step('charge')
  charge() {
    this.ctx.charged = true
  }

  @Step('ship')
  ship() {
    this.ctx.shipped = true
  }
}
```

### 2. Register the adapter and start

```ts
import { Moost } from 'moost'
import { MoostWf } from '@moostjs/event-wf'
import { OrderController } from './order.controller'

const app = new Moost()
const wf = new MoostWf()

app.adapter(wf)
app.registerControllers(OrderController)
await app.init()

const result = await wf.start('process-order', {
  orderId: 'ORD-001',
  validated: false,
  charged: false,
  shipped: false,
})

console.log(result.finished) // true
console.log(result.state.context)
// { orderId: 'ORD-001', validated: true, charged: true, shipped: true }
```

## MoostWf Constructor

```ts
new MoostWf<T, IR>(opts?: WooksWf<T, IR> | TWooksWfOptions, debug?: boolean)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `opts` | `WooksWf \| TWooksWfOptions \| undefined` | Pre-existing WooksWf instance, config options, or undefined for defaults |
| `debug` | `boolean` | Enable error logging |

**TWooksWfOptions fields:**

| Field | Type | Description |
|-------|------|-------------|
| `onError` | `(e: Error) => void` | Global error handler |
| `onNotFound` | `TWooksHandler` | Handler for unregistered steps |
| `onUnknownFlow` | `(schemaId: string, raiseError: () => void) => unknown` | Handler for unknown workflow schemas |
| `logger` | `TConsoleBase` | Custom logger instance |
| `eventOptions` | `EventContextOptions` | Event context configuration |
| `router` | `TWooksOptions['router']` | Router configuration |

You can also pass an existing `WooksWf` instance to share the workflow engine with non-Moost code:

```ts
const wooksWf = createWfApp()
const wf = new MoostWf(wooksWf)
```

## Lifecycle Overview

1. `app.adapter(wf)` registers the adapter
2. `app.registerControllers(...)` registers controllers
3. `app.init()` processes decorators and binds `@Step`/`@Workflow` handlers
4. `wf.start(schemaId, context)` starts workflow execution
5. Steps execute in sequence, reading/mutating shared context
6. Workflow completes or pauses (if a step needs input)

## Best Practices

- Use `@Injectable('FOR_EVENT')` on workflow controllers to get fresh instances per step execution. Without it, the controller is a singleton — class properties would be shared across concurrent workflows.
- Keep the `@Workflow` entry point method body empty — all logic belongs in steps.
- Define a TypeScript interface for your context type and pass it as a generic to `@WorkflowSchema<T>()` for type-safe conditions.
- The workflow `state` object is plain JSON — you can serialize and store it for later resumption.
