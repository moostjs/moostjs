# Handling Errors

Errors are an unavoidable part of any application. In this guide, we will cover how to handle errors in your Moost Http application effectively. 

Moost Http provides a built-in mechanism to handle exceptions that occur during the processing of HTTP requests. Let's explore how this works and how you can customize the behavior.

## Internal Errors

By default, any uncaught exception that occurs in a handler or interceptor is interpreted as an internal error (HTTP status code 500) by Moost Http. The processing workflow will catch the exception and send an error response to the client.

Here's an example of a handler that causes an internal error:

```ts
@Get('hello/:name')
hello(@Param('name') name: string) {
    throw new Error('Something went wrong!')
}
```

In this example, if the handler is triggered, Moost Http will catch the uncaught `Error` exception and send an HTTP 500 response to the client.

## HttpError Class

Moost Http provides a special `HttpError` class for handling HTTP errors. You can import it from `@moostjs/event-http` and use it to throw HTTP errors with a specific status code.

Here's an example of how to throw an HTTP 403 (Forbidden) error:

```ts
@Get('hello/:name')
hello(@Param('name') name: string) {
    throw new HttpError(403, 'Insufficient privileges.')
}
```

In this example, if the handler is triggered, Moost Http will catch the `HttpError` exception and send an HTTP 403 response with the message 'Insufficient privileges.' to the client.

## Customizing HttpError Responses

You can customize the response sent by `HttpError` by providing more details when throwing the error. The details provided will be sent back to the client as a JSON object or an HTML page, depending on the `Accept` header of the request.

Here's an example of how to throw an HTTP 403 error with more details:

```ts
@Get('hello/:name')
hello(@Param('name') name: string) {
    throw new HttpError(403, {
        message: 'Forbidden',
        statusCode: 403,
        error: 'Insufficient privileges.',
        anyProp: {
            extraDetail: 'This detail will be sent to the client.'
        }
    })
}
```

In this example, if the handler is triggered, Moost Http will catch the `HttpError` exception and send an HTTP 403 response with a JSON object containing the details provided to the client.

## Conclusion

Handling errors properly in your HTTP application is crucial for building reliable, robust applications. Moost Http provides a flexible and straightforward way to handle HTTP errors, allowing you to easily send informative error responses to your clients.