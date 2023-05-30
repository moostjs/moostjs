# Routing

Routing in Moost HTTP is an integral part of handling event contexts.
It helps direct requests to the appropriate handlers. The routing can be either static or parametric,
and is powered by Wooks's routing system.
Routes, which are essentially instructions for handling specific types of requests, can be defined using `@Get`, `@Post`, or other request handler decorators.

## Parametric Routes

A parametric route includes parameters, signified by a colon (`:`).
These parameters are dynamic parts of the route, allowing us to handle a range of different request URLs.
The colon is followed by the parameter name, which you can use to reference the actual value in the URL. 

If you need to use a colon in the path without defining a parameter, it can be escaped with a backslash.
Parameters can also be separated using a hyphen. Regular expressions are another powerful tool you can use to restrict or format the shape of your parameters.

Here's how you might set up various parametric routes in Moost:

```ts
@Controller('api')
export class ParametricRouteController {
    // A single parameter named 'key'.
    @Get('vars/:key')
    getKey(@Param('key') key: string) {
        /* handler logic */
    }

    // Two parameters named 'key1' and 'key2', separated by a hyphen.
    @Get('vars/:key1-:key2')
    getKeys(
        @Param('key1') key1: string,
        @Param('key2') key2: string,
    ) {
        /* handler logic */
    }

    // Two parameters with specific numeric format.
    @Get('time/:hours(\\d{2})h:minutes(\\d{2})m')
    getTime(
        @Param('hours') hours: string,
        @Param('minutes') minutes: string,
    ) {
        /* handler logic */
    }

    // Two parameters separated by a slash.
    @Get('user/:name1/:name2')
    getUser(
        @Param('name1') name1: string,
        @Param('name2') name2: string,
    ) {
        /* handler logic */
    }

    // Three parameters with the same name. This creates an array as the parameter value.
    @Get('array/:name/:name/:name')
    getArray(@Param('name') name: string[]) {
        /* handler logic */
    }
}
```

## Wildcards in Routes

Wildcards, denoted by an asterisk (`*`), represent zero or more characters in a path segment. They can be placed at the beginning, middle, or end of a path. You can also use multiple wildcards in one route, combine them with parameters, or apply regular expressions to them.

In Moost, you can access wildcard values by using the `@Param('*')` decorator.

```ts
@Controller('static')
export class WildcardRouteController {
    // Matches all paths starting with `/static/`
    @Get('*')
    handleAll(@Param('*') path: string) {
        /* handler logic */
    }

    // Matches all paths that start with `/static/` and end with `.js`
    @Get('*.js')
    handleJS(@Param('*') path: string) {
        /* handler logic */
    }

    // Matches all paths that start with `/static/` and have `/test/` in the middle
    @Get('*/test/*')
    handleTest(@Param('*') paths: string[]) {
        /* handler logic */
    }

    // Matches all paths that start with `/static/` followed by numbers
    @Get('*(\\d+)')
    handleNumbers(@Param('*') path: string) {
        /* handler logic */
    }
}
```

## Accessing Multiple URI Parameters

When you have a route

 with multiple parameters, you can access all of them as an object using the `@Params()` decorator. This can be especially useful when you have multiple parameters in your route and want to access them in an organized manner.

```ts
@Controller('api')
export class MultiParamController {
    @Get('asset/:type/:type/:id')
    getAsset(@Params() params: {type: string[], id: string}) {
        /* handler logic */
    }
}
```

## Query Parameters

Query parameters, also known as URL Search Parameters, aren't part of the URI path processed by the router. To access query parameters in Moost, you can use the `@Query` decorator. For more information, refer to the section on [Query Parameters](/webapp/request#search-query-parameters).