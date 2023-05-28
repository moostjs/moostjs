# Provide-Inject

Moost provides the `@Provide` and `@Inject` decorators to facilitate dependency
injection and instance provisioning within your application.
With these decorators, you can easily define dependencies and inject specific instances into classes.

## Overview
The Provide-Inject feature in Moost allows you to:

-   Provide instances for injection using the `@Provide` decorator.
-   Inject specific instances into classes using the `@Inject` decorator.
-   Define a global provide registry for the main Moost instance (app) using the `setProvideRegistry` method.

## Provide by Class Type
To provide an instance for injection using the class type, you can use the `@Provide` decorator
with the class as the first argument and a callback function that returns the instance to be injected.

Here's an example of providing instances using class types:
```ts
import { Provide, Injectable } from 'moost';

class AnotherDependency {
  // Some Dependency Class implementation
}

@Injectable()
@Provide(AnotherDependency, () => new AnotherDependency())
class MyClass {
  constructor(private dependency: AnotherDependency) {}
  // Class implementation
}
```
In the example above, we provide an instance of the `AnotherDependency` class using its class type.
This instance can be injected into `MyClass` and classes instantiated for `MyClass` that have a dependency on `AnotherDependency`.

## Provide by string key
To provide instances with string keys for injection, you can use the `@Provide` decorator
with a string key as the first argument and a callback function that returns the instance
to be injected.
To inject the instances, use the `@Inject` decorator with the corresponding string key as the constructor parameter.

Here's an example of providing and injecting instances with string keys:
```ts
import { Provide, Inject, Injectable } from 'moost';

class MyDependency {
  constructor(private type: string) {}
  // Some Dependency Class implementation
}

@Provide('instance-a', () => new MyDependency('A'))
@Provide('instance-b', () => new MyDependency('B'))
@Injectable()
class MyClass {
  constructor(
    @Inject('instance-a') private dependencyA: MyDependency,
    @Inject('instance-b') private dependencyB: MyDependency
  ) {
    // ...
  }
}
```
In the example above, we provide instances of the `MyDependency` class with string keys `'instance-a'` and `'instance-b'`.
These instances can be injected into other classes using the corresponding string keys.

Please note that the `@Inject` decorator is used when injecting instances with string keys,
while instances provided using class types do not require the decorator.

# Global Provide Registry
Moost also allows you to define a global provide registry for the main Moost instance (app) using the `setProvideRegistry` method.
This registry ensures that the specified instances are available for injection throughout the application.

Here's an example of setting up a global provide registry:
```ts
import { Moost, createProvideRegistry } from 'moost';
import { AnotherDependency, MyDependency } from './dependencies';

const app = new Moost();
app.setProvideRegistry(createProvideRegistry(
  [AnotherDependency, () => new AnotherDependency()],
  ['instance-a', () => new MyDependency('A')],
  ['instance-b', () => new MyDependency('B')]
));
```
In the above example, the global provide registry is created with the instances for `AnotherDependency`, `'instance-a'`, and `'instance-b'`.
These instances can now be injected into classes by using the corresponding symbolic names or class types.

By leveraging the power of `@Provide` and `@Inject`, you can easily manage dependencies and inject specific
instances throughout your Moost application.
Remember to use the `@Inject` decorator for instances provided with string keys,
while instances provided using the class type do not require the decorator.
