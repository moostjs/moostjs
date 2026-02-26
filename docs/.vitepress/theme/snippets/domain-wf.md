```ts
@Injectable('FOR_EVENT')
@Controller()
export class OnboardingWf {
  @WorkflowParam('context')
  ctx!: { name: string; approved?: boolean }

  @Workflow('onboard')
  @WorkflowSchema(['validate', 'review', 'welcome'])
  entry() {}

  @Step('validate')
  validate(@WorkflowParam('input') input: { name: string }) {
    this.ctx.name = input.name
  }

  @Step('review')
  review() {
    return { inputRequired: { fields: ['approved'] } }
  }

  @Step('welcome')
  welcome() {
    return `Welcome, ${this.ctx.name}!`
  }
}
```
