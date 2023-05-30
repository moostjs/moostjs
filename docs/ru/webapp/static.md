# Static Files

You can use the `serveFile` function from the `@wooksjs/http-static` package to serve static files.
This function returns a readable stream of the file content and takes care of preparing the necessary response headers, handling caching, and supporting range requests.

## Installation

To use the static file serving functionality, you need to install the `@wooksjs/http-static` package:

```bash
npm install @wooksjs/http-static
```

## Usage

Once installed, you can import the `serveFile` function and use it in your Moost HTTP application.

Example:

```ts
import { serveFile } from '@wooksjs/http-static';
import { Controller, Get } from '@moostjs/event-http';

@Controller()
class MyController {
  @Get('static/file.txt')
  serveStaticFile() {
    return serveFile('file.txt', options);
  }
}
```

The `serveFile` function takes the file path as the first argument and accepts an optional options object as the second argument.
It returns a readable stream of the file content that will be sent as the response.

## Options

The `options` object allows you to customize the behavior of the file serving. It provides the following properties:

-   `headers`: An object containing additional headers to add to the response.
-   `cacheControl`: The Cache-Control header value for caching control. You can provide a string or an object with cache control directives.
-   `expires`: The Expires header value to specify the expiration date/time of the file.
-   `pragmaNoCache`: A boolean value indicating whether to add the Pragma: no-cache header.
-   `baseDir`: The base directory path for resolving the file path.
-   `defaultExt`: The default file extension to be added to the file path if no file extension is provided.
-   `listDirectory`: A boolean value indicating whether to list files in a directory if the file path corresponds to a directory.
-   `index`: The filename of the index file to automatically serve from the folder if present.

## Built-in file server example:

Here's an example of using the `serveFile` function to create a built-in file server in a Moost HTTP controller:

```ts
import { serveFile } from '@wooksjs/http-static';
import { Get, Controller } from '@moostjs/event-http';
import { Param } from 'moost';

@Controller()
class MyController {
  @Get('static/*')
  serveStaticFile(@Param('*') filePath: string) {
    return serveFile(filePath, { cacheControl: { maxAge: '10m' } });
  }
}
```

In the example above, any request to the `/static/*` route will serve the corresponding file from the file system.
The file path is extracted from the wildcard route parameter, and the `cacheControl` option is used to set the caching behavior of the response.

You can refer to the [Cache Control documentation](https://wooks.moost.org/webapp/composables/response.html#cache-control) in Wooks for more details on how to configure the cache control directives.
