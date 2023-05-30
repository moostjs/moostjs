# Provide-Inject

Moost comes with two special tools, the `@Provide` and `@Inject` decorators, to make it easy to share things (dependencies) and then use them where you need them in your app. 

## Overview
Provide-Inject in Moost allows you to:

- Share things for others to use with the `@Provide` decorator.
- Use specific things in your classes with the `@Inject` decorator.
- Create a global list of shared things for your main Moost app using the `setProvideRegistry` method.

## Provide with Class Type
To share a thing using its class type, use the `@Provide` decorator. You need to give it the class as the first thing and a callback function that returns what you want to share.

Here's an example of how to share things using class types:
```ts
import { Provide, Injectable } from 'moost';

class AnotherDependency {
  // Some Dependency Class stuff
}

@Injectable()
@Provide(AnotherDependency, () => new AnotherDependency())
class MyClass {
  constructor(private dependency: AnotherDependency) {}
  // Class stuff
}
```
In this example, we're sharing an instance of the `AnotherDependency` class using its class type. This instance can then be used in `MyClass` and any other classes that need `AnotherDependency`.

## Provide with String Keys
To share things using string keys, use the `@Provide` decorator with a string key as the first thing and a callback function that returns what you want to share. To use these shared things, use the `@Inject` decorator with the matching string key as the constructor parameter.

Here's how you can share and use things with string keys:
```ts
import { Provide, Inject, Injectable } from 'moost';

class MyDependency {
  constructor(private type: string) {}
  // Some Dependency Class stuff
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
In this example, we're sharing instances of the `MyDependency` class with string keys `'instance-a'` and `'instance-b'`. These instances can then be used in other classes with the matching string keys.

Remember, you need to use the `@Inject` decorator when you're using things shared with string keys. But if they're shared using class types, you don't need the decorator.

## Global Provide Registry
Moost lets you make a global sharing list for the main Moost app using the `setProvideRegistry` method. This list makes sure that certain things are always available to be used throughout the app.

Here's how to set up a global sharing list:
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
In this example, we're making a global sharing list with instances for `AnotherDependency`, `'instance-a'`, and `'instance-b'`. Now, these instances can be used in any class by using their symbolic names or class types.

By using the power of `@Provide` and `@Inject`, you can easily share and use specific things throughout your Moost app. Remember to use the `@Inject` decorator for things shared with string keys. But if they're shared using the class type, you don't need the decorator.