# Quick Start of Web Application

::: warning
Work on Moost is still in progress. While it is suitable for out-of-the-box use, some APIs may undergo changes.
:::

This guide will walk you through the process of setting up a web application using Moost HTTP,
a companion package for Moost that enables event-driven HTTP request handling.
By following these steps, you'll be able to create a basic server that responds to GET requests with personalized messages.

## Prerequisites
Before getting started, make sure you have the following installed:

-   Node.js (version 14 or above)
-   npm (Node Package Manager) or yarn

## Step 1: Project Setup

Create a new directory for your project and navigate into it using your preferred command-line interface.
Then, initialize a new Node.js project by running the following command:

```bash
npm init -y
```

This will generate a package.json file in your project directory.

## Step 2: Installation
Next, you need to install the necessary packages for your Moost HTTP project.
```bash
# main packages
npm install @moostjs/event-http moost
# dev dependencies on typescript
npm install typescript ts-node -sD
```

`tsconfig.json` must include following options under `compilerOptions`:

```json
"emitDecoratorMetadata": true,
"experimentalDecorators": true,
```

## Step 3: Create Your Web App
Now, create a new TypeScript file (e.g., `server.ts`) and open it in your preferred code editor.
Copy the following code into the file:

::: code-group
```ts [server.ts]
import { MoostHttp, Get } from '@moostjs/event-http'
import { Moost, Param } from 'moost'

class MyServer extends Moost {
    @Get('hello/:name')
    hello(@Param('name') name: string) {
        return `Hello, ${name}!`
    }
}

const app = new MyServer()
const httpAdapter = new MoostHttp()
app.adapter(httpAdapter)
app.init()
httpAdapter.listen(3000, () => {
    app.getLogger('my-app').info('Up on port 3000')
})
```
```ts [server.ts (with comments)]
import { MoostHttp, Get } from '@moostjs/event-http'
import { Moost, Param } from 'moost'

// Create our own Moost app
class MyServer extends Moost {
    // Define a GET endpoint with the pattern /hello/<argument name>
    @Get('hello/:name')
    hello(
        // Define a resolver for the route argument "name",
        // which will be automatically resolved to a value
        @Param('name') name: string,
    ) {
        // Return "Hello, <name>!"
        return `Hello, ${name}!`
    }
}

// Create an instance of our app
const app = new MyServer()

// Create an HTTP adapter that enables our app
// to process HTTP requests and trigger our HTTP handlers
const httpAdapter = new MoostHttp()

// Apply the HTTP adapter to our app
app.adapter(httpAdapter)

// Perform initialization
// This processes the metadata provided via decorators
// and initializes the app with the router
app.init()

// Run the server on port 3000
httpAdapter.listen(3000, () => {
    // Use the built-in logger to display a message
    // indicating that the server is listening on port 3000
    app.getLogger('my-app').info('Up on port 3000')
})
```
:::

## Step 4: Run Your Web App
Save the changes to `server.ts` and in your command-line interface, run the following command to start your Moost app:

```bash
npx ts-node server.ts
```
This command uses `ts-node` to compile and execute the TypeScript code in the `server.ts` file.

You should see a message in the console indicating that the server is up and running on port 3000:


<div class="language-terminal">
<span class="lang">terminal</span>
<pre>
<span class="info">[moost][2023-01-01 12:30:45] • <span class="cyan">(GET)</span>/hello/:name → MyServer.<span class="cyan">hello</span>()</span>
<span class="info">[my-app][2023-01-01 12:30:45] Up on port 3000</span>
</pre>
</div>

## Step 5: Test Your Web App
Open your web browser and visit [http://localhost:3000/hello/John](http://localhost:3000/hello/John) (replace "John" with your preferred name).
You should see the response "`Hello, John!`" displayed in the browser.
