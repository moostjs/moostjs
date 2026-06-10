# @moostjs/event-wf

Workflow event adapter for [Moost](https://moost.org), wrapping [@wooksjs/event-wf](https://github.com/wooksjs/wooksjs/tree/main/packages/event-wf) and [@prostojs/wf](https://github.com/prostojs/wf). Define workflow steps and flows using decorators, with full access to Moost's dependency injection, interceptors, and pipes.

## Installation

```bash
npm install @moostjs/event-wf
```

## Quick Start

```ts
import { MoostWf, Step, Workflow, WorkflowSchema, WorkflowParam } from '@moostjs/event-wf'
import { Controller, Moost } from 'moost'

@Controller()
class MyWorkflows {
  @Step('greet')
  greet(
    @WorkflowParam('context') ctx: { greeting: string },
    @WorkflowParam('input') input?: string,
  ) {
    ctx.greeting = `Hello, ${input}!`
  }

  @Workflow('my-flow')
  @WorkflowSchema(['greet'])
  myFlow() {}
}

const app = new Moost()
const wf = new MoostWf()
app.adapter(wf)
app.registerControllers(MyWorkflows)
await app.init()

// Start a workflow
const result = await wf.start('my-flow', { greeting: '' }, { input: 'World' })
console.log(result.state.context.greeting) // 'Hello, World!'
```

## AI Agent Skill

Install the unified Moost skill for AI coding agents (Claude Code, Cursor, etc.):

```bash
npx skills add moostjs/moostjs
```

## [Official Documentation](https://moost.org/wf/)

## License

MIT
