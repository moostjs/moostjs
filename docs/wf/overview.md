# Workflows Overview

Moost Workflows let you model multi-step processes as composable, typed sequences of operations. Instead of tangling business logic into deeply nested functions, you define discrete **steps**, arrange them into a **schema**, and let the workflow engine handle execution order, branching, pausing, and resumption.

## When to Use Workflows

Workflows are a good fit when your process:

- **Has multiple stages** that must execute in a specific order
- **Needs branching** based on runtime data (approve/reject, retry/abort)
- **Can be interrupted** to wait for user input, external approval, or async events
- **Requires auditability** — you need to trace what ran, when, and with what data
- **Spans time** — the process may take minutes, hours, or days to complete

Common examples: user onboarding, order fulfillment, document approval, data import pipelines, multi-step forms.

## Core Concepts

| Concept | What it does |
|---------|-------------|
| [**Steps**](/wf/steps) | Individual units of work — controller methods decorated with `@Step` |
| [**Schemas**](/wf/schemas) | Declarative arrays defining execution order, conditions, and loops |
| [**Context**](/wf/context) | Typed shared state that persists across all steps in a workflow |
| [**Pause & Resume**](/wf/pause-resume) | Interrupt a workflow to collect input, then continue from where it stopped |
| [**Error Handling**](/wf/errors) | Retriable errors that pause instead of fail, enabling graceful recovery |
| [**Spies**](/wf/spies) | Observers that monitor step execution for logging, timing, or auditing |

## How It Works

A typical workflow lifecycle:

1. **Define steps** as controller methods, each handling one piece of logic
2. **Compose a schema** that arranges steps with conditions and loops
3. **Start the workflow** with an initial context object
4. **Steps execute** in sequence, reading and mutating the shared context
5. **Workflow completes** — or **pauses** if a step needs input, then resumes later

```
start(schemaId, context)
    |
    v
[ step 1 ] --> [ step 2 ] --> { condition? } --yes--> [ step 3a ]
                                    |
                                    no
                                    |
                                    v
                              [ step 3b ] --> done
```

The workflow output tells you whether it finished, paused for input, or encountered an error — along with the full serializable state you can store and resume from later.

## What's Next?

Ready to try it? Head to the [Getting Started](/wf/) guide to build your first workflow.
