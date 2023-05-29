# Functional Instantiation

In Moost, the framework takes care of the instantiation and injection of dependencies.
However, there may be scenarios where you need to instantiate a class or retrieve an instance at runtime during event handling.
Moost provides a convenient composable called `useControllerContext` to facilitate this functionality.

By utilizing the `useControllerContext` composable, you can access the `instantiate` function, which allows you to dynamically
create instances of classes within the context of an event handler.

Here's an example of how to use `instantiate`:

```ts
import { defineInterceptorFn, useControllerContext } from 'moost';
import { DepClass } from './path-to-dependencies'

const myInterceptor = defineInterceptorFn(async (onBefore, onAfter, onError) => {
  const { instantiate } = useControllerContext();
  
  // Instantiate a dependency class
  const depInstance = await instantiate(DepClass);

  // Interceptor logic...
});
```

In the example above, we create a functional interceptor using the `defineInterceptorFn` factory.
Within the interceptor, we use the `useControllerContext` composable to access the `instantiate` function.
We then utilize `instantiate` to dynamically create an instance of the `DepClass` within the interceptor.

Please note that this example assumes the existence of a dependency class called `DepClass`.
