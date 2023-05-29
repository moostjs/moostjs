# Enhancing Metadata

In Moost, you have the flexibility to enhance metadata to align with the
specific requirements of your application. By utilizing the `getMoostMate`
function, which provides a Mate instance from the `@prostojs/mate` library, you
can work with custom types and extend the metadata capabilities.

## Example Usage

> Please note that the custom types and decorators used in this example are for
illustration purposes. You can adapt them according to your specific
requirements and the structure of your application.

Here's an example that demonstrates how to enhance metadata using custom types:

```ts
import { Get } from "@moostjs/event-http";
import { Controller, getMoostMate } from "moost";

// Define custom types for class, method, and parameter metadata
interface TMyClassMeta {
  foo: string;
}

interface TMyMethodMeta {
  bar: number;
}

interface TMyParamMeta {
  arr: string[];
}

// Retrieve the Mate instance to access the metadata layer
const mate = getMoostMate<TMyClassMeta, TMyMethodMeta, TMyParamMeta>();

// Create decorators for each metadata level
const Foo = (value: string) => mate.decorate("foo", value) as ClassDecorator;
const Bar = (value: number) => mate.decorate("bar", value) as MethodDecorator;
const Arr = (value: string) =>
  mate.decorate("arr", value, true) as ParameterDecorator;

@Controller()
@Foo("custom class metadata") // Assign 'foo' value for class metadata
class MyClass {
  @Get()
  @Bar("custom method metadata") // Assign 'bar' value for method metadata
  handler(
    @Arr("line 1") // Assign 'arr' value for parameter metadata (appends array with provided value)
    @Arr("line 2")
    @Arr("line 3")
    arg: string,
  ) {
    // Method implementation
  }
}
```

In the example above, we use the `getMoostMate` function to retrieve a Mate
instance with custom type parameters.

To enhance the metadata, we create decorators (`Foo`, `Bar`, and `Arr`) that use
the Mate instance's `decorate` function. These decorators assign specific values
to the corresponding metadata fields.

- `Foo` decorator assigns the `'foo'` value to the class metadata.
- `Bar` decorator assigns the `'bar'` value to the method metadata.
- `Arr` decorator appends the provided value to the `'arr'` parameter metadata.
  Since the value is an array, we set the third argument of the `decorate`
  function to `true`.

The resulting metadata will include the enhanced values:

Class metadata:

```js
{
  foo: "custom class metadata",
}
```

Method metadata:

```js
{
  bar: 'custom method metadata',
  params: [
    {
      type: String,
      arr: ['line 1', 'line 2', 'line 3']
    }
  ]
}
```

By leveraging the `getMoostMate` function and the associated decorators, you can
extend the metadata capabilities of your Moost application. This allows you to
add custom information, tailor the behavior of your application, and make use of
the enhanced metadata within interceptors, event handlers, or any other relevant
components.
