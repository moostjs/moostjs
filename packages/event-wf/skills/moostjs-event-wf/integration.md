# Integration — @moostjs/event-wf

> Triggering workflows from HTTP/CLI handlers, using Moost features in steps, and multi-adapter setup.

## Concepts

Workflow steps are regular Moost event handlers. The same interceptor, pipe, and DI mechanisms that work with HTTP and CLI handlers work with workflows. This page covers cross-event-type integration.

## Triggering Workflows from HTTP

```ts
import { Controller, Param } from 'moost'
import { Post, Body } from '@moostjs/event-http'
import { MoostWf } from '@moostjs/event-wf'

interface TTicketContext {
  ticketId: string
  description: string
  status: string
}

@Controller('tickets')
export class TicketController {
  constructor(private wf: MoostWf<TTicketContext>) {}

  @Post()
  async createTicket(@Body() body: { description: string }) {
    const result = await this.wf.start('support-ticket', {
      ticketId: generateId(),
      description: body.description,
      status: 'new',
    })
    return {
      ticketId: result.state.context.ticketId,
      finished: result.finished,
      inputRequired: result.inputRequired,
      state: result.finished ? undefined : result.state,
    }
  }

  @Post(':id/resume')
  async resumeTicket(
    @Param('id') id: string,
    @Body() body: { state: any, input: any },
  ) {
    const result = await this.wf.resume(body.state, body.input)
    return { ticketId: id, finished: result.finished }
  }
}
```

The workflow state is plain JSON — return it directly to clients or store in a database.

## Triggering Workflows from CLI

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
    @CliOption('dry-run', 'Simulate without applying') dryRun?: boolean,
  ) {
    const result = await this.wf.start('deploy', {
      environment: env,
      dryRun: !!dryRun,
    })
    return result.finished
      ? `Deployed to ${env} successfully`
      : `Deploy paused: ${JSON.stringify(result.inputRequired)}`
  }
}
```

## Multi-Adapter Setup

Register both adapters in a single application:

```ts
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { MoostWf } from '@moostjs/event-wf'

const app = new Moost()

app.adapter(new MoostHttp()).listen(3000)
app.adapter(new MoostWf())

app.registerControllers(
  TicketController,      // HTTP handlers
  TicketWfController,    // Workflow steps
).init()
```

## Interceptors on Workflow Steps

Use `@Intercept` for pre/post logic on steps:

```ts
import { Intercept } from 'moost'

@Controller()
export class TicketWfController {
  @Step('assign')
  @Intercept(LogStepExecution)
  assign(@WorkflowParam('context') ctx: TTicketContext) {
    ctx.assignee = findAvailableAgent()
  }
}
```

All interceptor priority levels work — guards, error handlers, `AFTER_ALL` cleanup. Global interceptors registered with Moost also apply to workflow steps.

## Pipes for Validation

Use `@Pipe` to transform or validate data flowing into steps:

```ts
import { Pipe } from 'moost'

@Step('process-data')
processData(
  @WorkflowParam('input')
  @Pipe(validateInput)
  input: TProcessInput,
) {
  // input is validated before reaching this point
}
```

## Dependency Injection

Workflow controllers support the same DI as the rest of Moost:

```ts
@Injectable('FOR_EVENT')
@Controller()
export class TicketWfController {
  constructor(
    private emailService: EmailService,
    private ticketRepo: TicketRepository,
  ) {}

  @Step('notify-assignee')
  async notifyAssignee(@WorkflowParam('context') ctx: TTicketContext) {
    await this.emailService.send(ctx.assignee!, `Ticket ${ctx.ticketId} assigned`)
  }

  @Step('save-ticket')
  async saveTicket(@WorkflowParam('context') ctx: TTicketContext) {
    await this.ticketRepo.update(ctx.ticketId, { status: ctx.status })
  }
}
```

## Accessing the Underlying WooksWf

For advanced scenarios:

```ts
const wf = new MoostWf()
const wooksWf = wf.getWfApp()
```

## Best Practices

- Inject `MoostWf` via constructor DI to use it from HTTP/CLI controllers — the adapter instance is registered in the DI container.
- Keep workflow controllers separate from HTTP/CLI controllers for clarity, even though they can be combined.
- Global interceptors apply to all event types uniformly — use `contextType` checks if you need event-type-specific behavior.

## Gotchas

- When using `MoostWf` from a constructor-injected service, ensure `app.init()` has been called before starting workflows — steps must be registered first.
- The adapter name is `'workflow'` (`wf.name === 'workflow'`).
