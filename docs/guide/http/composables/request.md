# Request Composables

Request is an object (`IncomingMessage`) that is generated when an incoming http request hits nodejs server.
That object contains headers, body etc. Headers can be available even before body is loaded.
The event handler is triggered right when `head` has already been received but before `body` is received.
It means that in case of wrong path the router will reply 404 before body was even sent.
It also means that you can check headers/cookies before body is received, then you can make a decision if body is needed, should you parse it or not.

## Content

[[toc]]

## Raw Request Instance

To get a reference to the raw request instance use composable function `useRequest`

You probably don't need a `rawRequest` unless you are developing some new feature. All the base use-cases covered with other composable functions.

```js
import { useRequest } from '@wooksjs/event-http'
// cjs:
// const { useRequest } = require('@wooksjs/event-http')

app.get('test', () => {
    const { rawRequest } = useRequest()
})
```

## URI Parameters

URI Parameters are parsed by the router and covered in [this](../routing.md#retrieving-uri-params) section.

## Query Parameters

Composable `useSearchParams` provides three functions:

-   `urlSearchParams()` — an instance of `WooksURLSearchParams` that extends standard `URLSearchParams` with `toJson` method that returns json object of query params
-   `jsonSearchParams()` — is a shortcut to `urlSearchParams().toJson()`
-   `rawSearchParams()` — is raw search param string like `?param1=value&...`

```js
import { useSearchParams } from '@wooksjs/event-http'

app.get('hello', () => {
    const { urlSearchParams, jsonSearchParams, rawSearchParams } =
        useSearchParams()

    // curl http://localhost:3000/hello?name=World
    console.log(jsonSearchParams()) // { name: 'World' }
    console.log(rawSearchParams()) // ?name=World

    return `Hello ${urlSearchParams().get('name')}!`
})
```

```bash
curl http://localhost:3000/hello?name=World
# Hello World!
```

## Method and Headers

`useRequest` provides some more shortcuts for useful data

```js
import { useRequest } from '@wooksjs/event-http'
app.get('test', async () => {
    const {
        url, // request url      (string)
        method, // request method   (string)
        headers, // request headers  (object)
        rawBody, // request body     ((): Promise<Buffer>)
    } = useRequest()

    const body = await rawBody() // body as a Buffer
})
```

## Cookies

Cookies are not parsed unless requested. Composable function `useCookies` provides cookie getter and raw cookies string.

```js
import { useCookies } from '@wooksjs/event-http'

app.get('test', async () => {
    const {
        rawCookies, // "cookie" from headers (string | undefined)
        getCookie, // cookie getter ((name): string | null)
    } = useCookies()

    console.log(getCookie('session'))
    // prints the value of the cookie with the name "session"
})
```

## Authorization

`useAuthorization` function provides helpers for auth-headers:

```js
import { useAuthorization } from '@wooksjs/event-http'
app.get('test', async () => {
    const {
        authorization, // the raw value of "authorization" header : string
        authType, // the auth type (Bearer/Basic) : string
        authRawCredentials, // the auth credentials that follow auth type : string
        isBasic, // true if authType === 'Basic' : () => boolean
        isBearer, // true if authType === 'Bearer' : () => boolean
        basicCredentials, // parsed basic auth credentials : () => { username: string, password: string }
    } = useAuthorization()

    if (isBasic()) {
        const { username, password } = basicCredentials()
        console.log({ username, password })
    } else if (isBearer()) {
        const token = authRawCredentials
        console.log({ token })
    } else {
        // unknown or empty authorization header
    }
})
```

## Body Parser

Implementation of body parser is isolated into a separate package `@wooksjs/http-body`

See more details [here](../body.md)
