# Quick Start of CLI Application

::: warning
Work on Moost is still in progress. While it is suitable for out-of-the-box use, some APIs may undergo changes.
:::

This guide will walk you through the process of setting up a command-line interface (CLI) application using Moost CLI.

## Prerequisites
Before getting started, make sure you have the following installed:

-   Node.js (version 14 or above)
-   npm (Node Package Manager)

## Step 1: Project Setup with `create-moost`

To create a new Moost CLI project, run the following command:

```bash
npm create moost --cli
```

Or you can provide a project name in the command:

```bash
npm create moost my-cli-app --cli
```

This command will initiate a CLI wizard which will ask you several questions, such as:

- If you need eslint and prettier
- Which bundler to use: esbuild or rollup

Once you have provided your preferences, `create-moost` will generate a project with the following structure:

```
my-cli-app/
├── src/
│   ├── controllers/
│   │   └── app.controller.ts
│   └── main.ts
├── bin.js
├── .gitignore
├── package.json
├── tsconfig.json
└── [optional files...]
```

**Optional files** are generated based on your choices in the CLI wizard:

- If you opted for eslint and prettier: `.eslintrc.json`, `.prettierrc`, `.prettierignore`
- If you chose rollup as your bundler: `rollup.config.js`

## Step 2: Inspect Your Generated Code

Three crucial parts of your application are scaffolded in your project: `bin.js` (your CLI app entry point), `main.ts` (your app core) and `app.controller.ts` (your basic "Hello, World!" controller).

`bin.js`:
```js
#!/usr/bin/env node
require('./dist/main.js');
```

`main.ts`:
```ts
import { MoostCli, cliHelpInterceptor } from '@moostjs/event-cli'
import { Moost } from 'moost'
import { AppController } from './controllers/app.controller'

function cli() {
    const app = new Moost()

    app.applyGlobalInterceptors(
        cliHelpInterceptor({
            colors: true,
            lookupLevel: 3,
        })
    )

    app.registerControllers(AppController)
    app.adapter(new MoostCli({
        debug: false,
        wooksCli: {
            cliHelp: { name: 'moost-app' },
        },
        globalCliOptions: [
            { keys: ['help'], description: 'Display instructions for the command.' },
        ],
    }))

    void app.init()
}

cli()
```

`app.controller.ts`:
```ts
import { Cli } from '@moostjs/event-cli'
import { Controller, Param } from 'moost'

@Controller()
export class AppController {
    @Cli('hello/:name')
    greet(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
```

The entry point for CLI `bin.js` needs to be executable. You can use the `chmod` command to

 change the permissions of this file:

```bash
chmod +x ./bin.js
```

## Step 3: Running Your CLI App

In your project directory, first install the required dependencies:

```bash
npm install
```

Then, run the build command:

```bash
npm run build
```

After building the project successfully, you can run your CLI app:

```bash
./bin.js hello World
```

The output should be:

```bash
Hello, World!
```

## Step 4: Extend Your Project

Once you have the basic CLI application up and running, you can extend your project with additional features:

- Add more [controllers](./controllers) in the `src/controllers` directory. Remember to register them in your `main.ts` file with the `registerControllers` method.
- Adjust your application configurations based on your needs. If you chose eslint, prettier, or a specific bundler, make sure to update the respective configuration files.
- Implement different types of command handling by using other CLI decorators.
- Leverage Moost's advanced features such as [dependency injection](/moost/di/), [interceptors](/moost/interceptors), validators, and more to build a robust, scalable application.

👏👏👏 Enjoy your coding!
