---
name: moostjs-event-wf
description: Use this skill when working with @moostjs/event-wf — to define workflow steps with @Step(), create workflow entry points with @Workflow() and @WorkflowSchema(), inject workflow data with @WorkflowParam(), set up MoostWf adapter, start and resume workflows with wf.start()/wf.resume(), handle pause/resume with inputRequired, use StepRetriableError for recoverable failures, observe execution with attachSpy(), access workflow state with useWfState(), build conditional and looping schemas, integrate workflows with HTTP/CLI handlers, or use wfKind for event-type-aware logic.
---

# @moostjs/event-wf

Workflow event adapter for Moost, wrapping `@wooksjs/event-wf` and `@prostojs/wf`. Define workflow steps and flows using decorators, with full Moost DI, interceptors, and pipes.

## How to use this skill

Read the domain file that matches the task. Do not load all files — only what you need.

| Domain | File | Load when... |
|--------|------|------------|
| Core concepts & setup | [core.md](core.md) | Starting a new project, installing the package, understanding the mental model, configuring MoostWf |
| Decorators & composables | [decorators.md](decorators.md) | Using @Step, @Workflow, @WorkflowSchema, @WorkflowParam, useWfState(), wfKind |
| Schemas & flow control | [schemas.md](schemas.md) | Defining step sequences, conditions, loops, break/continue, nested sub-workflows |
| Execution & lifecycle | [execution.md](execution.md) | Starting/resuming workflows, reading TFlowOutput, pause/resume, StepRetriableError, spies |
| Integration | [integration.md](integration.md) | Triggering workflows from HTTP/CLI, using interceptors/pipes/DI in steps, multi-adapter setup |

## Quick reference

```ts
import {
  MoostWf, Step, Workflow, WorkflowSchema, WorkflowParam,
  StepRetriableError, useWfState, wfKind,
} from '@moostjs/event-wf'

// Register adapter
const wf = new MoostWf()
app.adapter(wf)

// Start / resume
const result = await wf.start('schema-id', initialContext, input?)
const resumed = await wf.resume(result.state, newInput)

// Observe
const detach = wf.attachSpy((event, output, flow, ms) => { ... })
```
