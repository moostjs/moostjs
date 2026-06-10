# Spies & Observability

Spies are observer functions that monitor workflow execution in real time. Attach a spy to receive callbacks as steps execute, conditions evaluate, and workflows start or finish. This is useful for logging, timing, metrics, and audit trails.

## Attaching a Spy

Call `attachSpy` on the `MoostWf` instance. It returns a detach function:

```ts
import { MoostWf } from '@moostjs/event-wf'

const wf = new MoostWf()

const detach = wf.attachSpy((event, eventOutput, flowOutput, ms) => { // [!code focus]
  console.log(`[${event}] step=${flowOutput.stepId} (${ms}ms)`)
})

// ... run workflows ...

detach() // stop observing // [!code focus]
```

## Spy Callback Signature

The spy function receives four arguments:

```ts
type TWorkflowSpy<T, I, IR> = (
  event: string,
  eventOutput: string | undefined | { fn: string | Function, result: boolean },
  flowOutput: TFlowSpyData<T, IR>,
  ms?: number,
) => void
```

| Argument | Description |
|----------|-------------|
| `event` | Event name (e.g., `'step'`, `'workflow-start'`, `'eval-condition-fn'`) |
| `eventOutput` | Event-specific data — step ID for steps, condition result for conditions, schema ID for workflow/resume lifecycle events |
| `flowOutput` | Current workflow snapshot (`state`, `finished`, `stepId`, `inputRequired?`, `interrupt?`, `error?`) — unlike `TFlowOutput`, it has no `resume`/`retry` functions |
| `ms` | Duration of the individual step execution or condition evaluation — present only on `'step'` and `'eval-*'` events |

## Spy Events

| Event | When it fires | `eventOutput` |
|-------|--------------|---------------|
| `'workflow-start'` | Fresh workflow run begins (`start()`) | Schema ID (string) |
| `'workflow-end'` | Fresh run completes normally | Schema ID (string) |
| `'workflow-interrupt'` | Fresh run pauses (input required or retriable error) | Schema ID (string) |
| `'resume-start'` | Resumed run begins (`resume()` / `result.resume()`) | Schema ID (string) |
| `'resume-end'` | Resumed run completes normally | Schema ID (string) |
| `'resume-interrupt'` | Resumed run pauses | Schema ID (string) |
| `'subflow-start'` | Nested sub-workflow begins | `''` (empty string) |
| `'subflow-end'` | Nested sub-workflow completes | `''` (empty string) |
| `'subflow-interrupt'` | Nested sub-workflow pauses | `''` (empty string) |
| `'step'` | A step finishes executing | Step ID (string) |
| `'eval-condition-fn'` | A step condition is evaluated | `{ fn, result: boolean }` |
| `'eval-while-cond'` | A `while` loop condition is evaluated | `{ fn, result: boolean }` |
| `'eval-break-fn'` | A `break` condition is evaluated | `{ fn, result: boolean }` |
| `'eval-continue-fn'` | A `continue` condition is evaluated | `{ fn, result: boolean }` |
| `'error'` | A step throws a non-retriable error (the run then rejects) | Error message (string) |

::: warning Resumed runs use the `resume-*` events
A resumed workflow emits `resume-start` / `resume-end` / `resume-interrupt`, **not** `workflow-*`. Code that filters only on `'workflow-interrupt'` misses every pause that happens during a resume.
:::

## Practical Examples

### Step Timing Logger

```ts
wf.attachSpy((event, eventOutput, flowOutput, ms) => {
  if (event === 'step') {
    console.log(`Step "${flowOutput.stepId}" completed in ${ms}ms`)
  }
})
```

### Audit Trail

```ts
const auditLog: Array<{ event: string, stepId: string, timestamp: number }> = []

wf.attachSpy((event, _output, flowOutput) => {
  auditLog.push({
    event,
    stepId: flowOutput.stepId,
    timestamp: Date.now(),
  })
})

// After workflow completes:
await saveAuditLog(auditLog)
```

### Condition Debugging

```ts
wf.attachSpy((event, eventOutput) => {
  if (typeof eventOutput === 'object' && eventOutput && 'result' in eventOutput) {
    const condStr = typeof eventOutput.fn === 'string'
      ? eventOutput.fn
      : eventOutput.fn.toString()
    console.log(`${event}: ${condStr} => ${eventOutput.result}`)
  }
})
```

## Detaching Spies

You can detach a spy in two ways:

```ts
// Option 1: Use the returned detach function
const detach = wf.attachSpy(mySpy)
detach()

// Option 2: Pass the same function to detachSpy
wf.attachSpy(mySpy)
wf.detachSpy(mySpy)
```

::: info
Spies are called synchronously during workflow execution. Keep spy callbacks lightweight to avoid slowing down your workflows. For heavy processing (database writes, API calls), buffer events and process them asynchronously.
:::
