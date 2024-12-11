# Defining and Using Workflow Context

The workflow context is a typed object that holds shared state between steps. By defining an interface and using it as a generic in `@WorkflowSchema` and other workflow-related decorators, Moost provides type safety and better developer experience when working with workflow data.

## Key Points

- **Typed Context:** Define an interface for your workflow's context. This interface represents the shared data accessible by all steps.
- **Generic Schema Types:** Pass your context type to `@WorkflowSchema<T>()` so conditions and steps can be type-checked.
- **Runtime Access:** Use `@WorkflowParam("context")` to access the current workflow context in your steps or controller properties.
- **Scopes Matter:** If your controller is scoped per-event (`@Injectable("FOR_EVENT")`), you can store the context in a class property. Otherwise, use `@WorkflowParam("context")` as a step method parameter.

## Example Context

```ts
export interface TQuadraticRootsContext {
  a: number;
  b: number;
  c: number;
  discriminant: number;
  result: string;
}
```

By referencing this interface in your schema:
```ts
@WorkflowSchema<TQuadraticRootsContext>([
  "validateInputs",
  "calculateDiscriminant",
  { condition: (ctx) => ctx.discriminant < 0, id: "noSolutions" },
  { condition: (ctx) => ctx.discriminant === 0, id: "calc/single" },
  { condition: (ctx) => ctx.discriminant > 0, id: "calc/double" }
])
```
The condition callbacks receive `ctx` as `TQuadraticRootsContext`, ensuring type-safe logic.

## Accessing Context

### Using a Controller Property (FOR_EVENT Scope)

If your controller is event-scoped:
```ts
@Injectable("FOR_EVENT")
@Controller('math')
export class MathController {
  @WorkflowParam("context")
  ctx!: TQuadraticRootsContext;

  @Step("calculateDiscriminant")
  calcDisc() {
    this.ctx.discriminant = this.ctx.b * this.ctx.b - 4 * this.ctx.a * this.ctx.c;
  }
}
```

`this.ctx` is strongly typed and available in all steps of this controller instance.

### Using a Step Parameter

For singleton-scoped controllers, inject context directly into the step method:
```ts
@Step("calculateDiscriminant")
calcDisc(@WorkflowParam("context") ctx: TQuadraticRootsContext) {
  ctx.discriminant = ctx.b * ctx.b - 4 * ctx.a * ctx.c;
}
```

## Output Context

When the workflow finishes or interrupts:
```ts
const output = await this.wf.start("my/workflow", { a:1,b:5,c:-6 });
console.log(output.state.context); // Typed as Partial<TQuadraticRootsContext>
```

If you typed your `MoostWf` instance, the context in `output.state.context` will also be type-checked.

```ts
constructor(private wf: MoostWf<Partial<TQuadraticRootsContext>>) {}
```

This ensures all returned workflow outputs reflect the proper context shape.
