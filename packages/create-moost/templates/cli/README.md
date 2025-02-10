# {{ projectName }} 

## Moost CLI Template

This template provides a simple CLI application using Moost CLI. It demonstrates how to define commands with decorators, build the project with Rolldown, and run it in different environments.

## Prerequisites

- Node.js (v18 or later)
- A package manager like [npm](https://www.npmjs.com/)

## Installation

This template is installed via:

```bash
npm create moost@latest -- --cli
```

After the setup, navigate into the project folder and install dependencies:

```bash
cd {{ packageName }}
npm install
```

## Running Locally

You can test the CLI in multiple ways:

### 1. Using `npx` (Recommended for testing)

```bash
npm run build
npx <project_name> <command> [options]
```

Example:

```bash
npx {{ packageName }} hello world
```

This method does not require global installation but runs slightly slower.

### 2. Running in Development Mode

```bash
npm run dev <command> [options]
```

This command builds the project and runs it directly.

### 3. Running a Built Version

```bash
npm run build
node ./dist/main.js <command> [options]
```

This method is useful for testing the production build.

## Building for Production

To compile the CLI for production, run:

```bash
npm run build
```

This uses [Rolldown](https://github.com/rolldownjs/rolldown) with the SWC plugin to generate an optimized output in `dist/main.js`.  
The **SWC plugin** is specifically included to support **decorators**, required for Moost.

## CLI Usage

Once built, you can use the CLI as follows:

```bash
node ./dist/main.js <command> [options]
```

Example:

```bash
node ./dist/main.js hello world
```

Output:

```
Hello, world!
```

To use uppercase:

```bash
node ./dist/main.js hello world -u
```

Output:

```
HELLO, WORLD!
```

## Files Overview

- **`src/main.ts`** – Defines CLI commands using decorators.
- **`bin.js`** – CLI entry point with a shebang for execution.
- **`rolldown.config.ts`** – Build configuration (including SWC for decorators).
- **`package.json`** – Contains scripts, dependencies, and CLI entry configuration.

## Customization

- **Add New Commands:** Edit `src/main.ts` and use `@Cli`, `@Param`, `@CliOption`, etc.
- **Modify Help Options:** Adjust `.useHelp()` and `.useOptions()` in `main.ts`.
