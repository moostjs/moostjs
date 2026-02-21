# @moostjs/arbac

Advanced Role-Based Access Control (ARBAC) integration for MoostJS, enabling seamless authorization management with `@prostojs/arbac` while leveraging Moost's dependency injection and metadata-driven event processing capabilities.

## Features

- **MoostJS Integration** – Provides decorators and utilities for enforcing access control.
- **Role & Scope-Based Authorization** – Supports fine-grained access control based on user roles and attributes.
- **Dependency Injection Support** – Utilizes MoostJS's DI system for injecting ARBAC services.
- **Easy Decorators** – Define resource-based access rules with simple decorators.

## Installation

```sh
npm install @moostjs/arbac
```

or using pnpm:

```sh
pnpm i @moostjs/arbac
```

## Quick Start

### Setup `MoostArbac`

To integrate ARBAC into your MoostJS application, define an instance of `MoostArbac`, register roles, and provide it as a dependency.

```typescript
import { createProvideRegistry } from 'moost'
import { MoostArbac } from '@moostjs/arbac'
import * as roles from './roles'
import type { TRoleScope, TUserAttrs } from './types'

export const ArbacProvideRegistry = createProvideRegistry([
  MoostArbac,
  () => {
    const instance = new MoostArbac<TUserAttrs, TRoleScope>()
    for (const role of roles) {
      instance.registerRole(role)
    }
    return instance
  },
])
```

### Define a Custom User Provider

To integrate user attributes and roles dynamically, replace the generic `ArbacUserProvider` with an application-specific implementation.

```typescript
import { createReplaceRegistry } from 'moost'
import { ArbacUserProvider } from '@moostjs/arbac'
import { CustomUserProvider } from './custom-user-provider'

export const ArbacReplaceRegistry = createReplaceRegistry([ArbacUserProvider, CustomUserProvider])
```

### Register ARBAC in Moost Application

```typescript
import { App } from 'moost'
import { ArbacProvideRegistry, ArbacReplaceRegistry } from './arbac-setup'

const app = new App()
app.setProvideRegistry(ArbacProvideRegistry)
app.setReplaceRegistry(ArbacReplaceRegistry)
```

### Protect Routes with `@Authorized()`

```typescript
import { ArbacAuthorize, ArbacPublic } from '@moostjs/arbac'
import { Controller, Get } from 'moost'

@Controller('/data')
@ArbacAuthorize()
export class DataController {
  @Get()
  getProtectedData() {
    return { data: 'secured' }
  }

  @Get('/public')
  @ArbacPublic()
  getPublicData() {
    return { data: 'open' }
  }
}
```

## API

### `MoostArbac<TUserAttrs, TScope>`

Extends `@prostojs/arbac` and integrates with MoostJS DI.

### `ArbacUserProvider<TUserAttrs>`

Abstract class for defining user-related access control logic.

### `@ArbacAuthorize()`

Method decorator to enforce ARBAC checks.

### `@ArbacPublic()`

Marks a route as publicly accessible, bypassing authorization.

### `useArbac()`

Composable function for evaluating access control dynamically.

## License

MIT
