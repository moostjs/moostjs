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

## Available Methods

The `useControllerContext` composable provides several methods to access different aspects of controller metadata:

### `getPropMeta(propName: string | symbol): TMoostMetadata | undefined`

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

### `getControllerMeta(): TMoostMetadata | undefined`

**Description:**  
Fetches the metadata of the current controller class.

**Parameters:**  
None

**Returns:**  
The metadata object of the controller or `undefined` if not found.

**Usage Example:**

```ts
const controllerMeta = getControllerMeta();
console.log(controllerMeta?.label); // Outputs the label metadata of the controller
```

### `getMethodMeta(): TMoostMetadata | undefined`

**Description:**  
Obtains the metadata of the current event handler method.

**Parameters:**  
None

**Returns:**  
The metadata object of the method or `undefined` if not found.

**Usage Example:**

```ts
const methodMeta = getMethodMeta();
console.log(methodMeta?.id); // Outputs the ID metadata of the method
```

### `getParamsMeta(): TMoostMetadata[] | undefined`

**Description:**  
Retrieves an array of metadata objects for each parameter of the current event handler method.

**Parameters:**  
None

**Returns:**  
An array of metadata objects for the parameters or `undefined` if not found.

**Usage Example:**

```ts
const paramsMeta = getParamsMeta();
paramsMeta?.forEach((meta, index) => {
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

### `getScope(): 'SINGLETON' | 'FOR_EVENT' | undefined`

**Description:**  
Determines the scope of the current controller, indicating whether it is a singleton or scoped per event.

**Parameters:**  
None

**Returns:**  
The scope of the controller (`'SINGLETON'` or `'FOR_EVENT'`) or `undefined` if not set.

**Usage Example:**

```ts
const scope = getScope();
console.log(`Controller scope: ${scope}`);
```
