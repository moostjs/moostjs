# @moostjs/vite

Vite dev plugin for [Moost](https://moost.org). Enables hot module replacement for Moost HTTP applications during development, automatic adapter detection, and production build configuration.

## Installation

```bash
npm install @moostjs/vite --save-dev
```

## Quick Start

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { moostVite } from '@moostjs/vite'

export default defineConfig({
  plugins: [
    moostVite({
      entry: './src/main.ts',
      port: 3000,
    }),
  ],
})
```

## Options

| Option      | Type                | Default       | Description                       |
| ----------- | ------------------- | ------------- | --------------------------------- |
| `entry`     | `string`            | —             | Application entry file (required) |
| `port`      | `number`            | `3000`        | Dev server port                   |
| `host`      | `string`            | `'localhost'` | Dev server host                   |
| `outDir`    | `string`            | `'dist'`      | Build output directory            |
| `format`    | `'cjs' \| 'esm'`    | `'esm'`       | Output module format              |
| `sourcemap` | `boolean`           | `true`        | Generate source maps              |
| `externals` | `boolean \| object` | `true`        | Configure external dependencies   |

## License

MIT
