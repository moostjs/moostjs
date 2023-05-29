# Common Fields

Moost provides a set of general-purpose metadata fields that can be utilized by various parts of your application.
These fields serve as a flexible way to store and access common information across different components.

| Field         | Decorator         | Description                                                                              |
|---------------|-------------------|------------------------------------------------------------------------------------------|
| `id`          | `@Id`             | Sets an ID for a class, method, parameter, or other relevant component.                  |
| `label`       | `@Label`          | Sets a descriptive label for a class, method, parameter, or other components.            |
| `value`       | `@Value`          | Sets a default value that can be utilized in various scenarios.                          |
| `description` | `@Description`    | Provides a detailed description for a class, method, or other components.                |
| `optional`    | `@Optional`       | Indicates whether a field is optional.                                                   |
| `required`    | `@Required`       | Specifies that a field is mandatory.                                                     |

When implementing your custom logic with interceptors or adapters, you may utilize these general-purpose fields as per your preference.

These decorators can be applied to classes, methods, parameters, or any other component where you want to store and access the corresponding common field value.

Feel free to customize and use these fields to enhance your Moost application according to your specific needs.
