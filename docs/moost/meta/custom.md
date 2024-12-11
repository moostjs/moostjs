# Customizing Metadata in Moost

This guide provides an overview of how to customize metadata in Moost, enabling advanced users to extend the framework’s capabilities to suit specific application needs.

## Extending Metadata

### 1. Define a Custom Metadata Interface

Start by defining an interface that represents your custom metadata attributes. This interface should include only the properties relevant to your specific functionality.

```ts
// custom-metadata.ts

export interface TCustomMeta {
  casePipeOption?: "lower" | "upper" | "camel" | "pascal";
  // Add more custom properties as needed
}
```

::: warning

**Ensure that all custom metadata property names are unique and descriptive** to prevent collisions with Moost’s native metadata or any third-party metadata extensions. For example, use `casePipeOption` instead of generic names like `option` to maintain clarity and avoid unintended behavior.

:::

## Accessing the Mate Instance

Moost provides the `getMoostMate` function to access the Mate instance, which manages metadata. This function accepts three generic type parameters corresponding to different levels of metadata: Class, Property, and Parameter.

### Function Signature

```ts
function getMoostMate<
  Class extends TObject = TEmpty,
  Prop extends TObject = TEmpty,
  Param extends TObject = TEmpty,
>(): Mate<
  TMoostMetadata & Class & { params: Array<Param & TMateParamMeta> },
  TMoostMetadata & Prop & { params: Array<Param & TMateParamMeta> }
>
```

### Explanation of Generic Types

- **Class (`Class`)**: Defines metadata attributes applicable at the class level.
- **Property (`Prop`)**: Defines metadata attributes applicable to properties.
- **Parameter (`Param`)**: Defines metadata attributes applicable to parameters.

By specifying these generics, you ensure type safety and IntelliSense support when working with custom metadata.

## Creating Custom Decorators

Custom decorators allow you to attach your defined metadata to various targets within your application. Utilize the `mate.decorate` method to define these decorators.

### Example: Case Transformation Decorators

```ts
// custom-decorators.ts

import { getMoostMate } from 'moost';
import type { TCustomMeta } from './custom-metadata';

// Retrieve the custom Mate instance
const mate = getMoostMate<TCustomMeta, TCustomMeta, TCustomMeta>();

/**
 * Decorator to set the case transformation option to uppercase
 */
export const Uppercase = () => mate.decorate('casePipeOption', 'upper');

/**
 * Decorator to set the case transformation option to camelCase
 */
export const Camelcase = () => mate.decorate('casePipeOption', 'camel');

// Add more decorators as needed
```

**Explanation:**

- **`Uppercase` Decorator:** Attaches the `casePipeOption` metadata with the value `'upper'` to the target.
- **`Camelcase` Decorator:** Attaches the `casePipeOption` metadata with the value `'camel'` to the target.

## Reading Custom Metadata

Accessing the attached metadata at runtime allows your application to make decisions based on the annotations. Use the `mate.read` method to retrieve metadata for classes, methods, properties, or parameters.

::: tip
In many cases you can call `useControllerContext` composable which provides a way to get metadata for current controller during event processing. But sometimes it's usefull to access mate instance directly (if you are not in event context). Such case is covered below.

You can read more about Controller Context composable [here](/moost/meta/controller).
:::

### Example: Reading Metadata from a Class

```ts
// read-metadata.ts

import { getMoostMate } from 'moost';
import { CustomController } from './controllers/custom.controller';
import type { TCustomMeta } from './custom-metadata';

// Retrieve the custom Mate instance
const mate = getMoostMate<TCustomMeta, TCustomMeta, TCustomMeta>();

// Read metadata from the CustomController class
const classMeta = mate.read(CustomController);
console.log(classMeta?.casePipeOption); // Output: undefined (if not set at class level)
```

### Example: Reading Metadata from a Method

```ts
// read-method-metadata.ts

import { getMoostMate } from 'moost';
import { CustomController } from './controllers/custom.controller';
import type { TCustomMeta } from './custom-metadata';

// Retrieve the custom Mate instance
const mate = getMoostMate<TCustomMeta, TCustomMeta, TCustomMeta>();

// Read metadata from the getUser method
const methodMeta = mate.read(CustomController, 'getUser');
console.log(methodMeta?.casePipeOption); // Output: undefined (if not set at method level)
```

### Example: Reading Metadata from a Method Parameter

