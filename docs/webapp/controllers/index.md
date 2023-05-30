# Overview of Controllers

## What is a Controller?

In Moost, a controller is a class that bundles related event handlers. It's a vital part of Moost, helping to organize code into clear, logical groups. 

Controllers shine when managing HTTP requests, as they map out operations for particular endpoints, such as fetching, adding, updating, or removing data. Controllers streamline coding and enforce a structured approach, making the code easy to maintain and read.

## Controller Benefits

Using controllers in Moost offers key advantages:

1. **Orderly Code:** Controllers help segregate your code, leading to a tidier, easily manageable codebase. Each controller can focus on a single task, in line with good software design principles.

2. **Modularity:** Controllers encourage modular coding. You can test, update, or debug parts of your code individually without impacting the rest of the app.

3. **Easy Maintenance:** Controllers improve maintainability. When changes are needed, only the related controller needs an update.

4. **Singleton Instance:** By default, Moost makes each controller a reusable Injectable singleton. This can optimize performance and resource use.

## Controller Role in HTTP Requests

Each controller links to a specific route or group of routes for HTTP requests. For any incoming HTTP request, the right controller is called based on the request's URL and HTTP method.

Each controller class includes methods corresponding to different HTTP methods (like GET, POST, PUT, DELETE, etc.) These methods lay out the logic for handling requests at specific endpoints.

::: code-group
```ts [api.controller.ts]
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller('api')  // [!code hl]
export class ApiController {
    @Get('hello/:name')
    hello(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
```
:::

In this example, `ApiController` is a controller with the prefix `api`. The `hello` method in this controller responds to the HTTP GET request at the endpoint `/api/hello/:name`.

## Summary

To wrap up, Moost controllers offer a structured and organized way of managing your application's event handlers. This leads to cleaner, more maintainable code, improving your productivity as a developer. This brief overview skims the surface; controllers in Moost offer more, providing flexibility and control in crafting your application's logic.
