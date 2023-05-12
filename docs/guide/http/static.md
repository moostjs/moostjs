# Serve Static

This package provides `serveFile` function that returns a readable stream from fs.

Features:

-   Returns a readable stream
-   Prepares all the neccessary response headers (like content-length, content-type etc)
-   Can handle etag
-   Can handle ranges

## Install

```bash
npm install @wooksjs/http-static
```

## Usage

```js
import { serveFile } from '@wooksjs/http-static'

app.get('static/file.txt', () => {
    // ...
    return serveFile('file.txt', options)
})
```

## Options

```ts
{
    // Any header to add
    headers?: Record<string, string>,

    // Cache-Control header
    cacheControl?: TCacheControl,

    // Expires header
    expires?: Date | string | number,

    // when true a header "Pragma: no-cache" will be added
    pragmaNoCache?: boolean,

    // the base directory path
    baseDir?: string,

    // default extension will be added to the filePath
    defaultExt?: string,

    // when true lists files in directory
    listDirectory?: boolean,

    // put 'index.html'
    // to automatically serve it from the folder
    index?: string,
}
```

## Built-in file server example:

```js
import { useRouteParams } from 'wooks'
import { serveFile } from '@wooksjs/http-static'
app.get('static/*', () => {
    const { get } = useRouteParams()
    return serveFile(get('*'), { cacheControl: { maxAge: '10m' } })
})
```

See the `cacheControl` details [here](./composables/response.md#cache-control).
