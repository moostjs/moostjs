# create-moost

<p align="center">
<img src="../../moost-logo.png" width="450px"><br>
<a  href="https://github.com/moostjs/moostjs/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

`create-moost` is an npm initializer that scaffolds new Moost applications. It supports four project types: HTTP (Web) application, Vue + Moost (SSR/SPA), WebSocket application, and CLI application.

## Getting Started

Make sure you have Node.js 20.19+ (or 22.12+) installed — the scaffolded projects rely on Vite/Rolldown, which require it. Then run:

```bash
npm create moost
```

Without flags the CLI runs in interactive mode: it prompts for the project name, the Moost adapter (HTTP, Vue + Moost SSR/SPA, WebSocket, or CLI), and the type-specific options below.

You can pass a project name and a type flag to skip the corresponding prompts:

```bash
npm create moost my-app -- --http
```

### Flags

| Flag      | Effect                                                            |
| --------- | ----------------------------------------------------------------- |
| `--http`  | Scaffold an HTTP (Web) application                                |
| `--ssr`   | Scaffold a Vue + Moost (SSR/SPA) application                      |
| `--ws`    | Scaffold a WebSocket application (with `--http`: add WebSockets to the HTTP app) |
| `--cli`   | Scaffold a CLI application                                        |
| `--wf`    | Include the Moost Workflows example (applied to HTTP projects)    |
| `--oxc`   | Add OXC lint and formatter (oxlint + oxfmt)                       |
| `--force` | Overwrite a non-empty target directory without asking             |

### Prompts

Depending on the chosen project type, the CLI asks:

- **Project name** and **package name** — skipped when a valid name is passed as an argument
- **Enable SSR (Server-Side Rendering)?** — `ssr` projects only (answering No produces an SPA-only setup); skipped when `--ssr` is passed
- **Add WebSockets?** — `http` projects only; skipped when `--ws` is passed
- **Add Moost Workflows Example?** — skipped for `cli` and `ws` projects, and when `--wf` is passed
- **Add OXC lint and formatter (oxlint + oxfmt)?** — asked for every project type unless `--oxc` is passed

Each flag pre-selects its answer and skips the matching prompt, so passing all relevant flags scaffolds fully non-interactively, e.g. `npm create moost my-app -- --http --ws --wf --oxc --force`.

After scaffolding, the CLI prints the next steps (install dependencies and start the dev server).

## [Official Documentation](https://moost.org/)
