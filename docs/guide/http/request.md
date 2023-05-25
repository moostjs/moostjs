# Request Data

Moost HTTP provides various resolvers for extracting request properties, such as search parameters,
body, cookies, and more.
Additionally, you can use the composable functions from Wooks inside request handlers.
For more details, refer to the [Wooks Request Composables](https://wooksjs.org/guide/http/composables/request.html) documentation.

[[toc]]

## Route Parameters

Route parameters are defined in the router using colons (`:`) or asterisks (`*`) and can be resolved using the `@Param` or `@Params` decorators.

::: tip
Moost utilizes Wooks under the hood, so you can find documentation on routing patterns at the [Wooks HTTP Routing Documentation](https://wooksjs.org/guide/http/routing.html) page.
:::

### Named Route Parameter

```ts
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller()
export class ExampleController {
    @Get('hello/:name')     // [!code focus]
    hello(
        @Param('name') name: string // [!code focus]
    ) {
        return `Hello, ${name}!`
    }
}
```

In the example above, the `name` parameter is defined in the route, and it is resolved to the `name` argument
of the request handler using the `@Param('name')` decorator.

### Multiple Route Parameters

```ts
import { Get } from '@moostjs/event-http'
import { Controller, Param, Params } from 'moost'

@Controller()
export class ExampleController {
    @Get('endpoint/:param1/:param2/:param3')     // [!code focus]
    hello(
        @Param('param1') param1: string, // [!code focus]
        @Param('param2') param2: string, // [!code focus]
        @Params() allParams: { param1: string, param2: string, param3: string}, // [!code focus]
    ) {
        return allParams
    }
}
```
In this example, the route defines three parameters. The `@Param('paramN')` decorator resolves the parameter values by name.
The `@Params` decorator resolves all the parameters as an object, where the property names correspond to the parameter names.
This can be useful when you want to retrieve all the parameters at once as an object.

### Wildcard Route Parameters

```ts
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller()
export class ExampleController {
    @Get('endpoint/*')     // [!code focus]
    hello(
        @Param('*') param: string, // [!code focus]
    ) {
        return param
    }
}
```
In the example above, the route is defined with a wildcard (`*`). The `@Param('*')` decorator resolves the wildcard value to the `param` argument of the request handler.

## Search (Query) Parameters

In addition to route parameters, you can resolve search (query) parameters,
which follow the question mark `?` in the URL and have the format `?name=John&age=25`.

```ts
import { Get } from '@moostjs/event-http';
import { Controller, Query } from 'moost';

@Controller()
export class ExampleController {
    @Get('hello')
    hello(
        @Query('name') name: string,    // [!code focus]
        @Query('age') age: string,      // [!code focus]
        @Query() queryParams: Record<string, string>,   // [!code focus]
    ) {
        return {
            name,
            age,
            queryParams,
        };
    }
}

```
When you send a request with the name and age parameters, as well as additional query parameters, you will receive a response with their values:

```bash
curl "http://localhost:3000/hello?name=John&age=25&city=New%20York"
# {
#   "name": "John",
#   "age": "25",
#   "queryParams": {
#     "name": "John",
#     "age": "25",
#     "city": "New York"
#   }
# }
```

The `@Query('param')` decorator resolves the value of the corresponding query
parameter and assigns it to the specified argument in the request handler.
When used without any arguments, the `@Query()` decorator resolves all the search
parameters into an object, just like the `@Params()` decorator for route parameters.
The `queryParams` argument in the example above contains all the query parameters as key-value pairs.

