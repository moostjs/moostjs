# @moostjs/event-http

**!!! This is work-in-progress library, breaking changes are expected !!!**

<p align="center">
<img src="../../moost-logo.png" width="450px"><br>
<a  href="https://github.com/moostjs/moostjs/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

`event-http` is a moostjs wrapper of [@wooksjs/event-http](https://github.com/wooksjs/wooksjs/tree/main/packages/event-http) with corresponding decorators for composable functions.

## Quick Start

```ts
import { MoostHttp, Get } from '@moostjs/event-http'
import { Moost, Param } from 'moost'

class MyServer extends Moost {
    @Get('test/:name')
    test(@Param('name') name: string) {
        return { message: `Hello ${name}!` }
    }
}

const app = new MyServer()
const http = new MoostHttp()
app.adapter(http).listen(3000, () => {
    app.getLogger('MyApp').log('Up on port 3000')
})
app.init()
// curl http://localhost:3000/test/World
// {"message":"Hello World!"}
```

## Install

`npm install moost @moostjs/event-http`
