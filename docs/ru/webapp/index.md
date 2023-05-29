# Quick Start of Web Application

::: warning
Work on Moost is still in progress. While it is suitable for out-of-the-box use, some APIs may undergo changes.
:::

This guide will walk you through the process of setting up a web application using Moost HTTP.

## Prerequisites
Before getting started, make sure you have the following installed:

-   Node.js (version 14 or above)
-   npm (Node Package Manager)

## Step 1: Project Setup with `create-moost`

To create a new Moost HTTP project, run the following command:

```bash
npm create moost --http
```

Or you can provide a project name in the command:

```bash
npm create moost my-web-app --http
```

This command will initiate a CLI wizard which will ask you several questions, such as:

- If you need eslint and prettier
- Which bundler to use: esbuild or rollup

Once you have provided your preferences, `create-moost` will generate a project with the following structure:

```
my-web-app/
├── src/
│   ├── controllers/
│   │   └── app.controller.ts
│   └── main.ts
├── .gitignore
├── package.json
├── tsconfig.json
└── [optional files...]
```

**Optional files** are generated based on your choices in the CLI wizard:

- If you opted for eslint and prettier: `.eslintrc.json`, `.prettierrc`, `.prettierignore`
- If you chose rollup as your bundler: `rollup.config.js`

## Step 2: Inspect Your Generated Code

Two crucial parts of your application are scaffolded in the `src` directory: `main.ts` (your app entry point) and `app.controller.ts` (your basic "Hello, World!" controller).

`main.ts`:
```ts
import { MoostHttp } from '@moostjs/event-http'
import { Moost } from 'moost'
import { AppController } from './controllers/app.controller'

const app = new Moost()

void app.adapter(new MoostHttp()).listen(3000, () => {
    app.getLogger('moost-app').info('Up on port 3000')
})

void app
    .registerControllers(
        AppController
        // Add more controllers here...
    )
    .init()
```

`app.controller.ts`:
```ts
import { Get } from '@moostjs/event-http'
import { Controller, Param } from 'moost'

@Controller()
export class AppController {
    @Get('hello/:name')
    greet(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}
```

## Step 3: Install Dependencies and Run Your App

Once you have your project scaffolded, navigate into your project directory and run the following command to install the dependencies:

```bash
npm install
```

After the installation is completed, start your application in development mode with the following command:

```bash
npm run dev
```

Your application will be up and running on http://localhost:3000.
You should be able to visit http://localhost:3000/hello/John and see the greeting "Hello, John!".

## What Next?

Now that you have your application up and running, you can extend your project with additional features.
Here are some of the steps you can take:

- Add more [controllers](./controllers/) in the `src/controllers` directory. Remember to register them in your `main.ts` file with the `registerControllers` method.
- Adjust your application configurations based on your needs. If you chose eslint, prettier, or a specific bundler, make sure to update the respective configuration files.
- Implement different types of request handling by using other HTTP decorators like `@Post`, `@Put`, `@Delete`, etc.
- Leverage Moost's advanced features such as [dependency injection](/moost/di/), [interceptors](/moost/interceptors), validators, and more to build a robust, scalable application.

👏👏👏 Enjoy your coding!