# General Response

In Moost, the output of a handler method is processed by the [Wooks HTTP responder](https://wooksjs.org/webapp/composables/response.html).
The responder interprets the output and handles it accordingly to generate the appropriate HTTP response.
The responder automatically converts JSON objects to a JSON response, strings to a string response,
and takes care of setting the proper `content-type` header and `content-length`.

[[toc]]

## Response Formats

Wooks HTTP responder supports various types that can be converted to an HTTP response.
These include `string`, `object`, `array`, `boolean`, `readable streams`, and fetch responses (`Response`).
Here are a few examples to illustrate how different types of responses can be generated using Moost:

### Text response
```ts
import { Get } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler() {
    return 'Hello, Moost!';     // [!code hl]
  }
}
```

In this example, when the `/test` endpoint is accessed, the response will be a string with the content `Hello, Moost!`.
The content-type header will be set to `text/plain`, and the `content-length` will be automatically calculated.

### JSON response
```ts
import { Get } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler() {
    return { message: 'Hello, Moost!', status: 'success' };     // [!code hl]
  }
}
```

In this example, when the `/test` endpoint is accessed, the response will be a JSON object:
```json
{
  "message": "Hello, Moost!",
  "status": "success"
}
```

The `content-type` header will be set to `application/json`, and the `content-length` will be automatically calculated.

## Response Setters for Handler

The handler level decorators can be applied to a method (handler) in order to set headers or cookies for the HTTP response.
These decorators provide a static approach, where the value is set at the time of decoration and remains constant for all requests handled by that method.

### SetCookie

The `SetCookie` decorator allows you to set a cookie for the HTTP response.
It takes the name of the cookie, the value, and optional attributes as arguments. Here's an example:

```ts
import { Get, SetCookie } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  @SetCookie('my-cookie', 'my-value', { maxAge: '10m' }) // [!code focus]
  testHandler() {
    // ...
  }
}
```
In the above example, the `my-cookie` cookie is set with a value of `my-value` and a maximum age of 10 minutes.
Refer to [Wooks Http Response Cookies](https://wooksjs.org/webapp/composables/response.html#set-cookies)
documentation page for more details about available cookies attributes.

### SetHeader
The `SetHeader` decorator allows you to set a header for the HTTP response.
It takes the name of the header, the value, and optional options as arguments. Here are a couple of examples:

```ts
import { Get, SetHeader } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  @SetHeader('content-type', 'text/plain', { status: 400 }) // [!code focus]
  @SetHeader('x-server', 'my-server')  // [!code focus]
  testHandler() {
    // ...
  }
}
```

In the above example, the `x-server` header is set with a value of `my-server` for each response.
The `content-type` header is set to `text/plain` only if the response status is 400.

### SetStatus

The `SetStatus` decorator allows you to set a status code for HTTP response.
It takes the status code. Example:
```ts
import { Get, SetStatus } from '@moostjs/event-http';
import { Controller } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  @SetStatus(202) // [!code focus]
  testHandler() {
    // ...
  }
}
```
In the above example, the status code is set with a value of `202` for each response.


## Response Hooks

The hooks are decorators that can be applied to handler arguments and allow you
to dynamically change the value of headers or cookies for the HTTP response.

It's very powerful when using with `FOR_EVENT` scope instances as class props.

### HeaderHook
The `HeaderHook` decorator is a hook for the response header.
It can be applied to handler arguments and returns a hook object with a value property.
Examples:

::: code-group
```ts [SINGLETON]
import { Get, HeaderHook } from '@moostjs/event-http';
import { Controller, THeaderHook } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(
    @HeaderHook('x-my-header') myHeader: THeaderHook  // [!code focus]
  ) {   
    myHeader.value = 'new value'            // [!code focus]
    // ...
  }
}
```
```ts [FOR_EVENT]
import { Get, HeaderHook } from '@moostjs/event-http';
import { Controller, Injectable } from 'moost';

@Injectable('FOR_EVENT')             // [!code focus]
@Controller()
export class ExampleController {
  
  @HeaderHook('x-my-header')         // [!code focus]
  myHeader = 'initial value'         // [!code focus]

  @Get('test')
  testHandler() {
    this.myHeader = 'new value'     // [!code focus]
    // ...
  }
}
```
:::

### CookieHook
The `CookieHook` decorator is a hook for the response cookie (Set-Cookie).
It can be applied to handler arguments and returns a hook object with a value property.
Examples:

::: code-group
```ts [SINGLETON]
import { Get, CookieHook } from '@moostjs/event-http';
import { Controller, TCookieHook } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(
    @CookieHook('my-cookie') myCookie: TCookieHook  // [!code focus]
  ) {   
    myCookie.value = 'new value'            // [!code focus]
    myCookie.attrs = { maxAge: '10m', httpOnly: true }  // [!code focus]
    // ...
  }
}
```
```ts [FOR_EVENT]
import { Get, CookieHook, CookieAttrsHook, TCookieAttributes } from '@moostjs/event-http';
import { Controller, Injectable } from 'moost';

@Injectable('FOR_EVENT')             // [!code focus]
@Controller()
export class ExampleController {
  
  @CookieHook('my-cookie')                                  // [!code focus]
  myCookie = 'initial value'    // initial cookie value     // [!code focus]

  @CookieAttrsHook('my-cookie')                                             // [!code focus]
  myCookieAttrs: TCookieAttributes = {    // [!code focus]
    // initial cookie attr values   // [!code focus]
    maxAge: '10m',        // [!code focus]
    httpOnly: true,       // [!code focus]
  }                       // [!code focus]

  @Get('test')
  testHandler() {
    this.myCookie = 'new value'      // update cookie value  // [!code focus]
    this.myCookieAttrs.maxAge = '1m' // update cookie attrs // [!code focus]
    // ...
  }
}
```
:::


### StatusHook
The `StatusHook` decorator is a hook for the response status.
It can be applied to handler arguments and returns a hook object with a value property.
Examples:

::: code-group
```ts [SINGLETON]
import { Get, StatusHook } from '@moostjs/event-http';
import { Controller, TStatusHook } from 'moost';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(
    @StatusHook() status: TStatusHook  // [!code focus]
  ) {   
    status.value = 202            // [!code focus]
    // ...
  }
}
```
```ts [FOR_EVENT]
import { Get, StatusHook } from '@moostjs/event-http';
import { Controller, Injectable } from 'moost';

@Injectable('FOR_EVENT')             // [!code focus]
@Controller()
export class ExampleController {
  
  @StatusHook()         // [!code focus]
  status = 200  // initial status value       // [!code focus]

  @Get('test')
  testHandler() {
    this.status = 400 // new status value    // [!code focus]
    // ...
  }
}
```
:::

## Raw Response

If you want to take full control of the response, you can use the `@Res` resolver decorator.
When you get a raw response instance, you take responsibility for the response yourself, and the framework will not process the output of the handler in this case.

Example:
```ts
import { Get, Res } from '@moostjs/event-http';
import { Controller, TStatusHook } from 'moost';
import { ServerResponse } from 'http';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(
    @Res() response: ServerResponse  // [!code focus]
  ) {   
    response.writeHead(200, {});    // [!code focus]
    response.end('ok');             // [!code focus]
  }
}
```

If you want to have a raw response instance but still let the framework process the output of the handler, you can use `{ passthrough: true }` as an argument.

Example:
```ts
import { Get, Res } from '@moostjs/event-http';
import { Controller, TStatusHook } from 'moost';
import { ServerResponse } from 'http';

@Controller()
export class ExampleController {
  @Get('test')
  testHandler(
    @Res({ passthrough: true })  // [!code focus]
    response: ServerResponse  // [!code focus]
  ) {
    // ... 
    return 'ok';             // [!code focus]
  }
}
```