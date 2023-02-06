# Moost HTTP 

::: warning
The work on Moost is still in progress. It is already suitable for
out-of-the-box use for HTTP events, but some of the APIs can still change.
:::

## Overview

As an event processing framework Wooks provides functionality for processing http-events.

::: tip
You can read an overview of how Wooks approaches the event processing in general [here](../#overview)
:::

Wooks HTTP allows you to create an http server with beauty of composable functions and fast [routing](../#event-routing).
It ships many http-specific composables built-in, such as:

- URL query params parser
- Cookie parser
- Body parser (many formats work out-of-the-box: `json`, `url-encoded`, `form`, ...)
- Static files
- Response Status
- Response Cookies
- Response Headers
- Cache Control
- ...

None of these composables is triggered unless you want it. This makes Wooks HTTP extremely flexible and performant.

::: tip
Composable function (hook) is a function that hooks you to the [event context](../#event-context), e.g. URL-params, body, cookies etc.
:::

### Differences from other Web App Frameworks:

1. Wooks never mutates request object (`req`). It stores a request context in a separate object(s) instead ([event context](../#event-context)).
2. Wooks never parses anything (cookies, body) before it is really requested by the request handler.
3. There is no complex predefined data objects containing everything (cookies, headers, body, parsed body etc.). Composables (hooks) provide the data from the event context on demand.
4. No need for tons of dependencies (middlewares such as `cookie-parser` etc.). Wooks implements those in a simple performant way.

## Install

```bash
npm install wooks @wooksjs/event-http
```

## Quick Start

Here's a `Hello World` example app. It spins up a server on port 3000 and replies `Hello World!`.

::: code-group

```js [ESM]
import { useRouteParams } from 'wooks'
import { createHttpApp } from '@wooksjs/event-http'

const app = createHttpApp()

app.on('GET', 'hello/:name', () => `Hello ${ useRouteParams().get('name') }!`)

// or use a shortcut for get method:
// app.get('hello/:name', () => `Hello ${ useRouteParams().get('name') }!`)

app.listen(3000, () => { console.log('Wooks Server is up on port 3000') })
```

```js [CommonJS]
const { useRouteParams } = require('wooks')
const { createHttpApp } = require('@wooksjs/event-http')

const app = createHttpApp()

app.on('GET', 'hello/:name', () => `Hello ${ useRouteParams().get('name') }!`)

// or use a shortcut for get method:
// app.get('hello/:name', () => `Hello ${ useRouteParams().get('name') }!`)

app.listen(3000, () => { console.log('Wooks Server is up on port 3000') })
```

:::

Call the endpoint to see the result:
```bash
curl http://localhost:3000/hello/World
# Hello World!
```


## Use `http` directly

You can create http(s) server manually and pass server callback from the wooks http app:

::: code-group
```js [ESM]
import { useRouteParams } from 'wooks'
import { createHttpApp } from '@wooksjs/event-http'
import http from 'http' // or https

const app = createHttpApp()

app.get('hello/:name', () => `Hello ${ useRouteParams().get('name') }!`)

const server = http.createServer(app.getServerCb()) // [!code hl]
server.listen(3000, () => { console.log('Wooks Server is up on port 3000') }) // [!code hl]
```
```js [CommonJS]
const { useRouteParams } = require('wooks')
const { createHttpApp } = require('@wooksjs/event-http')
const http = require('http') // or https

const app = createHttpApp()

app.get('hello/:name', () => `Hello ${ useRouteParams().get('name') }!`)

const server = http.createServer(app.getServerCb()) // [!code hl]
server.listen(3000, () => { console.log('Wooks Server is up on port 3000') }) // [!code hl]
```
:::