<script setup>
import EventLifecycle from '../components/event-lifecycle-diagram.vue'
</script>

# Moost Event Lifecycle

When Moost receives an event (e.g. an HTTP request, a CLI command), it orchestrates a series of steps to route the event, initialize the necessary state, invoke the appropriate handler, and process interceptors and responses. Understanding this lifecycle helps developers anticipate where to integrate their logic — such as validation, authentication, logging, or error handling — and how to best leverage Moost’s composable and extensible architecture.

## Diagram

Below is a representative diagram illustrating the lifecycle of a Moost event.

<EventLifecycle />

## Detailed Steps

1. **Incoming Event**  
   The lifecycle begins when Moost receives an event. This might be an HTTP request, a CLI command, or another type of event. At this point, Moost prepares to handle it by creating a fresh, isolated context.

2. **Create Event Context**  
   Wooks uses `createAsyncEventContext` ([What is Wooks?](https://wooks.moost.org/wooks/what)) to initialize a per-event context that persists across asynchronous operations. This ensures each event has its own storage for data, dependencies, and state.
  

3. **Perform Routing**  
   The event is passed through the router (e.g., `router.lookup`) to find a matching handler. If a route matches, Wooks identifies which [controller](/moost/controllers) and handler method will process this event. If not found, a "Not Found" error is raised (Step 11).

4. **Set Controller Instance in Event Context**  
   With a route found, Moost either creates or retrieves an appropriate [controller](/moost/controllers) instance. It attaches this [controller](/moost/controllers) to the event context, making it accessible throughout the event lifecycle.

5. **Initialize Interceptors**  
   Moost initializes all applicable interceptors. [Interceptors](/moost/interceptors) are like middleware: they can hook into the event lifecycle, adding logic before and after the handler executes, and can handle errors. If an error occurs here, Moost moves directly to error handling (Step 11).

6. **Resolve Handler Arguments**  
   The handler’s parameters are resolved using [pipelines](/moost/pipelines). This includes [resolve pipeline](/moost/resolve-pipeline), [validation pipeline](/moost/validation-pipeline) (optional) and custom pipelines (optional). If something goes wrong (e.g., invalid data), Moost proceeds to error handling (Step 11).

7. **Run Interceptors 'before' Hooks**  
   [Interceptors](/moost/interceptors) run their "before" hooks, allowing tasks such as authentication checks, request transformations, or early bail-outs. Again, errors here are caught and result in jumping to Step 11.

8. **Call Handler Method With Resolved Arguments**  
   The handler method is invoked. It receives fully prepared arguments, so the logic within the handler can focus purely on business logic. If the handler throws an error, Moost transitions to the 'onError' hooks of interceptors (Step 10). If an error occurs beforehand, Step 11 is triggered.

9. **Run Interceptors 'after' Hooks**  
    If the handler succeeded, Moost executes the "after" hooks of [interceptors](/moost/interceptors). This could involve adding headers, logging success, or modifying the response. Errors here also lead to Step 11.

10. **Run Interceptors 'onError' Hooks**  
   If the handler failed, [interceptors’](/moost/interceptors) "onError" hooks allow transforming or logging the error, and possibly returning an alternate response. If an error arises in the error hooks, Moost moves to Step 11.

11. **Raise Error**  
    If any previous step encounters an error, Moost halts the normal flow and produces an error response. The exact nature of the error response depends on the event type and any interceptors or error handlers that may have modified the error along the way.

12. **Process Final Response**  
    Wooks then formats the final response based on the event type (e.g., JSON response for HTTP, textual output for CLI). If this step fails, an error response is raised (Step 11). ([What is Wooks?](https://wooks.moost.org/wooks/what))

13. **Return Response to Event Origin**  
    Finally, the processed (or error) response is returned to the event’s origin, concluding the event lifecycle.

## Summary

Whether you’re validating input data, enforcing security policies, logging metrics, or formatting output, understanding and leveraging these lifecycle stages ensures that your Moost application remains maintainable, testable, and adaptable to evolving requirements.