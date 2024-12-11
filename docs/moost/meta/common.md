# General-Purpose Metadata

Moost provides a set of **general-purpose metadata fields** designed to be reusable across various functionalities within your application. These shared metadata fields help avoid redundancy by offering common attributes that different modules and components can leverage, ensuring consistency and reducing the need to define similar metadata in multiple places.

## Why General-Purpose Metadata?

When developing complex applications, it's common to encounter scenarios where multiple functionalities require similar metadata attributes. For example:

- **Labels and Descriptions:** Various modules like routing, validation, and documentation (e.g., Swagger) may need descriptive information about classes, methods, or parameters.
- **Validation Requirements:** Different parts of the application might need to specify whether certain fields are required or optional.

To streamline this process, Moost introduces general-purpose metadata fields that can be applied universally across different modules. This approach ensures that:

- **Consistency:** Shared metadata fields maintain uniformity across various functionalities.
- **Reusability:** Avoids the need to redefine similar metadata attributes in different modules.
- **Flexibility:** Allows multiple functionalities to utilize the same metadata for diverse purposes without conflict.

**Example Use Case:**

An automatic Swagger generator can utilize the `description` metadata field to populate endpoint descriptions in the Swagger UI, while the same `description` can be used by another module for logging or documentation purposes.

## Common Fields

Moost offers the following general-purpose metadata fields, each associated with a specific decorator:

| **Field**      | **Decorator**      | **Description**                                                                          |
|----------------|--------------------|------------------------------------------------------------------------------------------|
| `id`           | `@Id`              | Assigns a unique identifier to a class, method, parameter, or other relevant component.   |
| `label`        | `@Label`           | Provides a descriptive label for a class, method, parameter, or other components.        |
| `value`        | `@Value`           | Sets a default value that can be utilized in various scenarios.                          |
| `description`  | `@Description`     | Offers a detailed description for a class, method, or other components.                  |
| `optional`     | `@Optional`        | Indicates whether a field is optional.                                                   |
| `required`     | `@Required`        | Specifies that a field is mandatory.                                                     |

## How to Use General-Purpose Metadata

These decorators can be applied to **classes**, **methods**, **parameters**, or **properties** to attach the corresponding metadata. This metadata can then be accessed and utilized by different modules or functionalities within Moost.

### Example: Annotating a Controller

```ts
import { Controller, Get, Id, Label, Description, Param, Required } from 'moost';

@Controller('api/users')
@Id('UserController')
@Label('User Management Controller')
@Description('Handles all user-related operations')
export class UserController {
  
  @Get(':id')
  @Id('GetUserById')
  @Description('Retrieves a user by their unique ID')
  getUser(
    @Param('id') 
    @Required() 
    userId: string
  ) {
    // Handler logic
    return `User ID: ${userId}`;
  }
}
```

**Explanation:**

- **Class Decorators:**
  - `@Id('UserController')`: Assigns a unique ID to the `UserController` class.
  - `@Label('User Management Controller')`: Provides a descriptive label.
  - `@Description('Handles all user-related operations')`: Adds a detailed description.

- **Method Decorators:**
  - `@Get(':id')`: Defines an HTTP GET route.
  - `@Id('GetUserById')`: Assigns a unique ID to the `getUser` method.
  - `@Description('Retrieves a user by their unique ID')`: Describes the method's functionality.

- **Parameter Decorators:**
  - `@Param('id')`: Binds the `id` route parameter to the `userId` argument.
  - `@Required()`: Marks the `userId` parameter as mandatory.

This setup allows different modules, such as routing and documentation generators, to access and utilize the same metadata (`description`, `label`, etc.) without duplicating definitions.

## Benefits of Using General-Purpose Metadata

- **Avoid Redundancy:** Define common attributes once and reuse them across multiple modules and components.
- **Enhance Consistency:** Maintain uniform metadata standards throughout your application, simplifying maintenance and onboarding.
- **Improve Flexibility:** Allow different functionalities to interpret and use the same metadata according to their specific needs.
- **Facilitate Integration:** Enable seamless integration with external tools (e.g., Swagger for API documentation) by providing standardized metadata.

## Further Reading

To explore more about how to effectively use and extend metadata in Moost, refer to the following documentation pages:

- [Customizing Metadata](/moost/meta/custom)
- [Metadata Inheritance](/moost/meta/inherit)

These guides provide in-depth instructions on creating custom metadata, applying it to your components, and leveraging inheritance to promote reusability and consistency.
