# Request

Moost provides a variety of **resolver** decorators that allow you to extract and use different properties
from the request object within your request handlers.
These resolver decorators can be applied to class properties (only for [event-scoped](./controllers/#controller-scope) instances) and request handler arguments (for all the controllers).

Additionally, you can use the composable functions from Wooks inside request handlers.
For more details, refer to the [Wooks Request Composables](https://wooks.moost.org/webapp/composables/request.html) documentation.

::: info
To learn more about the foundation of **resolver** decorators please read the [Moost Resolvers Documentation](/moost/resolvers).
:::

## Content

[[toc]]

## Route Parameters

Route parameters are defined in the router using colons (`:`) or asterisks (`*`) and can be resolved using the `@Param` or `@Params` decorators.

::: tip
Moost utilizes Wooks under the hood, so you can find documentation on routing patterns at the [Wooks HTTP Routing Documentation](https://wooks.moost.org/webapp/routing.html) page.
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

## Header

The `@Header` decorator allows you to extract the value of a specific request header from the incoming request.

Example:
```ts
import { Get, Header } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(@Header('content-type') contentType: string) { // [!code focus]
    // Access the value of the 'content-type' header
  }
}
```

In this example, the `contentType` argument will contain the value of the `content-type` header from the incoming request.

## Url

The `@Url` decorator allows you to retrieve the requested URL from the incoming request.

Example:
```ts
import { Get, Url } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(@Url() url: string) { // [!code focus]
    // Access the requested URL
  }
}
```

The `url` argument will contain the requested URL, such as `/test`, in this example.

## Method

The `@Method` decorator allows you to retrieve the requested HTTP method from the incoming request.

Example:
```ts
import { Get, Method } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(@Method() method: string) { // [!code focus]
    // Access the requested HTTP method (e.g., 'GET', 'POST')
  }
}
```

The `method` argument will contain the requested HTTP method, such as `GET` or `POST`, in this example.

## Request

The `@Req` decorator allows you to retrieve the raw request instance (IncomingMessage) from the incoming request.

Example:
```ts
import { Get, Req } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(@Req() request: IncomingMessage) {  // [!code focus]
    // Access the raw request instance
  }
}
```
The `request` argument will contain the raw request instance, which gives you access to various properties and methods of the incoming request.

## Request Id (Event Id)

The `@ReqId` decorator allows you to retrieve the request's unique identifier (UUID) (generated by Wooks) from the incoming request.

Example:
```ts
import { Get, ReqId } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(@ReqId() reqId: string) {  // [!code focus]
    // Access the request's unique identifier
  }
}
```
The `reqId` argument will contain the unique identifier associated with the incoming request.

## IP address

The `@Ip` decorator allows you to retrieve the IP address of the client from the incoming request.

`@Ip({ trustProxy: true })` will take into consideration `x-forwarded-for` header.

Example:
```ts
import { Get, Ip } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(@Ip() ip: string) {     // [!code focus]
    // Access the client's IP address
  }
}
```

## IP List

The `@IpList` decorator allows you to retrieve a list of IP addresses from the incoming request.

Example:
```ts
import { Get, IpList } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(@IpList() ipList: string[]) {   // [!code focus]
    // Access the list of IP addresses
  }
}
```
The `ipList` argument will contain an array of IP addresses associated with the client who made the request.

## Body

The `@Body` decorator allows you to retrieve the parsed request body from the incoming request.

Example:
```ts
import { Get, Body } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(@Body() body: object | string | unknown) {   // [!code focus]
    // Access the parsed request body
  }
}
```
The `body` argument will contain the parsed request body, which can be an object, string, or an unknown data type, depending on the content of the request body.
To learn more about body parsing please refer to [Wooks Http Body Documentation](https://wooks.moost.org/webapp/body.html) page.

## Raw Body

The `@RawBody` decorator allows you to retrieve the raw request body buffer from the incoming request.

Example:
```ts
import { Get, RawBody } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(@RawBody() rawBody: Buffer) {   // [!code focus]
    // Access the raw request body buffer
  }
}
```

The `rawBody` argument will contain a raw request body buffer. You can use this buffer to process the raw body data as needed.