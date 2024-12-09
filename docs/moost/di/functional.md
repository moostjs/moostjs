# Functional Instantiation

While Moost’s dependency injection system typically handles object creation automatically, there are scenarios where you might need to explicitly instantiate classes at runtime — such as within interceptors, lifecycle hooks, or certain event handlers. To meet these needs, Moost provides a composable called `useControllerContext()` that gives you access to the `instantiate` function, enabling on-demand class instantiation within the current controller’s context.

## When to Use Functional Instantiation

- **Functional Interceptors:**  
  You may need a dependency instance that isn’t normally part of the controller’s constructor but is required for certain logic during request handling (e.g., a specialized logging or metrics class). [What is functional interceptor?](/moost/interceptors#functional-interceptors)
  
- **Conditional Logic:**  
  If you only need a certain class instance in particular conditions (e.g., when a feature flag is active, or a certain request parameter is present), `instantiate` allows you to defer and conditionally create these instances at runtime.
  
- **Testing and Mocking:**  
  Functional instantiation can simplify testing by allowing you to create instances of dependencies dynamically, rather than relying on injection at construction time. This can help when you need more granular control over instance lifecycles in your tests.

## Accessing the `instantiate` Function

`instantiate` is available through the `useControllerContext()` composable. This composable ties into the event’s async context, making it available wherever the event context exists (e.g., inside interceptors defined via `defineInterceptorFn`).

**Example:**
```ts
import { defineInterceptorFn, useControllerContext } from 'moost';
import { DepClass } from './dependencies';

const myInterceptor = defineInterceptorFn(async (onBefore, onAfter, onError) => {
  const { instantiate } = useControllerContext();
  
  // Dynamically create an instance of DepClass
  const depInstance = await instantiate(DepClass);

  // ... Use depInstance for custom logic, logging, or other tasks
});
```

In this example:
- `useControllerContext()` provides the current controller’s DI context.
- Calling `instantiate(DepClass)` triggers Moost’s DI system to resolve and create a new `DepClass` instance.
- `depInstance` is now available for use within the interceptor’s logic.

## How It Works Under the Hood

`instantiate` integrates directly with Moost’s DI system (`@prostojs/infact`) and metadata reading (`@prostojs/mate`) to:
1. Identify the active controller instance and its scope.
2. Use the global or configured DI registries to resolve `DepClass`’s dependencies.
3. Create a properly injected instance of `DepClass`.

This ensures that even dynamically instantiated classes respect the same DI rules, scopes, and configurations as those created at the start of the request handling cycle.

## Best Practices

- **Use Sparingly:**  
  While powerful, functional instantiation is an advanced feature. Most dependencies should be resolved via constructor injection or global provides. Reserve `instantiate` for cases where static injection patterns don’t fit.

- **Maintain Clarity:**  
  Keep in mind that dynamically creating dependencies at runtime can reduce predictability. Document why and where you use `instantiate`, so future maintainers understand the reasoning.

- **Leverage Scopes and Registries:**  
  The same scopes (`SINGLETON`, `FOR_EVENT`) and registry replacements apply to dynamically instantiated classes. Ensure you understand these concepts to avoid unexpected behavior.

## Summary

Functional instantiation through `useControllerContext().instantiate()` expands Moost’s flexibility by allowing runtime-controlled object creation. Whether you need conditional dependencies, advanced interceptor logic, or dynamic testing setups, this feature empowers you to adapt DI to your application’s evolving needs while maintaining consistency with Moost’s DI ecosystem.
