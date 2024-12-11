# Custom Pipes in Moost

This guide walks you through creating a custom pipe using Moost’s metadata system, enabling parameter-specific transformations.

## Key Concepts

1. **Metadata System:**  
   Moost utilizes a metadata-driven approach to parameterize pipes. By decorating parameters or properties, you attach metadata that guides how pipes should process each piece of data.

2. **Pipeline Execution:**  
   During pipeline execution, pipes read the associated metadata to determine the appropriate transformation logic. This ensures that each data element is processed according to its specific requirements.

3. **Decorator Integration:**  
   Custom decorators are used to attach metadata to parameters or properties, which the pipes then utilize during execution.

## Creating a Custom Pipe: Case Transformation Example

Let’s create a custom pipe that transforms string values to different cases — uppercase, lowercase, camelCase, and PascalCase — based on metadata applied via decorators.

### Step 1: Define the Pipe and Decorators

First, create a file named `case-pipe.ts` and define the custom pipe along with decorators to specify the desired case transformation.

```ts
// case-pipe.ts

import { definePipeFn, getMoostMate, TPipePriority } from "moost";

// Define a custom metadata type to store the case-pipe option
type TCustomMeta = {
  casePipeOption?: "lower" | "upper" | "camel" | "pascal";
};

// Get the @prostojs/mate instance used in Moost
const mate = getMoostMate<TCustomMeta, TCustomMeta, TCustomMeta>();

// Define decorators for case transformations
export const Uppercase = () => mate.decorate("casePipeOption", "upper");
export const Lowercase = () => mate.decorate("casePipeOption", "lower");
export const Camelcase = () => mate.decorate("casePipeOption", "camel");
export const Pascalcase = () => mate.decorate("casePipeOption", "pascal");

// Define the case-pipe
export const casePipe = definePipeFn<TCustomMeta>((value, metas, level) => {
  const caseOption =
    metas.paramMeta?.casePipeOption ||
    metas.methodMeta?.casePipeOption ||
    metas.classMeta?.casePipeOption;

  switch (caseOption) {
    case "upper":
      return typeof value === "string" ? value.toUpperCase() : value;
    case "lower":
      return typeof value === "string" ? value.toLowerCase() : value;
    case "camel":
      return typeof value === "string"
        ? value
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
              index === 0 ? word.toLowerCase() : word.toUpperCase()
            )
            .replace(/\s+/g, "")
        : value;
    case "pascal":
      return typeof value === "string"
        ? value
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => word.toUpperCase())
            .replace(/\s+/g, "")
        : value;
    default:
      return value;
  }
}, TPipePriority.TRANSFORM);
```

**Explanation:**

- **Metadata Definition (`TCustomMeta`):**  
  Defines a custom metadata type to store the case transformation option.


::: warning

When defining custom metadata for your pipes, **ensure that the metadata property names are unique and do not conflict** with Moost's native metadata or any third-party metadata. In this example, the metadata property `casePipeOption` is used specifically for the custom case transformation pipe. Using unique names prevents unintended behavior and maintains compatibility within your application.

```ts
type TCustomMeta = {
  casePipeOption?: "lower" | "upper" | "camel" | "pascal";
};
```
**Note:** Always choose distinctive names for custom metadata properties to avoid collisions with existing or future metadata keys used by Moost or other integrated libraries.
:::

- **Decorators (`Uppercase`, `Lowercase`, `Camelcase`, `Pascalcase`):**  
  These decorators attach the desired case transformation option to parameters or properties.

- **Pipe Definition (`casePipe`):**  
  The `casePipe` function reads the metadata and applies the appropriate case transformation to the input value.

### Step 2: Apply the Custom Pipe in a Controller

Next, create a controller that utilizes the custom pipe to transform input data based on the attached decorators.

