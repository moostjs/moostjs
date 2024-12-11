# Quick Start with Moost Workflows

This guide walks you through setting up a simple Moost workflow-enabled application, from initial project creation to running your first workflow.

## Steps

### 1. Create a New Moost App

Run the interactive project generator and choose HTTP for this example:

```bash
npm create moost@latest
```

Follow the prompts to generate a new Moost-HTTP application (Web APP). After creation, navigate to the project directory:

```bash
cd your-app-name
```

### 2. Install the Workflow Adapter

Install the workflow package to enable workflow features:

```bash
npm install @moostjs/event-wf
```

### 3. Define the Workflow Controller

Create a `wf.controller.ts` in `src/controllers`:

```ts
// src/controllers/wf.controller.ts

import { Step, Workflow, WorkflowParam, WorkflowSchema } from "@moostjs/event-wf";
import { Controller, Injectable, Param } from "moost";

export interface TQuadraticRootsContext {
  a: number;
  b: number;
  c: number;
  discriminant: number;
  result: string;
}

export interface TQuadraticRootsInputs {
  a: number;
  b: number;
  c: number;
}

@Injectable("FOR_EVENT")
@Controller()
export class WfController {
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
    // Empty entry method
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
    if (roots === "single") {
      this.writeResult(`x = ${this.ctx.b / (2 * this.ctx.a)}`);
    } else {
      this.writeResult(
        `x1=${(-this.ctx.b + Math.sqrt(this.ctx.discriminant)) / (2 * this.ctx.a)}, x2=${(-this.ctx.b - Math.sqrt(this.ctx.discriminant)) / (2 * this.ctx.a)}`
      );
    }
  }

  writeResult(x: string) {
    this.ctx.result = x;
  }
}
```

This defines a workflow (`@Workflow("quadratic-roots")`) with a schema that chooses different steps based on the discriminant value. Steps are defined to validate inputs, calculate the discriminant, and compute roots or report no solutions.

### 4. Update Main Controller to Trigger the Workflow

In `src/controllers/app.controller.ts`:
```ts
// src/controllers/app.controller.ts

import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'
import { MoostWf } from '@moostjs/event-wf';
import { TQuadraticRootsContext, TQuadraticRootsInputs } from './wf.controller';

@Controller()
export class AppController {
  constructor(private wf: MoostWf<Partial<TQuadraticRootsContext>>) {}

  @Get("quadratic-roots/:a/:b/:c")
  async quadraticRoots(@Param("a") a: number, @Param("b") b: number, @Param("c") c: number) {
    const output = await this.wf.start<TQuadraticRootsInputs>("quadratic-roots", {});
    if (output.inputRequired && output.resume) {
      const { state } = await output.resume({ a, b, c });
      return { resumed: true, result: state.context.result };
    }
    return output.state.context.result;
  }
}
```

We start the workflow with no initial input. If `inputRequired` is encountered, we resume the workflow with the provided parameters.

### 5. Register the Workflow Adapter and Controllers

Update `src/main.ts`:
```ts
// src/main.ts

import { MoostHttp } from '@moostjs/event-http'
import { MoostWf } from '@moostjs/event-wf'
import { AppController } from './controllers/app.controller'
import { WfController } from './controllers/wf.controller'
import { Moost } from 'moost'

const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
app.adapter(new MoostWf())

app.registerControllers(AppController, WfController).init();
```

### 6. Run the App

```bash
npm run dev
```

Open `http://localhost:3000/quadratic-roots/2/5/2` in your browser or use `curl`.

### What Happens?

- The request triggers the `@Get("quadratic-roots/:a/:b/:c")` endpoint in `AppController`.
- This starts the workflow "quadratic-roots".
- The workflow initially has no input, so it asks for it (`inputRequired`).
- The controller resumes the workflow with `a=2,b=5,c=2`.
- Steps run: `validateInputs`, `calculateDiscriminant`, then since `discriminant > 0`, the `calc/double` step executes.
- The final result is returned, showing the computed roots.

### Next Steps

Explore more about workflows:

- [Workflow Entry Point](/wf/entry)
- [Workflow Steps](/wf/steps)
- [Workflow Schema](/wf/schema)
- [Workflow Context](/wf/context)
- [Retriable Error](/wf/retriable-error)
  
By building on these concepts, you can create complex, interactive, and resilient workflows tailored to your application's needs.
