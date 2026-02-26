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
  greet(@WorkflowParam('input') input: string) {
    return `Hello, ${input}!`
  }

  @Workflow('my-flow')
  @WorkflowSchema([{ step: 'greet' }])
  myFlow() {}
}

const app = new Moost()
const wf = new MoostWf()
app.adapter(wf).controllers(MyWorkflows).init()

// Start a workflow
const result = await wf.start('my-flow', {}, 'World')
```

## AI Agent Skills

This package includes skill files for AI coding agents (Claude Code, Cursor, Windsurf, Codex, OpenCode). Install them to give your agent deep knowledge of the `@moostjs/event-wf` API:

```bash
# Project-local (recommended — version-locked, commits with your repo)
npx moostjs-event-wf-skill

# Global (available across all your projects)
npx moostjs-event-wf-skill --global
```

To auto-install on `npm install`, add a postinstall script to your `package.json`:

```json
{
  "scripts": {
    "postinstall": "moostjs-event-wf-skill --postinstall"
  }
}
```

## [Official Documentation](https://moost.org/wf/)

## License

MIT