```ts
// controllers/app.controller.ts

import { Get, Query } from '@moostjs/event-http';
import { Controller, Param, Pipe } from 'moost';
import { casePipe, Pascalcase, Uppercase } from '../case-pipe';

@Pipe(casePipe) // Apply the case-pipe to the controller
@Controller()
export class AppController {
  
  @Get("hello/:name")
  greet(
    @Uppercase() // Transform the 'name' parameter to uppercase
    @Param("name") 
    name: string,

    @Pascalcase() // Transform the 'jobTitle' query parameter to PascalCase
    @Query("jobTitle") 
    jobTitle: string
  ) {
    return `Hello, ${name}!\nJob Title: ${jobTitle || "unknown"}`;
  }
}
```

**Explanation:**

- **Controller-Level Pipe (`@Pipe(casePipe)`):**  
  Applies the `casePipe` to all parameters and properties within the `AppController`.

- **Parameter Decorators (`@Uppercase()`, `@Pascalcase()`):**  
  Attach specific case transformation metadata to individual parameters.

- **Handler Method (`greet`):**  
  Receives transformed parameters based on the attached decorators.

### Step 3: Testing the Custom Pipe

Start your Moost application and test the custom pipe functionality using `curl` or any HTTP client.

```bash
curl -X GET http://localhost:3000/hello/Joe?jobTitle=node%20js%20backend%20developer
```

**Expected Response:**

```
Hello, JOE!
Job Title: NodeJsBackendDeveloper
```

**Explanation:**

- The `name` parameter (`Joe`) is transformed to uppercase (`JOE`) due to the `@Uppercase()` decorator.
- The `jobTitle` query parameter (`node js backend developer`) is transformed to PascalCase (`NodeJsBackendDeveloper`) due to the `@Pascalcase()` decorator.

## Detailed Breakdown

### 1. Defining Custom Decorators

Custom decorators (`Uppercase`, `Lowercase`, `Camelcase`, `Pascalcase`) are created using Moost’s metadata system. These decorators attach specific transformation options to the parameters or properties they decorate.

```ts
export const Uppercase = () => mate.decorate("casePipeOption", "upper");
export const Lowercase = () => mate.decorate("casePipeOption", "lower");
export const Camelcase = () => mate.decorate("casePipeOption", "camel");
export const Pascalcase = () => mate.decorate("casePipeOption", "pascal");
```

### 2. Creating the Pipe Function

The `casePipe` function processes the input value based on the attached metadata. It reads the `casePipeOption` from metadata and applies the corresponding transformation.

```ts
export const casePipe = definePipeFn<TCustomMeta>((value, metas, level) => {
  const caseOption =
    metas.paramMeta?.casePipeOption ||
    metas.methodMeta?.casePipeOption ||
    metas.classMeta?.casePipeOption;

  switch (caseOption) {
    case "upper":
      return typeof value === "string" ? value.toUpperCase() : value;
    case "lower":
      return typeof value === "string" ? value.toLowerCase() : value;
    case "camel":
      return typeof value === "string"
        ? value
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
              index === 0 ? word.toLowerCase() : word.toUpperCase()
            )
            .replace(/\s+/g, "")
        : value;
    case "pascal":
      return typeof value === "string"
        ? value
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => word.toUpperCase())
            .replace(/\s+/g, "")
        : value;
    default:
      return value;
  }
}, TPipePriority.TRANSFORM);
```

### 3. Attaching Pipes via Decorators

Decorators are used to attach the custom pipe metadata to specific parameters or properties. When the pipeline runs, it reads this metadata to apply the transformations.

```ts
@Pipe(casePipe) // Apply the custom pipe to the controller
@Controller()
export class AppController {
  
  @Get("hello/:name")
  greet(
    @Uppercase() // Apply uppercase transformation
    @Param("name") 
    name: string,

    @Pascalcase() // Apply PascalCase transformation
    @Query("jobTitle") 
    jobTitle: string
  ) {
    return `Hello, ${name}!\nJob Title: ${jobTitle || "unknown"}`;
  }
}
```
