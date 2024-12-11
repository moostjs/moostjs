# Interceptors and Pipes in Workflows

In Moost, **workflow entry points and steps are event handlers**, just like regular route handlers. This means that the same mechanisms for **interceptors** and **pipes** apply to workflow steps as well.

## Interceptors

Interceptors run before and after each event handler, or on error. They can modify requests, responses, or inject logic around your workflow steps.

- **Pre-Step Logic:** Apply interceptors to run checks or add data before a workflow step executes.
- **Post-Step Logic:** Add logging or cleanup after a step finishes.
- **Error Handling:** Intercept errors, including those raised by `StepRetriableError`, to log or alert.

**Learn more:** [Interceptors](/moost/interceptors)

## Pipes

Pipes process data flowing into or out of steps. They can handle transformations, validations, and other pre/post-processing tasks.

- **Validation:** Validate input before it reaches the step logic.
- **Transformation:** Convert data formats or parse values for workflow steps.

**Learn more:** [Introduction to Pipelines](/moost/pipes/)

## Dependency Injection (DI)

Moost’s DI system integrates seamlessly with workflows, steps, interceptors, and pipes, ensuring that all dependencies (services, providers) are resolved cleanly.

**Learn more:** [Introduction to DI](/moost/di/)

## Summary

Since workflow steps are essentially event handlers, all of Moost's standard features — interceptors, pipes, and DI — work the same way. By combining these tools with your workflows, you can create flexible, maintainable, and robust event-driven processes.
