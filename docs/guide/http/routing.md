# Routing

Routing is the first step of event processing. It's responsible for routing the event context to a proper event handler.
Routes can be static or parametric. Parameters are parsed from a parametric route and then passed further to a handler.

::: info
Wooks uses [@prostojs/router](https://github.com/prostojs/router) for routing. Its documentation partly inicluded
here for easy access.
:::

The router properly parses URI and finds the handler in the shortest possible time.

## Content

[[toc]]

## Parametric routes

Parameter starts with `:`.
If you want to have colon in your path without defining a parameter you must escape it with backslash like so `'/api/colon\\:novar'`.
Parameters can be separated with hyphen like so `'/api/:key1-:key2'`
It's possible to specify RegExp for parameters `'/api/time/:hours(\\d{2})h:minutes(\\d{2})m'`

```js
// simple single param
app.get('/api/vars/:key', () =>  'ok')
// two params separated with hyphen
app.get('/api/vars/:key1-:key2', () =>  'ok')
// two params with regex
app.get('/api/time/:hours(\\d{2})h:minutes(\\d{2})m', () =>  'ok')
// two params separated with slash
app.get('/api/user/:name1/:name2', () =>  'ok')
// three params with the same name (leads to an array as a value)
app.get('/api/array/:name/:name/:name', () =>  'ok')
```

## Wildcards

Widlcard is specified with asterisk `'*'`
There are several options available:

1. It can be at the beginning of path, in the middle of the path or at the end of the path.
2. It's possible to have several wildcards.
3. It's possible to have widlcards mixed with params.
4. It's possible to pass regex to wildcard.

```js
// the most common usage (will match all the URIs that
// start with `/static/`)
app.get('/static/*', () =>  'ok')

// will match all the URIs that start with `/static/`
// and end with `.js`
app.get('/static/*.js', () =>  'ok')

// will match all the URIs that start with `/static/`
// and have `/test/` in the middle
app.get('/static/*/test/*', () =>  'ok')

// will match all the URIs that start with `/static/[numbers]`
app.get('/static/*(\\d+)', () =>  'ok')
```

## Retrieving URI params

When using parametric routes it's usefull to get access to the params.
Here's the first composable function `useRouteParams` from `wooks`.

It returns an object that contains params as `JSON` and a getter function `get`:
```ts
function useRouteParams<T extends object = Record<string, string | string[]>>(): {
    params: T;
    get: <K extends keyof T>(name: K) => T[K];
}
```

Usage of `useRouteParams`

::: code-group
```js [ESM]
import { useRouteParams } from 'wooks'
app.get('hello/:name', () => {
    const { get } = useRouteParams()
    return `Hello ${ get('name') }!`
})
```
```js [CommonJS]
const { useRouteParams } = require('wooks')
app.get('hello/:name', () => {
    const { get } = useRouteParams()
    return `Hello ${ get('name') }!`
})
```
:::

For repeated param name it returns an array:
::: code-group
```js [ESM]
import { useRouteParams } from 'wooks'
app.get('hello/:name/:name', () => {
    const { get } = useRouteParams()
    return get('name') // array of names
})
```
```js [CommonJS]
const { useRouteParams } = require('wooks')
app.get('hello/:name/:name', () => {
    const { get } = useRouteParams()
    return get('name') // array of names
})
```
:::

For wildcard the name of param is `*`:
::: code-group
```js [ESM]
import { useRouteParams } from 'wooks'
app.get('hello/*', () => {
    const { get } = useRouteParams()
    return get('*') // returns everything that follows hello/
})
```
```js [CommonJS]
const { useRouteParams } = require('wooks')
app.get('hello/*', () => {
    const { get } = useRouteParams()
    return get('*') // returns everything that follows hello/
})
```
:::

Multiple wildcards are stored as an array (similar to repeated param name)

## Path builders

When you define a new route you receive a path builder for it. 
Path builder can be used to build a path based on URI params.

::: code-group
```js [javascript]
const pathBuilder = app.get('/api/path', () => 'ok')
console.log(pathBuilder()) // /api/path

const userPathBuilder = app.get('/api/user/:name', () => 'ok')
console.log(userPathBuilder({
    name: 'John'
})) // /api/user/John

const wildcardBuilder = app.get('/static/*', () => 'ok')
console.log(wildcardBuilder({
    '*': 'index.html'
})) // /static/index.html

const multiParamsBuilder = app.get('/api/asset/:type/:type/:id', () => 'ok')
console.log(userPathBuilder({
    type: ['CJ', 'REV'],
    id: '443551'
})) // /api/asset/CJ/REV/443551
```

```ts [typescript]
interface MyParamsType = {
    name: string
}
const userPathBuilder = app.get<string, MyParamsType>('/api/user/:name', () => 'ok')
console.log(userPathBuilder({
    name: 'John'
}))
// /api/user/John
```
:::

## Query Parameters

Query Parameters or URL Search Parameters are not a part of URI path that is processed by router.
Router simply ignores everything after `?` or `#`.

So there is nothing router can do about query params. But there is a composable function that
provides you access to those: `useSearchParams` from `@wooksjs/event-http`

See more details [here](./composables/request.md#query-parameters).
