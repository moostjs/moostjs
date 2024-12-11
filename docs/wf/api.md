# Moost Workflows API Reference

This API reference details the workflow decorators available in Moost, their purposes, usage patterns.

[[toc]]

## Workflow Decorators

Moost provides a set of decorators to define workflows, steps, and workflow parameters.

### Class-Level Decorators

Class-level decorators are used to define workflows within controller classes. They act as entry points for initiating and managing workflows.

#### `@Workflow(path?: string)`

**Description:**  
Marks a method as a workflow entry point. This decorator associates the method with a specific workflow path, enabling the Moost framework to recognize and manage the workflow.

**Parameters:**

- `path` _(optional)_: A string specifying the workflow path. If omitted, the workflow defaults to a base path.

**Usage:**

```ts
import { Workflow, WorkflowSchema } from '@moostjs/event-fw';
import { Controller } from 'moost';

@Controller('auth')
export class AuthController {
  
  @Workflow('invite')
  @WorkflowSchema([
    'prepare-available-roles',
    'email-form',
    'pre-create-user',
    'transport-email/email/invite',
    'check-pending-invitation',
    'set-email-confirmed',
    'prepare-password-rules',
    'create-password-form',
    'unset-pending-invitation',
    'activate-user',
    'registration-confirmation',
  ])
  inviteFlow() {
    // Entry point for the 'invite' workflow
  }
}
```

### Method-Level Decorators

Method-level decorators define individual steps within a workflow. Each step represents a discrete action or task that the workflow executes.

#### `@Step(path?: string)`

**Description:**  
Marks a method as a workflow step. This decorator associates the method with a specific step path within a workflow, allowing the workflow engine to execute it as part of the workflow sequence.

**Parameters:**

- `path` _(optional)_: A string specifying the step path. If omitted, the step defaults to the method's name.

**Usage:**

```ts
import { Step, WorkflowParam } from '@moostjs/event-fw';
import { Controller } from 'moost';

@Controller('auth')
export class AuthController {

  @Step('prepare-available-roles')
  async prepareAvailableRoles() {
    // Logic to prepare available roles
  }

  @Step('email-form')
  async emailForm(@WorkflowParam('input') data: any) {
    // Logic to handle email form input
  }
}
```

### Parameter Decorators

Parameter decorators inject specific workflow-related parameters into step methods, providing access to workflow state, context, and input data.

#### `@WorkflowParam(name: 'resume' | 'indexes' | 'schemaId' | 'stepId' | 'context' | 'input' | 'state')`

**Description:**  
Injects workflow parameters into a method's parameters. These parameters provide access to various aspects of the workflow's state and context.

**Parameters:**

- `name`: A string literal specifying the workflow parameter to inject. Allowed values are:
  - `'resume'`: A function to resume the workflow.
  - `'indexes'`: The current step indexes in the workflow.
  - `'schemaId'`: The identifier of the workflow schema.
  - `'stepId'`: The identifier of the current step.
  - `'context'`: The workflow's context object.
  - `'input'`: The input provided to the workflow.
  - `'state'`: The overall state of the workflow.

**Usage:**

```ts
import { Step, WorkflowParam } from '@moostjs/event-fw';
import { Controller } from 'moost';

@Controller('auth')
export class AuthController {

  @Step('read-invited-user')
  async readInvitedUser(@WorkflowParam('input') email: string) {
    // Logic to read the invited user based on email
  }

  @Step('set-email-confirmed')
  async setEmailConfirmed(@WorkflowParam('context') ctx: any) {
    // Logic to set email as confirmed in context
  }
}
```

## Utility Functions

In addition to decorators, Moost provides utility functions to interact with the workflow system programmatically.

### `useWfState()`

**Description:**  
Retrieves the current workflow state within a step method. This function is useful for accessing and modifying the workflow's state.

**Usage:**

```ts
import { Step, WorkflowParam, useWfState } from '@moostjs/event-fw';
import { Controller } from 'moost';

@Controller('auth')
export class AuthController {

  @Step('example-step')
  async exampleStep() {
    const state = useWfState();
    state.someProperty = 'newValue';
  }
}
```

### `redirectWfToEmail(target: string, template: string, context: TInviteEmailContext)`

**Description:**  
Redirects the workflow to send an email using a specified template and context. This function integrates email sending within the workflow steps.

**Parameters:**

- `target`: The email address to send the email to.
- `template`: The identifier of the email template to use.
- `context`: An object containing context data for the email template.

**Usage:**

```ts
import { Step, WorkflowParam, redirectWfToEmail } from '@moostjs/event-fw';
import { Controller } from 'moost';

@Controller('auth')
export class AuthController {

  @Step('send-invite-email')
  async sendInviteEmail(@WorkflowParam('context') ctx: any) {
    return redirectWfToEmail(ctx.email, 'invite-template', {
      name: ctx.firstName,
      // Additional context data
    });
  }
}
```


