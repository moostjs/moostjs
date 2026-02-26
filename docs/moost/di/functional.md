# Functional Instantiation

Most dependencies are resolved via constructor injection. But sometimes you need to create an instance on demand at runtime — inside an interceptor, conditionally based on request data, or for a class that isn't part of the controller's constructor.

## useControllerContext().instantiate

The `useControllerContext()` composable provides an `instantiate` function that creates class instances through Moost's DI system, respecting scopes, provide registries, and replace registries:

```ts
import { defineInterceptorFn, useControllerContext } from 'moost'

const metricsInterceptor = defineInterceptorFn((before, after) => {
  const { instantiate } = useControllerContext()

  before(async () => {
    const metrics = await instantiate(MetricsCollector)
    metrics.startTimer()
  })

  after(async () => {
    const metrics = await instantiate(MetricsCollector)
    metrics.record()
  })
})
```

`instantiate(ClassName)` returns a `Promise<T>` — it resolves the class through the same DI container used for constructor injection, scoped to the current controller instance.

## What useControllerContext Returns

Beyond `instantiate`, the composable exposes the current controller's runtime context:

| Method | Returns |
|--------|---------|
| `instantiate(Class)` | DI-resolved instance of the given class |
| `getController()` | Current controller instance |
| `getMethod()` | Current handler method name |
| `getRoute()` | Current route string |
| `getControllerMeta()` | Class-level metadata |
| `getMethodMeta(name?)` | Method-level metadata |
| `getScope()` | Controller's injectable scope |
| `getParamsMeta()` | Handler parameter metadata |

## When to Use

- **Interceptors** that need a service not in the controller's constructor
- **Conditional creation** — instantiate a class only when a feature flag or request condition is met
- **Dynamic dispatch** — choose which class to instantiate based on runtime data

For most cases, constructor injection is simpler and more predictable. Use `instantiate` when static injection patterns don't fit.
