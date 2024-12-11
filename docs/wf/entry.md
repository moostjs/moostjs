# Workflow Entry Point

A **Workflow Entry Point** defines the starting point of a workflow within a controller method. Using `@Workflow` and `@WorkflowSchema`, you specify the workflow path and the sequence of steps. The entry point itself remains minimal, deferring all logic and data processing to the workflow’s steps.

## Defining a Workflow Entry Point

A workflow entry point is created by applying the `@Workflow` decorator to a method, along with `@WorkflowSchema` to define the workflow’s steps.

**Example (Parametric Path):**
```ts
import { Workflow, WorkflowSchema, Param } from '@moostjs/event-fw';
import { Controller } from 'moost';

interface TQuadraticRootsContext {
  a: number;
  b: number;
  c: number;
  discriminant?: number;
  roots?: number[];
}

@Controller('math')
export class MathController {
  @Workflow("quadratic-roots/:a/:b/:c")
  @WorkflowSchema<TQuadraticRootsContext>([/* schema */])
  entryPoint(@Param('a') a: number, @Param('b') b: number, @Param('c') c: number) {
    // Keep entry point logic minimal.
    // In this example it makes sense to store parameters in wf context
  }
}
```

**Key Points:**
- `@Workflow("...")`: Defines the workflow's path.
- `@WorkflowSchema(...)`: Specifies the workflow’s steps and conditions.
- Controller prefixes apply automatically to the workflow path.
- The entry point method ideally contains no significant logic.

## Triggering a Workflow

Inject `MoostWf` from `@moostjs/event-wf` into your class and call `.start()` to begin the workflow.

```ts
import { Injectable } from 'moost';
import { MoostWf } from '@moostjs/event-wf';

@Injectable()
export class CalculationService {
  constructor(private readonly wf: MoostWf<TQuadraticRootsContext>) {}

  async findRoots(a: number, b: number, c: number) {
    await this.wf.start(`math/quadratic-roots/${a}/${b}/${c}`, { /* initial context */ });
  }
}
```

## Passing Input to the Workflow

While param decorators (`@Param`) within the entry point method are one way to provide input to the workflow, there are multiple options for supplying data to workflows:

- **Initial Context When Starting the Workflow:**  
  Supply an initial context object when calling `wf.start()`.
- **Sending Additional Input:**  
  Pass arbitrary input data during `wf.start()` calls.

**More details on supplying input:**  
[Working with Workflow Input](/wf/steps#handling-input-requirements)

## Conclusion

The workflow entry point simply identifies where a workflow begins. By combining `@Workflow`, `@WorkflowSchema`, and various input strategies, you can set up workflows to handle a wide range of scenarios, keeping the entry point itself lean and delegating all processing to well-structured workflow steps.
