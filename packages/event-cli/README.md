# @moostjs/event-cli

**!!! This is work-in-progress library, breaking changes are expected !!!**

<p align="center">
<img src="../../moost-logo.png" width="450px"><br>
<a  href="https://github.com/moostjs/moostjs/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

`event-cli` is a moostjs wrapper of [@wooksjs/event-cli](https://github.com/wooksjs/wooksjs/tree/main/packages/event-cli) with corresponding decorators for composable functions.

## Quick Start

```ts
import { MoostCli, Flag, Cli } from '@moostjs/event-cli'
import { Moost } from 'moost'

class MyApp extends Moost {
    @Cli('command')
    command(@Flag('test') test: string | boolean) {
        return `command run with flag test=${ test }`
    }
}

const app = new MyApp()

const cli = new MoostCli()
app.adapter(cli)
app.init()

// Run compiled file as CLI with `command --test`
// The output:
// "command run with flag test=true"
```

## Install

`npm install moost @moostjs/event-cli`
