# Quick Start

This guide provides a quick overview of how to start your CLI project using Moost CLI.
By following these steps, you will be able to create a basic CLI application that responds to different commands.

## Prerequisites

Before getting started, make sure you have the following dependencies installed in your project:

- `moost`: The Moost framework
- `@moostjs/event-cli`: The Moost CLI adapter

You can install these dependencies using your preferred package manager:

```bash
npm install moost @moostjs/event-cli
```

We also need typescript for this project:
```bash
npm install typescript -sD
```

## Project Setup

1. Create a new file `basic.controller.ts` in the `src` directory with the following content:

```ts
// ./src/basic.controller.ts
import { Controller, Param } from 'moost';
import { Cli } from '@moostjs/event-cli';

@Controller()
export class BasicController {
    @Cli('')
    root() {
        return 'root call with empty command';
    }

    @Cli('foo/:bar')
    foo(@Param('bar') bar: string) {
        return `command "foo" called with arg bar="${bar}"`;
    }
}
```

This file defines a basic controller class `BasicController` with two command handlers: `root` and `foo`. The `@Cli` decorator is used to specify the command pattern for each method.

2. Create a new file `index.ts` in the `src` directory with the following content:

```ts
// ./src/index.ts
import { MoostCli } from '@moostjs/event-cli';
import { Moost } from 'moost';
import { BasicController } from './src/basic.controller';

export function cli() {
    const app = new Moost();

    app.registerControllers(BasicController);
    app.adapter(new MoostCli());

    app.init();
}
```

In this file, we import the necessary modules and define a `cli` function that sets up the Moost application.
We register the `BasicController` and configure the application to use the `MoostCli` adapter.

3. Create a new file `bin` in the project root directory and make it executable:

```bash
#!/usr/bin/env node
const { cli } = require('./dist/index.js');
cli();
```

This file serves as the entry point for your CLI application.
It imports the `cli` function from `index.js` and executes it when the script is run.

Make the `bin` file executable by running the following command:

```bash
chmod +x bin
```

4. Update your `tsconfig.json` file with the following compiler options:

```json
{
    "compilerOptions": {
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "esModuleInterop": true,
        "moduleResolution": "node",
        "skipLibCheck": true,
        "lib": ["esnext"],
        "outDir": "dist"
    },
    "include": ["src"]
}
```

This configuration ensures that the necessary TypeScript compiler options are set for your project.

## Project structure

Make sure that your project structure looks like this:

```
.
├── src
│   ├── basic.controller.ts
│   └── index.ts
├── bin
├── package.json
└── tsconfig.json
```

## Build and Run

1. Build your project by running the following command:

```bash
npx tsc
```

This command compiles your TypeScript code and generates the corresponding JavaScript files in the `dist` directory.

2. Run your CLI application by executing the following command:

```bash
./bin foo "hello world"
```

This command will execute the `foo` command with the argument `"hello world"`.

Congratulations! You have successfully created and executed your CLI application using Moost CLI.

