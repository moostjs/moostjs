# Proxy Requests

Although Wooks HTTP already supports `fetch` response to be returned from a handler,
this package provides more convinient way to proxy requests.

## Install

```bash
npm install @wooksjs/http-proxy
```

## Usage

A very simple example:

```js
import { useProxy } from '@wooksjs/http-proxy'

app.get('/to-proxy', () => {
    const proxy = useProxy()
    return proxy('https://target-website.com/target-path?query=123')
})
```

## Restrict cookies/headers to pass

```js
import { useProxy } from '@wooksjs/http-proxy'
app.get('/to-proxy', () => {
    const proxy = useProxy()
    return proxy('https://target-website.com/target-path?query=123', {
        reqHeaders: { block: ['referer'] }, // block referer header
        reqCookies: { block: '*' }, // block all req cookies
    })
})

```

## Change Response

It's easy as `proxy` returns fetch response

```js
import { useProxy } from '@wooksjs/http-proxy'
app.get('/to-proxy', async () => {
    const proxy = useProxy()
    const response = proxy('https://mayapi.com/json-api')
    const data = { ...(await response.json()), newField: 'new value' }
    return data
})

```

## Advanced Options

```js
import { useProxy } from '@wooksjs/http-proxy'
import { useRequest } from '@wooksjs/composables'
//...
app.get('*', async () => {
    const proxy = useProxy()
    const { url } = useRequest()
    const fetchResponse = await proxy('https://www.google.com' + url, {
        // optional method, be default is set with
        // the original request method
        method: 'GET',

        // the next four options help to filter out
        // request/response headers/cookies
        // each of the option accepts an object with:
        // - allow: '*' | (string | RegExp)[] - a list to allow (default '*')
        // - block: '*' | (string | RegExp)[] - a list to block
        // - overwrite: Record<string| string> | ((data: object) -> object) - object or fn to overwrite data
        reqHeaders: { block: ['referer'] },
        reqCookies: { allow: ['cookie-to-pass-upstream'] },
        resHeaders: { overwrite: { 'x-proxied-by': 'wooks-proxy' } },
        resCookies: { allow: ['cookie-to-pass-downstream'] },

        // debug: true - will print proxy paths and headers/cookies
        debug: true,
    })
    return fetchResponse // fetch response is supported, the body will be downstreamed

    // > you can also return fully buffered body as Uint8Array
    // return new Uint8Array(await fetchResponse.arrayBuffer())

    // > or as string
    // return fetchResponse.text()

    // > or change response before return
    // const data = await fetchResponse.text() + '<new data>'
    // return data
})
//...
```
