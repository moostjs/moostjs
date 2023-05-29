# Overview of Controllers

## What is a Controller in Moost?

In the Moost framework, a controller refers to a class that groups a collection of event handlers. Controllers are a central piece of Moost's infrastructure that helps in the organization of code into distinct, logical units. 

Controllers are especially useful when handling HTTP requests, as they define the operations that should be performed for specific endpoints. This includes operations such as retrieving, creating, updating, and deleting data. The use of controllers simplifies the development process and brings a structured approach to the codebase, making it more maintainable and readable.

## Advantages of Controllers

The use of controllers in your Moost application provides several key benefits:

1. **Code Organization:** Controllers help logically segregate your code, which leads to a cleaner, more manageable codebase. Each controller can focus on a single responsibility, aligning with the principles of good software design.

2. **Modularity:** Controllers promote the development of modular code. With this, parts of your code can be tested, updated, or debugged individually without affecting other parts of the application.

3. **Ease of Maintenance:** Controllers enhance maintainability. If a change is required in a specific operation, only the relevant controller needs to be updated. 

4. **Singleton Instance:** By default, each controller in Moost is an Injectable singleton. This means that only a single instance of the controller is created and reused across the application, which can be beneficial in terms of performance and resource utilization.

## The Role of Controllers in HTTP Requests

When handling HTTP requests, each controller corresponds to a specific route or a group of routes. For every incoming HTTP request, the appropriate controller is invoked based on the request's URL and HTTP method.

Each controller class defines methods that correspond to different HTTP methods (like GET, POST, PUT, DELETE, etc.) These methods define the logic to handle requests to specific endpoints.

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

In the above example, `ApiController` is a controller with a prefix `api`. The `hello` method within this controller is tied to the HTTP GET request at the endpoint `/api/hello/:name`.

## Wrapping Up

To sum up, controllers in Moost framework offer a highly structured and organized way of managing your application's event handlers. This leads to cleaner, more maintainable code, enhancing your productivity as a developer. While this is a basic overview, the full capabilities of controllers in the Moost framework span much wider, offering you flexibility and control in defining your application's logic.

Stay tuned for the next sections where we delve into more specific aspects of working with controllers in Moost, including ways to define and import controllers.