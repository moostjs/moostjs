# @moostjs/event-http

<p align="center">
<img src="../../moost-logo.png" width="450px"><br>
<a  href="https://github.com/moostjs/moostjs/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</a>
</p>

Welcome to `@moostjs/event-http`, a Moostjs library that serves as a wrapper for [@wooksjs/event-http](https://github.com/wooksjs/wooksjs/tree/main/packages/event-http). This package provides decorators for composing functions, thereby enhancing the simplicity and efficiency of your Moost application.

**Note:** As `@moostjs/event-http` is under active development, breaking changes can be expected.

## Overview

The `@moostjs/event-http` module plays a crucial role in making Moost apps receptive to HTTP events. By employing it in your project, you can create handlers for HTTP events in a declarative, structured manner.

## Getting Started

Starting a new Moost HTTP project is quite simple. All you need to do is run the following command:

```bash
npm create moost -- --http
```

You can also provide a name for your project:

```bash
npm create moost my-web-app -- --http
```

This command will initiate a setup tool that will guide you through the project initialization process. It will prompt you to configure:

- Project and package name.
- Whether to include a Moost Workflows example.
- Whether to add do-me-lint (smart eslint installer).

## Auth Guards

Declarative authentication guards with automatic Swagger/OpenAPI security scheme discovery.

### Functional API

```ts
import { Authenticate, defineAuthGuard, HttpError } from '@moostjs/event-http'

const jwtGuard = defineAuthGuard({ bearer: { format: 'JWT' } }, (transports) => {
  if (!transports.bearer) throw new HttpError(401, 'Missing token')
  // verify and return user info
})

@Authenticate(jwtGuard)
@Controller('users')
class UsersController { ... }
```

### Class-based API

```ts
import { AuthGuard, Authenticate, HttpError } from '@moostjs/event-http'
import { Injectable } from 'moost'

@Injectable()
class JwtGuard extends AuthGuard<{ bearer: { format: 'JWT' } }> {
  static transports = { bearer: { format: 'JWT' } } as const

  handle(transports: { bearer: string }) {
    if (!transports.bearer) throw new HttpError(401, 'Missing token')
  }
}

@Authenticate(JwtGuard)
@Controller('users')
class UsersController { ... }
```

Supported transports: `bearer`, `basic`, `apiKey` (header/query/cookie), `cookie`.

## [Official Documentation](https://moost.org/webapp/)

## AI Agent Skills

This package ships skills for AI coding agents (Claude Code, Cursor, Windsurf, Codex, OpenCode). After installing `@moostjs/event-http`, set up the skills:

```bash
# Project-local (recommended — version-locked, commits with your repo)
npx moostjs-event-http-skill

# Global (available across all your projects)
npx moostjs-event-http-skill --global
```

To auto-install skills on `npm install`, add to your `package.json`:

```json
{
  "scripts": {
    "postinstall": "moostjs-event-http-skill --postinstall"
  }
}
```

## Contributing

We are excited to welcome contributors who are passionate about improving Moostjs. No matter your level of experience, your unique perspective and skills can make valuable contributions to our growing community.

Here are some basic steps to get you started:

1. **Fork the Repo:** Navigate to [moostjs](https://github.com/moostjs/moostjs) and fork the repository to your own GitHub account.

2. **Clone the Repo:** Clone the forked repository to your local machine.

3. **Create a Branch:** Make a new branch for your feature or bug fix.

4. **Make your Changes:** Implement your feature or fix the bug and commit the changes to your branch.

5. **Make a Pull Request:** Navigate back to your forked repo and press the "New pull request" button.

Don't hesitate to ask for help if you need it. We believe in fostering a friendly and respectful environment for all contributors.

Thank you for your interest in Moostjs. We look forward to building something amazing together!
