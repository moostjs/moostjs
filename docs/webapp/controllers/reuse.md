# Controller Reusability

Moost framework offers a feature to overwrite a controller's prefix when importing it. This provides more flexibility in defining your app's routing structure and enables efficient code reuse.

## Changing a Controller's Prefix

When using the `@ImportController()` decorator to import a controller, you can set a new prefix for the controller. This new prefix replaces any prefix defined in the controller using the `@Controller()` decorator.

For instance:

```ts
@ImportController('new-prefix', ExampleController)
```

If `ExampleController` has a prefix defined by `@Controller('prefix')`, then `new-prefix` will replace the original prefix.

## Reusing Controllers with Varied Prefixes

You can use this feature to reuse a single controller class with different prefixes, distinguishing the controllers based on constructor parameters. This is useful when your controllers share a similar structure but handle different data.

Consider this example:

```ts
@ImportController('users', () => new DbCollection('users'))
@ImportController('roles', () => new DbCollection('roles'))
```

Here, we're reusing the `DbCollection` controller for two different prefixes, `users` and `roles`. We're also passing different arguments to the constructor each time to distinguish the two controller instances.

The `DbCollection` might look something like this:

```ts
import { Controller, Param } from 'moost'
import { Get, Put, Post, Delete, Body } from '@moostjs/event-http'

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

In this scenario, the `DbCollection` controller operates on a generic collection, and we create specific controller instances for users and roles. Each instance handles CRUD operations on its assigned collection, enhancing code reuse and providing a clear, flexible structure for our app.

> Note that these examples are illustrative and may need adjustments based on your application's specific requirements and environment. The aim is to understand the demonstrated concepts and principles and adapt them to your needs. Consider the examples as starting points and make necessary modifications to align with your app's architecture, business logic, and security requirements. Always ensure to thoroughly test and validate your implementation for correctness and security in a production environment.

## Potential Applications

The ability to change prefixes and reuse controllers with different constructor arguments offers flexibility. Here are some potential applications:

- **Modular Multi-Tenant Apps**: In a multi-tenant app, you could create a separate controller instance for each tenant, each with its own prefix. This keeps your controller logic clean and reusable while catering to different tenants.

- **Versioning**: You could maintain different versions of your API using this feature. By creating different controller instances with different prefixes (e.g., `v1`, `v2`, etc.), your versioning logic stays clean and organized.

- **Theming**: If your web app supports theming, you could create different controller instances for each theme. Each instance could use a different set of views or templates, reusing the same controller logic.