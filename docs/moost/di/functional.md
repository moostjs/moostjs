# Functional Instantiation

In Moost, the framework automatically handles the creation and injection of dependencies. However, there may be situations where you need to create an instance of a class or retrieve an instance at runtime during event handling. Moost provides a handy tool called `useControllerContext` to help you achieve this functionality.

By using the `useControllerContext` composable, you can access the `instantiate` function, which allows you to dynamically create instances of classes within the context of an event handler.

Here's an example of how to use `instantiate`:

```ts
import { defineInterceptorFn, useControllerContext } from 'moost';
import { DepClass } from './path-to-dependencies'

const myInterceptor = defineInterceptorFn(async (onBefore, onAfter, onError) => {
  const { instantiate } = useControllerContext();
  
  // Create an instance of a dependency class
  const depInstance = await instantiate(DepClass);

  // Interceptor logic...
});
```

In the example above, we define a functional interceptor using the `defineInterceptorFn` factory. Within the interceptor, we use the `useControllerContext` tool to access the `instantiate` function. We then use `instantiate` to dynamically create an instance of the `DepClass` within the interceptor.

Please note that this example assumes the existence of a dependency class called `DepClass`.
