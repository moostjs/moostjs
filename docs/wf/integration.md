# Integration

Workflow steps are regular Moost event handlers — the same interceptor, pipe, and dependency injection mechanisms that work with HTTP and CLI handlers work with workflows too. This page covers how to trigger workflows from other event types and how to use Moost's features within workflow steps.

## Triggering Workflows from HTTP

The most common pattern is starting a workflow from an HTTP handler and returning the result to the client:

```ts
import { Controller, Param } from 'moost'
import { Get, Post, Body } from '@moostjs/event-http'
import { MoostWf } from '@moostjs/event-wf'

interface TTicketContext {
  ticketId: string
  description: string
  status: string
  assignee?: string
}

@Controller('tickets')
export class TicketController {
  constructor(
    private wf: MoostWf<TTicketContext>,
  ) {}

  @Post() // [!code focus]
  async createTicket(@Body() body: { description: string }) { // [!code focus]
    const result = await this.wf.start('support-ticket', { // [!code focus]
      ticketId: generateId(),
      description: body.description,
      status: 'new',
    })
    return {
      ticketId: result.state.context.ticketId,
      status: result.state.context.status,
      finished: result.finished,
      inputRequired: result.inputRequired,
      state: result.finished ? undefined : result.state,
    }
  }

  @Post(':id/resume') // [!code focus]
  async resumeTicket(
    @Param('id') id: string,
    @Body() body: { state: any, input: any },
  ) {
    const result = await this.wf.resume(body.state, body.input) // [!code focus]
    return {
      ticketId: id,
      status: result.state.context.status,
      finished: result.finished,
    }
  }
}
```

::: info
The workflow state (`result.state`) is plain JSON. You can return it directly to the client or store it in a database for later resumption.
:::

## Triggering Workflows from CLI

Similarly, you can start workflows from CLI commands:

```ts
import { Controller } from 'moost'
import { Cli, CliOption } from '@moostjs/event-cli'
import { MoostWf } from '@moostjs/event-wf'

@Controller()
export class DeployCommand {
  constructor(private wf: MoostWf) {}

  @Cli('deploy :env')
  async deploy(
    @Param('env') env: string,
    @CliOption('dry-run', 'Simulate without applying changes')
    dryRun?: boolean,
  ) {
    const result = await this.wf.start('deploy', {
      environment: env,
      dryRun: !!dryRun,
      steps: [],
    })
    return result.finished
      ? `Deployed to ${env} successfully`
      : `Deploy paused: ${JSON.stringify(result.inputRequired)}`
  }
}
```

## Using Multiple Adapters Together

Register both adapters to combine HTTP and workflow capabilities in a single application:

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { MoostWf } from '@moostjs/event-wf'

const app = new Moost()

app.adapter(new MoostHttp()).listen(3000)
app.adapter(new MoostWf())

app.registerControllers(
  TicketController,     // HTTP handlers
  TicketWfController,   // Workflow steps
).init()
```

## Interceptors on Workflow Steps

Since workflow steps are event handlers, you can use `@Intercept` to add pre/post logic:

```ts
import { Intercept } from 'moost'

@Controller()
export class TicketWfController {
  @Step('assign')
  @Intercept(LogStepExecution) // [!code focus]
  assign(@WorkflowParam('context') ctx: TTicketContext) {
    ctx.assignee = findAvailableAgent()
    ctx.status = 'assigned'
  }
}
```

This works with all interceptor priority levels — guards, error handlers, and `AFTER_ALL` cleanup hooks.

::: info
Global interceptors registered with Moost also apply to workflow steps. This means your authentication guards, logging interceptors, and error handlers work across HTTP, CLI, and workflow events uniformly.
:::

## Pipes for Validation

Use `@Pipe` to transform or validate data flowing into workflow steps:

```ts
import { Pipe } from 'moost'

@Step('process-data')
processData(
  @WorkflowParam('input')
  @Pipe(validateInput) // [!code focus]
  input: TProcessInput,
) {
  // input is validated before reaching this point
}
```

## Dependency Injection

Workflow controllers support the same DI as the rest of Moost. Inject services via constructors:

```ts
@Injectable('FOR_EVENT')
@Controller()
export class TicketWfController {
  constructor(
    private emailService: EmailService, // [!code focus]
    private ticketRepo: TicketRepository, // [!code focus]
  ) {}

  @Step('notify-assignee')
  async notifyAssignee(@WorkflowParam('context') ctx: TTicketContext) {
    await this.emailService.send(ctx.assignee!, `Ticket ${ctx.ticketId} assigned to you`)
  }

  @Step('save-ticket')
  async saveTicket(@WorkflowParam('context') ctx: TTicketContext) {
    await this.ticketRepo.update(ctx.ticketId, { status: ctx.status })
  }
}
```

## Accessing the Underlying WooksWf Instance

For advanced scenarios, access the raw `WooksWf` instance:

```ts
const wf = new MoostWf()
const wooksWf = wf.getWfApp() // [!code focus]
```

This gives you direct access to the low-level workflow engine from `@wooksjs/event-wf`.
