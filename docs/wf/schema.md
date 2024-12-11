# Workflow Schema

A workflow schema defines the execution flow of your workflow’s steps. It’s attached to the workflow entry point via `@WorkflowSchema(...)`. The schema is an array describing steps, conditions, loops, and break conditions. Using functions or strings for conditions supports easy serialization, making it practical to store schemas in a database.

## Basic Structure

A simple schema is just an ordered list of step IDs:
```ts
@Workflow("simple-wf")
@WorkflowSchema(["step1", "step2", "step3"])
entryPoint() {}
```

## Conditional Steps

Use `condition` to run a step only if the condition passes. Conditions can be functions `(ctx) => boolean` or strings (evaluated against `ctx`). String conditions ease serialization for storage in databases.

```ts
@WorkflowSchema([
  "validateInputs",
  "calculateDiscriminant",
  { condition: (ctx) => ctx.discriminant < 0, id: "noSolutions" },
  { condition: 'discriminant === 0', id: "calc/single" },
  { condition: 'discriminant > 0', id: "calc/double" },
])
```

## Loops with `while`

A `while` block repeats its `steps` until its condition is false. Conditions can also be strings for easy serialization.

```ts
@WorkflowSchema([
  {
    while: 'attempts < 5 && !emailSent',
    steps: [
      { id: 'sendEmail', input: 'test@example.com' },
      { id: 'increaseAttempts' },
    ],
  },
  { id: 'logFailure', condition: '!emailSent' }
])
```

## Breaking Loops

Use `break` inside loop steps to end the loop early if a condition is met.

```ts
@WorkflowSchema([
  {
    while: 'machineRunning',
    steps: [
      "checkTemperature",
      { break: 'temperature > safeLimit' },
      "continueOperation"
    ]
  },
  { id: 'stopMachine', condition: 'temperature > safeLimit' }
])
```

## Parametric Steps and Input

Steps may have parametric paths and can receive input specified in the schema:
```ts
@WorkflowSchema([
  { id: 'calc/double', input: { x: 5 } }
])
```

## Full Example

Below is a complete controller example showing a workflow entry point and schema with conditions, along with steps defined in the same controller:

```ts
import { Step, Workflow, WorkflowParam, WorkflowSchema } from "@moostjs/event-wf";
import { Controller, Injectable, Param } from "moost";

export interface TQuadraticRootsContext {
  a: number; b: number; c: number;
  discriminant: number; result: string;
}

export interface TQuadraticRootsInputs { a: number; b: number; c: number; }

@Injectable("FOR_EVENT")
@Controller('/with-input')
export class WfController2 {
  @WorkflowParam("context")
  ctx!: TQuadraticRootsContext;

  @Workflow("quadratic-roots")
  @WorkflowSchema<TQuadraticRootsContext>([
    "validateInputs",
    "calculateDiscriminant",
    { condition: (ctx) => ctx.discriminant < 0, id: "noSolutions" },
    { condition: (ctx) => ctx.discriminant === 0, id: "calc/single" },
    { condition: (ctx) => ctx.discriminant > 0, id: "calc/double" },
  ])
  entryPoint() {
    // empty entry
  }

  @Step("validateInputs")
  validateInputs(@WorkflowParam("input") input?: Partial<TQuadraticRootsInputs>) {
    if (input?.a === undefined || input?.b === undefined || input?.c === undefined) {
      return { inputRequired: true };
    }
    this.ctx.a = +input.a; this.ctx.b = +input.b; this.ctx.c = +input.c;
    if (this.ctx.a === 0) throw new Error("a cannot be zero");
  }

  @Step("calculateDiscriminant")
  calculateDiscriminant() {
    this.ctx.discriminant = this.ctx.b * this.ctx.b - 4 * this.ctx.a * this.ctx.c;
  }

  @Step("noSolutions")
  noSolutions() {
    this.writeResult("No real solutions");
  }

  @Step("calc/:roots(single|double)")
  calcSingleRoot(@Param("roots") roots: "single" | "double") {
    const { a,b,discriminant:d } = this.ctx;
    if (roots === "single") {
      this.writeResult(`x = ${b/(2*a)}`);
    } else {
      this.writeResult(`x1 = ${(-b+Math.sqrt(d!))/(2*a)}, x2 = ${(-b-Math.sqrt(d!))/(2*a)}`);
    }
  }

  writeResult(x: string) {
    this.ctx.result = x;
  }
}
```

**Highlights:**
- Parametric step: `calc/:roots(single|double)` adjusts behavior based on `roots`.
- Conditions determine which step runs after `calculateDiscriminant`.
- `inputRequired` can pause the workflow, allowing you to resume later with input.

## Summary

The workflow schema is a flexible array defining execution order, conditions, loops, breaks, parametric steps, and input injection. By supporting both functions and string conditions, Moost makes it easy to serialize and store schema definitions externally, promoting dynamic and configurable workflows.
