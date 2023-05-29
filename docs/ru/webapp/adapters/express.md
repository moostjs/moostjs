# Express in Moost

In this guide, we will explain how you can integrate an existing Express application with Moost. While Moost already comes with the capability to create a standalone HTTP server through the `@wooksjs/event-http` package, you may have an existing Express app you wish to use without rewriting the entire application. Thankfully, Moost provides a way to achieve this.

## Prerequisites

Before proceeding, ensure you have the following dependencies installed:

- `express`
- `moost`
- `@moostjs/event-http`
- `@wooksjs/express-adapter`

## Example

Here's an example of how to integrate Express with Moost:

```ts
import { MoostHttp, Get } from '@moostjs/event-http'
import { Moost, Param } from 'moost'
import { WooksExpress } from '@wooksjs/express-adapter'
import express from 'express'

class MyServer extends Moost {
    @Get('hello/:name')
    hello(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}

const expressApp = express()
const moostApp = new MyServer()
const httpAdapter = new MoostHttp(new WooksExpress(expressApp))
moostApp.adapter(httpAdapter)
moostApp.init()
httpAdapter.listen(3000, () => {
    moostApp.getLogger('my-app').info('Up on port 3000')
})
```

In this example, we start by importing the necessary packages and defining a Moost server with a single endpoint at `hello/:name`.

We then create an Express app and a Moost app instance. Next, we create an HTTP adapter for our Moost app, passing a new instance of `WooksExpress` initialized with our Express app to the `MoostHttp` constructor.

We add the adapter to the Moost app, initialize the Moost app, and then start listening on port 3000 with our Express app. All HTTP requests are now managed by Moost, with the underlying Express app handling the actual server.

## Conclusion

As you can see, Moost provides a simple way to integrate with Express. This allows you to leverage the power and flexibility of Moost while utilizing Express's familiar and robust HTTP server capabilities.

This integration makes it possible to transition gradually to a Moost architecture, or to keep using Express as your HTTP server while taking advantage of Moost's features for your application logic.
