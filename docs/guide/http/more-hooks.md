# Context and Hooks

This is advanced guide on how to work with Event Context and how to create your own hooks.

## Create useUserProfile composable

As an example we'll create a composable that resolves user profile

```ts
import { useAuthorization, useHttpContext } from '@wooksjs/event-http'

interface TUser {
    username: string
    age: number
    // ...
}

export function useUserProfile() {
    // 1. get custom-typed context
    const { store } = useHttpContext<{ user: TUser }>()
    const user = store('user')

    // 2. in this example will use basic credentials approach to get user name
    const { basicCredentials } = useAuthorization()

    // 3. get user name
    const username = basicCredentials()?.username

    // 4. user data async loader
    async function userProfile() {
        // first check if user data was already cached
        // for this request
        if (!user.value) {
            // no user data cached yet, try to read user
            // and return the result
            user.value = await readUser()
        }
        // return user profile from cache
        return user.value
    }

    // abstract readUser function
    function readUser(): Promise<TUser> {
        // return db.readUser(username)
    }    

    return {
        username, // we have user name syncronously
        userProfile, // and userProfile as (() => Promise<TUser>)
    }
}

// example of usage of our useUserProfile
app.get('/user', async () => {
    const { username, userProfile } = useUserProfile()
    console.log('username =', username)
    const data = await userProfile()
    return { user: data }
})
```

### Create useHeaderHook

Example of custom set header hook

```ts
import { useSetHeaders } from '@wooksjs/event-http'
import { attachHook } from '@wooksjs/event-core'

function useHeaderHook(name: string) {
    const { setHeader, headers } = useSetHeaders()

    return attachHook({
        name,
        type: 'header',
    }, {
        get: () => headers()[name] as string,
        set: (value: string | number) => setHeader(name, value),
    })
}

// usage

app.get('/test', () => {
    const myHeader = useHeaderHook('x-my-header')
    myHeader.value = 'header value'
    // *Please note that useSetHeader('x-my-header') will work similarly*
    return 'ok'
})

// result:
// 200
// headers:
// x-my-header: header value
```

## How to Restore the Event Context

`const { restoreCtx, clearCtx } = useHttpContext()`

```ts
import { useHttpContext } from '@wooksjs/event-http'

async function someHandler() {
    const { restoreCtx, clearCtx } = useHttpContext()
    await ... // some async operations
    restoreCtx()
    // here the wooks context is back
}
```