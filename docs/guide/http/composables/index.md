# Composables

::: tip
Composable function (hook) is a function that hooks you to the [event context](../../#event-context), e.g. URL-params, body, cookies etc.
:::

Wooks HTTP comes with many useful composable functions. Those can be devided into the following groups: 

- [Request Composables](./request.md) — Whatever comes with the request (headers, cookies, body...)
- [Response Composables](./request.md) — Whatever can be set for the response (set cookies, set headers, ...)

You can write your own composables that would incapsulate more logic, for instance getting a user data based on cookie or auth. headers.

::: warning
All the composable function must be called before any async operation
because the Event Context gets lost after asyncronous commands.

If you need to call some composables after async operations you must first
restore the context. See more details about Event Context [here](../../advanced/context.md).
:::


::: code-group
```js [call composables syncronously]
import { useSetHeader, useSetCookies } from '@wooksjs/event-http'

app.get('/async', async () => {
    // call the composables syncronously here
    const myHeader = useSetHeader('my-header')

    myHeader.value = 'value before await'

    await ... // some async code
    // at this point the event context already lost

    myHeader.value = 'value after await' // but hooks are still working

    const { setCookie } = useSetCookies() // don't do this // [!code error]
})
```
```js [how to restore context]
import { useSetHeader, useSetCookies, useHttpContext } from '@wooksjs/event-http'

app.get('/async', async () => {
    const myHeader = useSetHeader('my-header')
    const { restoreCtx } = useHttpContext() // here's restoreCtx fn // [!code ++]

    myHeader.value = 'value before await'

    await ... // some async code
    // at this point the event context already lost

    myHeader.value = 'value after await' // but hooks are still working

    restoreCtx()    // [!code ++]
    // event context is back after restoreCtx() call    

    const { setCookie } = useSetCookies() // works fine now // [!code hl]
})
```
:::