# Quick Start with Moost Workflows

This guide walks you through setting up a simple Moost workflow-enabled application, from initial project creation to running your first workflow. You have two options to get started:

1. **Use the Built-in Moost Workflows Example:** During project creation, choose to add the Moost Workflows Example, which includes a user registration workflow with HTTP integration for immediate experimentation.
2. **Add Moost Workflows Manually:** Follow the steps below to integrate workflows into your existing or newly created Moost HTTP application.

## Option 1: Use the Built-in Moost Workflows Example

When creating a new Moost application, you can opt to include the Moost Workflows Example, which provides a pre-configured user registration workflow with HTTP integration. This option is ideal for quickly getting started and exploring workflow functionalities without manual setup.

### Steps

#### 1. Create a New Moost App with Workflows Example

Run the interactive project generator and choose to add the Moost Workflows Example when prompted:

```bash
npm create moost@latest
```

During the setup process, you will be presented with various options. Select **"Add Moost Workflows Example"** to include the user registration workflow with HTTP integration.

After creation, navigate to the project directory:

```bash
cd your-app-name
```

#### 2. Install Dependencies

Ensure all necessary dependencies are installed. If you opted to add the Moost Workflows Example during project creation, most dependencies should already be included. However, it's good practice to verify and install any missing packages:

```bash
npm install
```

#### 3. Run the App

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser to interact with the user registration workflow. You can follow the HTTP prompts to register a new user, demonstrating the integration between HTTP routes and workflow steps.

## Option 2: Add Moost Workflows Manually

If you prefer to integrate workflows into an existing Moost HTTP application or customize the workflow setup, follow the steps below.

### Steps

#### 1. Create a New Moost App

Run the interactive project generator and choose HTTP for this example:

```bash
npm create moost@latest
```

Follow the prompts to generate a new Moost-HTTP application (Web APP). After creation, navigate to the project directory:

```bash
cd your-app-name
```

#### 2. Install the Workflow Adapter

Install the workflow package to enable workflow features:

```bash
npm install @moostjs/event-wf
```

#### 3. Define the Workflow Controller

Create a `wf.controller.ts` in `src/controllers`:

```ts
// src/controllers/wf.controller.ts

import { Step, Workflow, WorkflowParam, WorkflowSchema } from "@moostjs/event-wf"
import { Controller, Injectable, Param } from "moost"

export interface TQuadraticRootsContext {
  a: number
  b: number
  c: number
  discriminant: number
  result: string
}

export interface TQuadraticRootsInputs {
  a: number
  b: number
  c: number
}

@Injectable("FOR_EVENT")
@Controller()
export class WfController {
  @WorkflowParam("context")
  ctx!: TQuadraticRootsContext

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
      return { inputRequired: true }
    }
    this.ctx.a = +input.a
    this.ctx.b = +input.b
    this.ctx.c = +input.c
    if (this.ctx.a === 0) throw new Error("a cannot be zero")
  }

  @Step("calculateDiscriminant")
  calculateDiscriminant() {
    this.ctx.discriminant = this.ctx.b * this.ctx.b - 4 * this.ctx.a * this.ctx.c
  }

  @Step("noSolutions")
  noSolutions() {
    this.writeResult("No real solutions")
  }

  @Step("calc/:roots(single|double)")
  calcSingleRoot(@Param("roots") roots: "single" | "double") {
    if (roots === "single") {
      this.writeResult(`x = ${this.ctx.b / (2 * this.ctx.a)}`)
    } else {
      this.writeResult(
        `x1=${(-this.ctx.b + Math.sqrt(this.ctx.discriminant)) / (2 * this.ctx.a)}, x2=${(-this.ctx.b - Math.sqrt(this.ctx.discriminant)) / (2 * this.ctx.a)}`
      )
    }
  }

  writeResult(x: string) {
    this.ctx.result = x
  }
}
```

This defines a workflow (`@Workflow("quadratic-roots")`) with a schema that chooses different steps based on the discriminant value. Steps are defined to validate inputs, calculate the discriminant, and compute roots or report no solutions.

#### 4. Update Main Controller to Trigger the Workflow

In `src/controllers/app.controller.ts`:

```ts
// src/controllers/app.controller.ts

import { Body, Get, Post, SetHeader } from "@moostjs/event-http"
import { MoostWf } from "@moostjs/event-wf"
import { serveFile } from "@wooksjs/http-static"
import { Controller, Param } from "moost"

import type {
  TWfExampleContext,
  TWfExampleInput,
  TWfExampleInputSchema,
  TWfState,
} from "../workflow/wf.types"
import { Wf2HtmlPage } from "../workflow/wf2html.interceptor"

@Controller()
export class AppController {
  constructor(
    private readonly wf: MoostWf<TWfExampleContext, TWfExampleInputSchema>
  ) {}

  @Get("hello/:name")
  hello(@Param("name") name: string) {
    return `Hello ${name}`
  }

  @Get("wf")
  @Post("wf")
  @SetHeader("content-type", "text/html")
  @Wf2HtmlPage()
  async startWf(@Body() formInput?: TWfExampleInput) {
    const { wfState, ...rest } = formInput || {}
    const input = formInput ? rest : undefined
    if (typeof wfState === "object") {
      return this.wf.resume<TWfExampleInput>(wfState as TWfState, input)
    }
    return this.wf.start<TWfExampleInput>("wf-example", {}, input)
  }

  @Get("static/*")
  async serveStaticFile(@Param("*") filePath: string) {
    return serveFile(`./src/static/${filePath}`, {
      cacheControl: { noCache: true },
    })
  }
}
```

We start the workflow with no initial input. If `inputRequired` is encountered, we resume the workflow with the provided parameters.

#### 5. Register the Workflow Adapter and Controllers

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

app.registerControllers(AppController, WfController).init()
```

This setup integrates both HTTP and Workflow adapters, registers the necessary controllers, and starts the server on port 3000.

#### 6. Run the App

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000/quadratic-roots/2/5/2` in your browser or use `curl`:

```bash
curl http://localhost:3000/quadratic-roots/2/5/2
```

### What Happens?

- **Request:** `GET /quadratic-roots/2/5/2`
- **Flow:**
  1. The request triggers the `@Get("quadratic-roots/:a/:b/:c")` endpoint in `AppController`.
  2. This starts the workflow "quadratic-roots".
  3. The workflow initially has no input, so it asks for it (`inputRequired`).
  4. The controller resumes the workflow with `a=2`, `b=5`, `c=2`.
  5. Workflow steps execute: `validateInputs`, `calculateDiscriminant`.
  6. Since `discriminant > 0`, the `calc/double` step executes.
  7. The final result is returned, showing the computed roots.

### Next Steps

Explore more about workflows:

- [Workflow Entry Point](/wf/entry)
- [Workflow Steps](/wf/steps)
- [Workflow Schema](/wf/schema)
- [Workflow Context](/wf/context)
- [Retriable Error](/wf/retriable-error)

By building on these concepts, you can create complex, interactive, and resilient workflows tailored to your application's needs.