When reading metadata for method parameters, Moost aggregates all parameter metadata into a `params` array within the method's metadata. Each entry in the `params` array corresponds to a parameter, indexed by their position.

```ts
// read-param-metadata.ts

import { getMoostMate } from 'moost';
import { CustomController } from './controllers/custom.controller';
import type { TCustomMeta } from './custom-metadata';

// Retrieve the custom Mate instance
const mate = getMoostMate<TCustomMeta, TCustomMeta, TCustomMeta>();

// Read metadata from the getUser method
const methodMeta = mate.read(CustomController.prototype, 'getUser');

// Access metadata for the first parameter (index 0)
const paramMeta = methodMeta?.params[0];
console.log(paramMeta?.casePipeOption); // Output: 'upper' or 'camel', based on decorator
```

**Note:** `'design:paramtypes'` metadata is already provided via `params` array by `@prostojs/mate`.

## Mate API Reference

The Mate instance provides several methods to interact with metadata. Below is an overview of the primary public methods:

### `decorate`

**Purpose:** Attach metadata to a target.

**Signature:**

```ts
decorate<
  T = TClass & TProp & TCommonMateWithParam<TProp['params'][0]>,
  K extends keyof T = keyof T
>(
  key: K | ((meta: T, level: TLevels, propKey?: string | symbol, index?: number) => T),
  value?: T[K],
  isArray?: boolean,
  level?: TLevels,
): MethodDecorator & ClassDecorator & ParameterDecorator & PropertyDecorator
```

**Parameters:**

- `key`: The metadata key or a callback function to modify existing metadata.
- `value`: The value to attach to the metadata key.
- `isArray`: (Optional) Indicates if the metadata value should be treated as an array.
- `level`: (Optional) The decorator level (`'CLASS'`, `'METHOD'`, `'PROP'`, `'PARAM'`).

**Usage Example:**

```ts
// Attaching a simple metadata key-value pair
mate.decorate('customOption', 'exampleValue');

// Using a callback to modify existing metadata
mate.decorate(meta => ({
  ...meta,
  customOption: 'modifiedValue',
}));
```

### `read`

**Purpose:** Retrieve metadata from a target.

**Signature:**

```ts
read<
  PK
>(
  target: TFunction | TObject,
  propKey?: PK,
): PK extends PropertyKey ? (TClass & TProp & TCommonMate<TProp['params'][0]> | undefined) : TClass | undefined
```

**Parameters:**

- `target`: The class, prototype, or object from which to read metadata.
- `propKey`: (Optional) The property key (method or property name) from which to read metadata.

**Usage Example:**

```ts
// Reading metadata from a class
const classMeta = mate.read(CustomController);

// Reading metadata from a method
const methodMeta = mate.read(CustomController.prototype, 'getUser');
```

### `apply`

**Purpose:** Apply multiple decorators to a target.

**Signature:**

```ts
apply(
  ...decorators: (MethodDecorator | ClassDecorator | ParameterDecorator | PropertyDecorator)[]
): (target: TObject, propKey: string | symbol, descriptor: TypedPropertyDescriptor<TAny> | number) => void
```

**Usage Example:**

```ts
mate.apply(Uppercase(), AnotherDecorator())(target, propKey, descriptor);
```

### `decorateConditional`

**Purpose:** Apply decorators conditionally based on the decorator level.

**Signature:**

```ts
decorateConditional(
  cb: (level: TLevels) => MethodDecorator | ClassDecorator | ParameterDecorator | PropertyDecorator | void | undefined
): MethodDecorator & ClassDecorator & ParameterDecorator & PropertyDecorator
```

**Usage Example:**

```ts
mate.decorateConditional(level => {
  if (level === 'METHOD') {
    return SomeMethodDecorator();
  }
});
```

## Best Practices

- **Use Unique Metadata Keys:**  
  Always use descriptive and unique names for your custom metadata properties to avoid conflicts with Moost’s native metadata or any third-party metadata extensions.

- **Leverage TypeScript’s Typing:**  
  Define your metadata interfaces with TypeScript to benefit from type safety and IntelliSense support.

- **Organize Custom Decorators:**  
  Group related decorators in dedicated files or modules to maintain a clean and organized codebase.

- **Document Custom Metadata:**  
  Clearly document the purpose and usage of your custom decorators to assist team members and facilitate future maintenance.

## Further Reading

For more detailed guides, explore the following documentation pages:
- [General-Purpose Metadata](/moost/meta/common)
- [Metadata Inheritance](/moost/meta/inherit)
