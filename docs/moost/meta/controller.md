# Controller Metadata

In Moost, you can easily access controller metadata from interceptors or event
handlers using the `useControllerContext` composable. This composable provides
convenient methods for retrieving metadata related to the current controller,
properties of the controller, and the current event handler.

## Example Usage

Here's an example that demonstrates the usage of `useControllerContext`:

```ts
import { useControllerContext } from "moost";

// ...
{
  // Must be used inside an event handler or interceptor
  const {
    getPropMeta,
    getControllerMeta,
    getMethodMeta,
    getParamsMeta,
    getMethod,
    getScope,
  } = useControllerContext();

  getPropMeta("propName"); // metadata of a property
  getControllerMeta(); // metadata of the controller
  getMethodMeta(); // metadata of the current event handler
  getParamsMeta(); // metadata of event handler arguments
  getMethod(); // event handler method name
  getScope(); // controller scope
}
// ...
```

In the example above, `useControllerContext` is invoked to retrieve an object
containing several metadata-related methods. These methods allow you to access
specific metadata associated with the current controller, its properties, and
the current event handler.

- `getPropMeta('propName')`: This method extracts the metadata of a property
  with the specified name from the current controller.

- `getControllerMeta()`: This method retrieves the metadata of the controller
  that is being used to handle the current event.

- `getMethodMeta()`: This method extracts the metadata of the current event
  handler.

- `getParamsMeta()`: This method extracts the metadata of the current event
  handler arguments.

- `getMethod()`: This method extracts the name of the current event
  handler method.

- `getScope()`: This method extracts scope (SINGLETON or FOR_EVENT) of the current controller.

By using the `useControllerContext` composable and its associated methods, you
can easily access and utilize controller metadata within your interceptors or
event handlers. This enables you to leverage the metadata to make informed
decisions, perform custom logic, or enhance the functionality of your Moost
application.

Please note that the availability of controller metadata depends on the context
in which the `useControllerContext` composable is used. Ensure that you are
using it within an appropriate event handling context to access the desired
controller metadata.
