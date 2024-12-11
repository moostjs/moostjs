# Moost Workflow API Reference

This page details the core decorators and classes for working with workflows in Moost.

[[toc]]

## Decorators

### `@Workflow(path?: string)`

**Usage:** Marks a controller method as a workflow entry point.

- **Parameters:**  
  `path`: Optional. The workflow path (string), can be static or parametric.
  
**Example:**
```ts
@Workflow('my-workflow')
entryPoint() {}
```

### `@WorkflowSchema<T>(schema: TWorkflowSchema<T>)`

**Usage:** Assigns the workflow schema (array of steps, conditions, loops, breaks) to the entry point.

- **Generic:** `T` is the workflow context type.
- **Parameters:**  
  `schema`: A `TWorkflowSchema<T>` array defining steps and control flow.

**Example:**
```ts
@WorkflowSchema<TMyContext>([
  "step1",
  { condition: (ctx) => ctx.flag, id: "conditionalStep" },
  { while: 'items.length > 0', steps: ["processItem"] }
])
```

### `@Step(path?: string)`

**Usage:** Marks a controller method as a workflow step.

- **Parameters:**  
  `path`: Optional step path (string), can be static or parametric.

**Example:**
```ts
@Step('calculateValue')
calculateValue() { ... }
```

### `WorkflowParam(name: 'resume' | 'indexes' | 'schemaId' | 'stepId' | 'context' | 'input' | 'state')`

**Usage:** Injects workflow runtime parameters into a step method or controller property.

- **Parameters:**  
  `name` one of:  
  - `'resume'`: A function `(input: I) => Promise<TFlowOutput<T,I,IR>>` to resume workflow after input or retriable error.  
  - `'indexes'`: Current step indexes array.  
  - `'schemaId'`: Current workflow schemaId (string).  
  - `'stepId'`: Current stepId (string).  
  - `'context'`: Current workflow context (typed by generics).  
  - `'input'`: Input passed to workflow step.  
  - `'state'`: Workflow state object (with schemaId, context, indexes).

**Example:**
```ts
@Step('validate')
validate(@WorkflowParam('context') ctx: MyContext) {
  if (!ctx.valid) return { inputRequired: true };
}
```

## MoostWf Class

`MoostWf<T, IR>` represents a workflow adapter instance. It allows you to start and resume workflows programmatically.

### `start<I>(schemaId: string, initialContext: T, input?: I): Promise<TFlowOutput<T,I,IR>>`

**Usage:** Starts a workflow identified by `schemaId` with `initialContext`. Optionally provide `input` if the first step requires it.

- **Returns:** A promise that resolves to `TFlowOutput<T,I,IR>`.

**Example:**
```ts
const output = await wf.start('my-workflow', { a:1,b:2,c:3 });
```

If `inputRequired` or a `StepRetriableError` occurs, the workflow `interrupt` will be `true`, and `output.resume` can be used to continue later.

### `resume<I>(state: { schemaId: string; context: T; indexes: number[] }, input?: I): Promise<TFlowOutput<T,I,IR>>`

**Usage:** Resumes an interrupted workflow from the given state with the provided input.

- **Parameters:**  
  `state`: The `state` returned in a previous interrupted `TFlowOutput`.
  `input`: Data required to continue.

**Example:**
```ts
if (output.interrupt && output.state) {
  const resumed = await wf.resume(output.state, { a:10,b:20,c:30 });
}
```

## TFlowOutput Structure

When `start` or `resume` completes:

```ts
interface TFlowOutput<T, I, IR> {
  state: {
    schemaId: string;
    context: T;
    indexes: number[];
  };
  finished: boolean;
  inputRequired?: IR;
  interrupt?: boolean;
  break?: boolean;
  stepId: string;
  resume?: (input: I) => Promise<TFlowOutput<T, unknown, IR>>;
  retry?: (input?: I) => Promise<TFlowOutput<T, unknown, IR>>;
  error?: Error;
  expires?: number;
  errorList?: unknown;
}
```

- `finished`: `true` if workflow ended normally, otherwise `false`.
- `inputRequired`: If present, more input is needed.
- `interrupt`: `true` if workflow paused due to input or retriable error.
- `resume`: A function to continue the workflow after interruption.
- `error`: Any error thrown (e.g., `StepRetriableError`).
- `errorList`: Additional error details if provided.

