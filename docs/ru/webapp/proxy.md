# Proxy

Moost HTTP supports wooks composables. Therefore `@wooksjs/http-proxy` package can be utilized, which offers a convenient way to handle proxy requests.

## Installation

To use the proxy functionality in Moost HTTP, you need to install the `@wooksjs/http-proxy` package:

```bash
npm install @wooksjs/http-proxy
```

## Usage

Once the package is installed, you can import and use the `useProxy` composable function in your Moost HTTP application.

Example:

```ts
import { Controller, Get } from '@wooksjs/event-http';
import { useProxy } from '@wooksjs/http-proxy';

@Controller()
class MyController {
  @Get('/to-proxy')
  handleProxyRequest() {
    const proxy = useProxy();
    return proxy('https://target-website.com/target-path?query=123');
  }
}
```

In the example above, we define a Moost HTTP controller with a single event handler using the `@Get` decorator.
Inside the event handler, we use the `useProxy` function to create a proxy function.
The proxy function is then called with the target URL we want to proxy.
The function will make the proxy request and return the `fetch` response from the target server.

## Restrict Cookies/Headers to Pass

You can restrict the cookies and headers that are passed in the proxy request by specifying the `reqCookies` and `reqHeaders` options in the `useProxy` function.

Example:

```ts
import { Controller, Get } from '@wooksjs/event-http';
import { useProxy } from '@wooksjs/http-proxy';

@Controller()
class MyController {
  @Get('/to-proxy')
  handleProxyRequest() {
    const proxy = useProxy();
    return proxy('https://target-website.com/target-path?query=123', {
      reqHeaders: { block: ['referer'] }, // Block the referer header
      reqCookies: { block: '*' }, // Block all request cookies
    });
  }
}
```

In the example above, we use the `reqHeaders` option to block the referer header and the `reqCookies` option to block all request cookies from being passed in the proxy request.

## Change Response

The proxy function returned by `useProxy` behaves like a regular `fetch` call and returns a `fetch` response. You can modify the response or access its data before returning it from the event handler.

Example:

```ts
import { Controller, Get } from '@wooksjs/event-http';
import { useProxy } from '@wooksjs/http-proxy';

@Controller()
class MyController {
  @Get('/to-proxy')
  async handleProxyRequest() {
    const proxy = useProxy();
    const response = await proxy('https://mayapi.com/json-api');
    const data = { ...(await response.json()), newField: 'new value' };
    return data;
  }
}
```

In the example above, we make the proxy request using the `proxy` function and then modify the response by adding a new field before returning it from the event handler.

## Advanced Options

The `useProxy` function provides advanced options for customizing the proxy behavior.
You can specify options such as the request method, filtering request and response headers/cookies, overwriting data, and enabling debug mode.

Example:

```ts
import { useProxy } from '@wooksjs/http-proxy';
import { Get, Controller } from '@moostjs/event-http';
import { Param } from 'moost';

@Controller()
class MyController {
  @Get('*')
  async handleProxyRequest(@Param('*') path: string) {
    const proxy = useProxy();
    const fetchResponse = await proxy('https://www.google.com' + path, {
      method: 'GET', // Optional method, defaults to the original request method

      // Filtering options for request headers/cookies
      reqHeaders: { block: ['referer'] },
      reqCookies: { allow: ['cookie-to-pass-upstream'] },

      // Filtering options for response headers/cookies
      resHeaders: { overwrite: { 'x-proxied-by': 'moost-proxy' } },
      resCookies: { allow: ['cookie-to-pass-downstream'] },

      debug: true, // Enable debug mode to print proxy paths and headers/cookies
    });

    return fetchResponse;
  }
}
```

In the example above, advanced options such as the request method, filtering of headers/cookies, overwriting response headers, and enabling debug mode are demonstrated.
You can customize these options based on your specific requirements.

The `fetchResponse` returned by the proxy function can be directly returned from the event handler.
You can also modify the response or access its data before returning it.
