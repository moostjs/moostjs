# Guard Example

In this example we will create an AuthGuard interceptor with pseudo-logic of checking client authorization.

::: info
In Moost, interceptors can be used as guards to perform authorization
checks before allowing the execution of event handlers.
Guards are a specific use case of interceptors and play a crucial role in ensuring the security and integrity of your application.
:::

## Content

[[toc]]


## Guard Interceptor

> Please note that all the examples provided in this documentation are for illustration purposes and may need to be adjusted based on the specific requirements and environment of your application. It is important to understand the concepts and principles demonstrated and adapt them to suit your needs. Consider the examples as a starting point and make the necessary modifications to align with your application's architecture, business logic, and security requirements. Always ensure that you thoroughly test and validate your implementation to guarantee its correctness and security in a production environment.

To create a guard interceptor, you can define a plain interceptor with a priority set to `GUARD`.
The GUARD priority indicates that the interceptor will be executed before the event handler and is specifically designed for authorization checks.

Here's an example of creating a guard interceptor:
```ts
import { HttpError } from '@wooksjs/event-http'
import { defineInterceptorFn, TInterceptorPriority } from 'moost'

const authGuard = defineInterceptorFn(() => {
    const authrozed = // evaluate privileges
    if (!authorized) {
        throw new HttpError(401);
    }
}, TInterceptorPriority.GUARD);     // [!code hl]
```
In the above example, `authGuard` is a guard interceptor that performs an authorization check.
If the authorization check fails (i.e., the request is not authorized),
it throws an `HttpError` with the status code `401` to indicate an unauthorized access.

## Applying Guard Interceptors
Once you have defined a guard interceptor, you can apply it in various ways within your application.

### 1. Apply to a Controller
You can apply a guard interceptor to a specific controller by using the `@Intercept` decorator on the controller class.
This will ensure that the guard interceptor is applied to all event handlers within that controller.

```ts
import { Intercept, Controller } from 'moost';

@Controller()
@Intercept(authGuard)
class MyController {
    // ...
}
```

### 2. Apply as Global Interceptor
To apply a guard interceptor globally, affecting all controllers and event handlers in your application,
you can use the `applyGlobalInterceptors` method of your Moost instance.
```ts
import { Get } from '@wooksjs/event-http';
import { Moost } from 'moost';

const app = new Moost();
app.applyGlobalInterceptors(authGuard);
```

### 3. Apply to a Specific Request Handler
If you want to apply a guard interceptor to a specific request handler within a controller, you can use the `@Intercept` decorator on the respective method.

```ts
import { Get } from '@wooksjs/event-http';
import { Intercept, Controller } from 'moost';

@Controller()
class MyController {
    @Intercept(authGuard)
    @Get('guarded')
    handleRequest() {
        // ...
    }
}
```

## Guard Decorator
This example demonstrates how to convert an interceptor function into a decorator function using the `Intercept` utility, and how to apply the decorator to a controller.

```ts
import { Intercept, defineInterceptorFn, Controller } from 'moost';

const authGuardInterceptor = defineInterceptorFn(() => {
    const authrozed = // evaluate privileges
    if (!authorized) {
        throw new HttpError(401)
    }
}, TInterceptorPriority.GUARD)

const AuthGuard = Intercept(authGuardInterceptor);

// Usage of AuthGuard decorator
@AuthGuard
@Controller()
class MyController {
    // ...
}
```
In this case, we apply the `AuthGuard` decorator to the `MyController` class, making it a guard for all event handlers within that controller.
The `AuthGuard` decorator intercepts the requests and executes the `authGuardInterceptor` logic before allowing the event handlers to proceed.

## Guard Decorator Factory

Alternatively, it is possible to create a custom `AuthGuard` decorator that accepts arguments such as a policy name.
This approach enables you to enforce authorization based on specific policies or other conditions within your application.
The `AuthGuard` decorator factory generates an interceptor factory responsible for performing the authorization check based on the specified policy.

```ts
import { Get } from '@wooksjs/event-http';
import { Intercept, defineInterceptorFn, Controller } from 'moost';

const authGuardInterceptor = (policy: string) => defineInterceptorFn(() => {
     // Evaluate privileges based on the policy
    const authorized = evaluatePrivilegesBasedOnPolicy(policy);
    
    if (!authorized) {
        // Policy not enabled for the client
        throw new HttpError(401);
    }
}, TInterceptorPriority.GUARD);

const AuthGuard = (policy: string) => Intercept(authGuardInterceptor(policy));

@Controller()
@AuthGuard('admin') // Apply AuthGuard decorator to the controller with 'admin' policy
class AdminController {
    @Get('endpoint')
    handler() {
        // Controller logic for handling the request
    }
}
```

By applying the `@AuthGuard('admin')` decorator to the `AdminController` class,
the controller's route is protected with the `admin` policy.
If the client does not have the `admin` policy enabled, an `HttpError` with a status code of `401` is thrown, indicating that the authorization check failed.

