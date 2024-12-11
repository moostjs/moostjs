# Moost Workflows Overview

Moost’s workflow system integrates seamlessly with its event-driven architecture and metadata-driven approach, allowing you to orchestrate complex sequences of operations as workflows. These workflows are flexible and minimally opinionated, providing a core set of tools to define steps, conditions, input handling, and error management — but leaving the specifics of how you want to implement them entirely up to you.

## Why Use Moost Workflows?

- **Modularity:** Break down complex processes into discrete steps, making large tasks easier to maintain and reason about.
- **Flexibility:** Define conditions, loops, and branching logic at a high level without rigid constraints.
- **Typed Context and Input:** Strong typing through TypeScript generics ensures safe access to workflow state and input.
- **Resilience:** Pause workflows for input or retry failed steps without losing global context, streamlining user-interactive or error-prone operations.
- **Minimal Opinionation:** Moost provides core workflow primitives. You decide how to interpret `inputRequired`, how to store schemas, and how to present input forms, adapt contexts, or handle retriable errors.

## Key Components

### Workflow Entry Point
A workflow starts at an entry point method, defined by the `@Workflow` decorator and associated with a schema. This method typically contains no logic — just the path and schema definition. Parameters can be injected directly from the route, providing initial data to the workflow.

**Learn more:** [Workflow Entry Point](/wf/entry)

### Workflow Steps
Each step represents a single unit of logic. Steps are methods in a controller, marked with `@Step("path")`. Steps can be atomic and reusable, parametric, and can request additional input if they can’t proceed.

**Learn more:** [Workflow Steps](/wf/steps)

### Workflow Schema
The schema dictates the workflow’s flow: an array of steps, conditions, loops (`while`), and breaks. Conditions can be defined as functions or strings, allowing easy serialization for storage in a database. This approach supports dynamic, data-driven workflows with minimal boilerplate.

**Learn more:** [Workflow Schema](/wf/schema)

### Workflow Context
The workflow context holds state shared across all steps. Define an interface for your context and apply it as a generic type to `@WorkflowSchema`. Steps can access context via `@WorkflowParam("context")`, providing strongly typed, secure state management throughout the workflow’s lifetime.

**Learn more:** [Workflow Context](/wf/context)

### Retriable Errors
Not all errors must terminate the workflow. By throwing a `StepRetriableError`, you can pause the workflow. The output will indicate the error and that the workflow is interrupted, not finished. Input can be requested or errors explained, and you can resume later after resolving the issue.

**Learn more:** [Retriable Error](/wf/retriable-error)

## Putting It All Together

A typical Moost workflow:

1. **Define the context** for your workflow’s data model.
2. **Create an entry point** decorated with `@Workflow` and `@WorkflowSchema`.
3. **Implement steps**, each handling a small piece of logic.
4. **Add conditions, loops, and breaks** in the schema to control the workflow’s execution path.
5. **Access and modify context** in steps as needed.
6. **Handle input requirements or transient errors** by returning `inputRequired` or using `StepRetriableError`, allowing the workflow to pause and resume gracefully.

This modular design encourages you to adapt these primitives to your application’s unique needs. Whether you want to store workflow schemas in a database, dynamically generate conditions, or provide complex UI forms for required input, Moost workflows provide a solid foundation without forcing a single pattern.

