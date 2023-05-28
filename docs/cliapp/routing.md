# Routing


<span class="cli-header"><span class="cli-path">/cliapp</span><span class="cli-invite">$</span> moost cli --routing<span class="cli-blink">|</span></span>

Moost CLI leverages the power of [Wooks CLI](https://wooksjs.org/cliapp/introduction.html) to offer a robust routing system for managing command-line interface (CLI) commands effortlessly. This guide will walk you through defining routes, processing arguments, and working with options in Moost CLI.

::: info
Moost, built on the robust Wooks framework, utilizes [@prostojs/router](https://github.com/prostojs/router) for routing. Its documentation has been partially incorporated here for your convenience.
:::

## Fundamentals of Routing

Routing in Moost CLI refers to the mapping of CLI commands to the appropriate handlers. Each route consists of a command pattern, which outlines the command's structure, including the command name and its arguments.

## Command Configuration

Moost CLI, just like Wooks CLI, presents commands as paths due to the inherent router utilized. For instance, to define the command `npm install @moostjs/event-cli`, you might utilize the following command pattern:

```js
'/install/:package'
```

Here, `:package` is a variable. Alternatively, you can use a _space_ as a separator, like so:

```js
'install :package'
```

Both command patterns achieve the same purpose.

If you need to include a colon in your command, make sure to escape it with a backslash (\\). For instance:

```js
'app build\\:dev'
```

The command pattern above allows for the execution of the command as follows:

```bash
my-cli app build:dev
```

By grasping the fundamentals of routing and exploring options in Moost CLI, you can create powerful and versatile CLI commands with ease. Enjoy the simplicity and flexibility that Moost CLI brings to your development workflow!