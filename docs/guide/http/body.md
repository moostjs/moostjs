# Body Parser

Request body is delivered as a `Buffer` no matter what was the content-type. Plain text, JSON, images — everything is `Buffer`.

Package `@wooksjs/http-body` provides composables that can parse body according to its `Content-Type`.
The parsed body then cached in Wooks Context to ensure that parsing happens only once, even if you call `parseBody` function
several times in different places of your code.

Supported content types:

- `application/json`
- `text/*`
- `multipart/form-data`
- `application/x-www-form-urlencoded`

Body parser does not parse every request's body. The parsing happens only when you call `parseBody` function.

## Install

```bash
npm install @wooksjs/http-body
```

## Usage

```js
import { useBody } from '@wooksjs/http-body'

app.post('test', async () => {
    const { parseBody } = useBody()
    const data = await parseBody()
})
```

## Additional hooks

```js
import { useBody } from '@wooksjs/http-body'

app.post('test', async () => {
    const {
        isJson,         // checks if content-type is "application/json" : () => boolean;
        isHtml,         // checks if content-type is "text/html" : () => boolean;
        isXml,          // checks if content-type is "application/xml" : () => boolean;
        isText,         // checks if content-type is "text/plain" : () => boolean;
        isBinary,       // checks if content-type is binary : () => boolean;
        isFormData,     // checks if content-type is "multipart/form-data" : () => boolean;
        isUrlencoded,   // checks if content-type is "application/x-www-form-urlencoded" : () => boolean;
        isCompressed,   // checks content-encoding : () => boolean | undefined;
        contentEncodings, // returns an array of encodings : () => string[];
        parseBody,      // parses body according to content-type : <T = unknown>() => Promise<T>;
        rawBody,        // returns raw body Buffer : () => Promise<Buffer>;
    } = useBody()

    // the handler got the control, but the body isn't loaded yet
    //...

    console.log(await parseBody())

    // after `await parseBody()` the body was loaded and parsed
    // ...
})
```

## Custom Body Parser

If you want to parse body your own way you can do so using `rawBody`:

```js
import { useBody } from '@wooksjs/http-body'

app.post('test', async () => {
    const { rawBody } = useBody()

    const bodyBuffer = await rawBody()

    // your logic of parsing of bodyBuffer ...
})
```

In the example above parsing happens in the handler. It's not very convinient and does not guarantee that parsing happens only once.
To improve your code you can create your own body parser composable:

::: code-group
```ts [custom-parser-composable.ts]
import { useBody } from '@wooksjs/http-body'

// Describing the type of the context store
type TBodyStore = { 
    parsed?: Promise<unknown>
}

export function useCustomBody() {
    // getting the context store for our type
    const { store } = useHttpContext<{ request: TBodyStore }>()

    // getting init function for `request` props
    const { init } = store('request')

    // using `rawBody` composable to get raw body Buffer
    const { rawBody } = useRequest()

    // preparing default body parser for fallbacks
    const defaultParser = useBody().parseBody

    // gettng content-type
    const { 'content-type': contentType } = useHeaders()

    // defining our parser
    const parseBody = () => init('parsed', async () => {
        // do custom parsing only for 'my-custom-content'
        if (contentType === 'my-custom-content') {
            const bodyBuffer = await rawBody()
            // your logic of parsing of bodyBuffer ...  // [!code hl]
        } else {
            // fallback to default parser
            return defaultParser()
        }
    })

    return { parseBody, rawBody }
}
```
```ts [index.ts]
import { useCustomBody } from './custom-parser-composable'

app.post('test', async () => {
    const { parseBody } = useCustomBody() // [!code hl]
    console.log(await parseBody())        // [!code hl]
})
```
:::

In the example above we created a composable function that parses body of content type `my-custom-content`
and falls back to `@wooksjs/http-body` for the rest of content types.

We used Wooks Event Context API (`store`, `init`). If you want to learn more about Wooks Event Context API,
please follow this [link](../advanced/context.md).

