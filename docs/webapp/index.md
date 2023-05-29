# Quick Start Guide

::: warning
We're still working on Moost. It's ready to use, but some parts might change a bit.
:::

This guide will show you how to make a web application using Moost HTTP.

## Prerequisites
Before you begin, make sure you have these things installed:

-   Node.js (version 14 or higher)
-   npm (this is the Node Package Manager)

## Step 1: Set Up Your Project

To start a new Moost HTTP project, type this command:

```bash
npm create moost -- --http
```

Or you can add a name for your project in the command:

```bash
npm create moost my-web-app -- --http
```

This command will start a helpful tool that will ask you questions like:

- Do you want eslint and prettier?
- Which bundler do you want to use: esbuild or rollup?

After you answer these questions, app initializer will scaffold a project that looks like this:

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

**Optional files** are created based on your answers:

- If you picked eslint and prettier: `.eslintrc.json`, `.prettierrc`, `.prettierignore`
- If you picked rollup as your bundler: `rollup.config.js`

## Step 2: Let's see what we've got

Two important parts of your application are created in the `src` directory: `main.ts` (the starting point for your app) and `app.controller.ts` (a basic "Hello, World!" controller).

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

## Step 3: Install and dev

After your project is set up, go into your project directory and run this command to get the dependencies:

```bash
npm install
```

Once that's done, start your application in development mode with this command:

```bash
npm run dev
```

Your application will be live at http://localhost:3000.
You can go to http://localhost:3000/hello/John and see the message "Hello, John!".

## What's Next?

Now that your application is running, you can add more features to your project.
Here are some steps you can follow:

- Add more [controllers](./controllers/) in the `src/controllers` directory. Don't forget to register them in your `main.ts` file with the `registerControllers` method.
- Change your application settings to fit your needs. If you chose eslint, prettier, or a specific bundler, make sure to update the respective configuration files.
- Use different types of [request handling](/webapp/handlers) by using other HTTP decorators like `@Post`, `@Put`, `@Delete`, etc.
- Use Moost's cool features like [dependency injection](/moost/di/), [interceptors](/moost/interceptors), validators, and more to build a strong, scalable application.

👏👏👏 Happy coding!