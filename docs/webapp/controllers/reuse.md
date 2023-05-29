# Reuse of Controllers

The Moost framework provides a powerful feature that allows you to overwrite the prefix of a controller when importing it. This offers you additional flexibility in defining your application's routing structure, and it opens up possibilities for more efficient code reuse.

## Overwriting a Controller's Prefix

When importing a controller using the `@ImportController()` decorator, you can specify a new prefix for the controller. This new prefix will overwrite any prefix defined in the controller itself with the `@Controller()` decorator.

Here's an example of how you can use this feature:

```ts
@ImportController('new-prefix', ExampleController)
```

In this case, if `ExampleController` had a prefix defined by `@Controller('prefix')`, the `new-prefix` will be used instead, effectively overwriting the original prefix.

## Reusing Controllers with Different Prefixes

One powerful application of this feature is that it allows you to reuse the same controller class with different prefixes, differentiating the controllers based on constructor arguments. This is particularly useful when you have controllers that share similar structure but operate on different data.

Take a look at the following example:

```ts
@ImportController('users', () => new DbCollection('users'))
@ImportController('roles', () => new DbCollection('roles'))
```

In this case, we're reusing the `DbCollection` controller for two different prefixes, `users` and `roles`. We're also passing a different argument to the constructor each time to differentiate the two instances of the controller.

Here's what `DbCollection` might look like:

```ts
import { Controller } from 'moost'
import { Get, Put, Post, Delete } from '@moostjs/event-http'

interface TCollectionsSchema {
    users: TUserCollectionSchema,
    roles: TRolesCollectionSchema,
    // ...
}

@Controller()
export class DbCollection<T extends keyof TCollectionsSchema> {
    constructor(private collection: T) {
        // 
    }

    @Get(':id')
    read(@Param('id') id: string) {
        return this.dbQuery('SELECT', this.collection, id);
    }

    @Delete(':id')
    del(@Param('id') id: string) {
        return this.dbQuery('DELETE', this.collection, id);
    }

    @Post('')
    create(@Body() data: TCollectionsSchema[T]) {
        return this.dbQuery('CREATE', this.collection, data);
    }

    @Put('')
    update(@Body() data: TCollectionsSchema[T]) {
        return this.dbQuery('UPDATE', this.collection, data);
    }
}
```

In this example, the `DbCollection` controller is designed to operate on a generic collection, and we create specific instances of the controller for users and roles. Each instance is responsible for performing CRUD operations on its assigned collection, hence drastically increasing code reuse and providing a clear, flexible structure for our application.

> Please note that all the examples provided in this documentation are for illustration purposes and may need to be adjusted based on the specific requirements and environment of your application. It is important to understand the concepts and principles demonstrated and adapt them to suit your needs. Consider the examples as a starting point and make the necessary modifications to align with your application's architecture, business logic, and security requirements. Always ensure that you thoroughly test and validate your implementation to guarantee its correctness and security in a production environment.

## Use Cases and Ideas

The ability to overwrite prefixes and reuse controllers with different constructor arguments offers a high degree of flexibility. Here are some potential use cases and ideas:

- **Modular Multi-Tenant Applications**: In a multi-tenant application, you could have a separate controller instance for each tenant, each with its own prefix. This would allow you to keep your controller logic clean and reusable while catering to different tenants.

- **Versioning**: You could use this feature to maintain different versions of your API. By creating different instances of your controllers with different prefixes (e.g., `v1`, `v2`, etc.), you can keep your versioning logic clean and organized.

- **Theming**: If you have a web application that supports theming, you could create different instances of your controllers for each theme. Each instance could use a different set of views or templates, all while reusing the same controller logic.
