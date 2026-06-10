# Controller Metadata

The **Controller Metadata** is available through the `useControllerContext` composable and provides developers with a powerful and convenient way to access and interact with metadata related to the current controller and its methods during event processing. This composable is essential for advanced use cases such as implementing custom interceptors, performing dynamic logic based on metadata, and enhancing the flexibility of your application’s event handling mechanisms.

[[toc]]

## Purpose

The `useControllerContext` composable serves to:

- **Access Controller Metadata:** Retrieve metadata associated with the current controller class.
- **Access Method Metadata:** Obtain metadata for the specific method handling an event.
- **Access Property Metadata:** Fetch metadata for individual properties within the controller.
- **Understand Parameter Metadata:** Gain insights into the metadata of method parameters.
- **Determine Execution Context:** Identify the current method’s name and the controller’s scope.

## Quick Start

Call the composable inside a handler or interceptor and destructure the helpers you need:

```ts
import { Controller, useControllerContext } from 'moost'
import { Get } from '@moostjs/event-http'

@Controller('api')
export class ApiController {
  @Get('info')
  info() {
    const { getMethod, getRoute, getControllerMeta } = useControllerContext()
    return {
      method: getMethod(), // 'info'
      route: getRoute(), // '/api/info'
      label: getControllerMeta()?.label,
    }
  }
}
```

The snippets below assume the helpers were destructured from a `useControllerContext()` call like this one. The composable also accepts an optional `EventContext` argument — `useControllerContext(ctx)` — to read another event's context instead of the current one.

## Available Methods

The `useControllerContext` composable provides several methods to access different aspects of controller metadata:

### `getController<T>(): T`

**Description:**
Returns the current controller instance — the most basic accessor, used internally by `getControllerMeta`, `getMethodMeta`, and `instantiate`.

**Parameters:**
None

**Returns:**
The controller instance handling the current event.

**Usage Example:**

```ts
const { getController } = useControllerContext<ApiController>()
const controller = getController()
```

### `getPrefix(): string | undefined`

**Description:**
Returns the controller's fully computed prefix — the accumulated path from all parent controllers and `@ImportController` overrides. Available in the constructor of singleton controllers and inside event handlers.

**Parameters:**
None

**Returns:**
The computed prefix string (e.g., `'/api/v2'`) or `undefined` if not set.

**Usage Example:**

```ts
const { getPrefix } = useControllerContext()
console.log(getPrefix()) // e.g., '/api/v2'
```

::: tip
For singleton controllers imported at multiple prefixes, `getPrefix()` in the constructor reflects the prefix from the first registration only. Inside event handlers, it always reflects the correct prefix for the current route.
:::

### `getRoute(): string | undefined`

**Description:**
Returns the full route path for the current handler, including the controller prefix and the handler's own path segment.

**Parameters:**
None

**Returns:**
The full route string (e.g., `'/api/v2/users'`) or `undefined` if not set.

**Usage Example:**

```ts
const { getRoute } = useControllerContext()
console.log(getRoute()) // e.g., '/api/v2/users'
```

### `getPropMeta(propName: string): TMoostMetadata | undefined`

**Description:**  
Retrieves the metadata associated with a specific property of the current controller.

**Parameters:**

- `propName`: The name of the property whose metadata you want to access.

**Returns:**  
The metadata object for the specified property or `undefined` if not found.

**Usage Example:**

```ts
const propMeta = getPropMeta('username');
console.log(propMeta?.description); // Outputs the description metadata of the 'username' property
```

### `getControllerMeta<TT extends object>(): TMoostMetadata | undefined`

**Description:**  
Fetches the metadata of the current controller class. Accepts an optional generic `TT` to type custom metadata extensions.

**Parameters:**  
None

**Returns:**  
The metadata object of the controller or `undefined` if not found.

**Usage Example:**

```ts
const controllerMeta = getControllerMeta();
console.log(controllerMeta?.label); // Outputs the label metadata of the controller
```

### `getMethodMeta<TT extends object>(name?: string): TMoostMetadata | undefined`

**Description:**  
Obtains the metadata of the current event handler method. Pass an optional `name` to read metadata of a different method; accepts an optional generic `TT` to type custom metadata extensions.

**Parameters:**

- `name` (optional): The name of the method whose metadata you want to read. Defaults to the current handler method.

**Returns:**  
The metadata object of the method or `undefined` if not found.

**Usage Example:**

```ts
const methodMeta = getMethodMeta();
console.log(methodMeta?.id); // Outputs the ID metadata of the method
```

### `getParamsMeta(): (TMoostParamsMetadata & TMateParamMeta)[]`

**Description:**  
Retrieves an array of metadata objects for each parameter of the current event handler method.

**Parameters:**  
None

**Returns:**  
An array of parameter metadata objects. Always returns an array — it is empty when no method metadata is available.

**Usage Example:**

```ts
const paramsMeta = getParamsMeta();
paramsMeta.forEach((meta, index) => {
  console.log(`Parameter ${index} description: ${meta.description}`);
});
```

### `getMethod(): string | undefined`

**Description:**  
Gets the name of the current event handler method.

**Parameters:**  
None

**Returns:**  
The method name as a string or `undefined` if not found.

**Usage Example:**

```ts
const methodName = getMethod();
console.log(`Current method: ${methodName}`);
```

### `getScope(): true | 'SINGLETON' | 'FOR_EVENT'`

**Description:**  
Determines the scope of the current controller, indicating whether it is a singleton or scoped per event.

**Parameters:**  
None

**Returns:**  
The controller's injectable metadata value: `'FOR_EVENT'`, `'SINGLETON'`, or literal `true`. Defaults to `'SINGLETON'` when no injectable metadata exists.

::: warning
A plain `@Controller()` / `@Injectable()` class (without an explicit scope) stores `injectable = true`, so `getScope()` returns `true` — which also means singleton. Check `scope === 'FOR_EVENT'` rather than `scope === 'SINGLETON'`.
:::

**Usage Example:**

```ts
const scope = getScope();
const isEventScoped = scope === 'FOR_EVENT';
```

### `instantiate<T>(Class): Promise<T>`

**Description:**  
Creates an instance of the given class through Moost's DI container, scoped to the current controller instance (respecting scopes, provide, and replace registries).

**Parameters:**

- `Class`: The class constructor to instantiate.

**Returns:**  
A `Promise` resolving to the instantiated class.

**Usage Example:**

```ts
const { instantiate } = useControllerContext()
const metrics = await instantiate(MetricsCollector)
```

### `getPropertiesList(): (string | symbol)[]`

**Description:**  
Returns the list of decorated property keys collected on the current controller class.

**Parameters:**  
None

**Returns:**  
An array of property keys (`string` or `symbol`). Always returns an array — empty when none are present.

**Usage Example:**

```ts
const props = getPropertiesList();
console.log(props); // e.g., ['username', 'email']
```
