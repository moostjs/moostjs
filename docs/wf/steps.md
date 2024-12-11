# Defining Workflow Steps

Workflow steps define the logical units of work within a workflow. Each step is a method in a controller, decorated with `@Step("path")`. Steps can be parametric, request additional input, and are completely reusable across workflows.

## Key Points

- **Atomic Units:** Each step handles a small part of the workflow.
- **Method-Based:** Steps are controller methods decorated with `@Step("stepPath")`.
- **Parametric Paths:** Steps can use route parameters in their paths.
- **Requesting Input:** A step can return an object with `inputRequired` to pause the workflow and request input. `inputRequired` can be `true`, or any object (like a form schema) that your application understands and uses to gather input from users.
- **Resuming Workflow:** If a step requests input, the workflow interrupts. Later, you can resume the workflow by providing the required input. You can resume using:
  - The `resume` function returned in the workflow output.
  - `this.wf.resume(output.state, input)` from your application logic.

## Example

```ts
import { Step, WorkflowParam, Param } from '@moostjs/event-fw';
import { Controller, Injectable } from 'moost';

interface TQuadraticRootsContext {
  a: number; b: number; c: number;
  discriminant?: number; result?: string;
}

@Injectable("FOR_EVENT")
@Controller('math')
export class MathController {
  @WorkflowParam("context")
  ctx!: TQuadraticRootsContext;

  @Step("validateInputs")
  validate(@WorkflowParam("input") input?: Partial<TQuadraticRootsContext>) {
    if (input?.a === undefined || input?.b === undefined || input?.c === undefined) {
      // Request input. You could return just { inputRequired: true }
      // or a complex object describing what input is needed.
      return { inputRequired: { fields: ["a","b","c"] } };
    }
    this.ctx.a = +input.a; this.ctx.b = +input.b; this.ctx.c = +input.c;
    if (this.ctx.a === 0) throw new Error("a cannot be zero");
  }

  @Step("calculateDiscriminant")
  calcDisc() {
    this.ctx.discriminant = this.ctx.b * this.ctx.b - 4 * this.ctx.a * this.ctx.c;
  }

  @Step("noSolutions")
  noSol() { this.ctx.result = "No real solutions"; }

  @Step("calc/:type(single|double)")
  calcRoots(@Param("type") type: "single"|"double") {
    const { a,b,discriminant:d } = this.ctx;
    if (type === "single") {
      this.ctx.result = `x = ${b/(2*a)}`;
    } else {
      this.ctx.result = `x1=${(-b+Math.sqrt(d!))/(2*a)}, x2=${(-b-Math.sqrt(d!))/(2*a)}`;
    }
  }
}
```

## Handling Input Requirements

When a step returns `inputRequired`, the workflow output might look like:

```json
{
  "state": { "schemaId": "...", "context": { ... }, "indexes": [0] },
  "finished": false,
  "stepId": "validateInputs",
  "interrupt": true,
  "inputRequired": { "fields": ["a","b","c"] },
  "resume": [Function]
}
```

Your application can interpret `inputRequired` however it likes. It could be a simple `true`, or a structured object representing a form schema.

Once you've collected the input:

- Use the `resume` function:
  ```ts
  const resumed = await output.resume({ a:1, b:5, c:-6 });
  ```
- Or use `this.wf.resume(output.state, { a:1, b:5, c:-6 })`:
  ```ts
  const resumed = await this.wf.resume(output.state, { a:1, b:5, c:-6 });
  ```

## Best Practices

- **Keep Steps Atomic:** Focus each step on a single task.
- **Parametric Paths Sparingly:** Use parametric paths only when they add clarity.
- **Document Input Requirements:** Clearly specify what input a step might need.
- **Make `inputRequired` Flexible:** Return simple flags or complex objects as needed.
- **Reuse Steps:** Steps can be reused in multiple workflows.

