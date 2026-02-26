# Context & State

The workflow context is a typed object that holds shared state across all steps. Every step in a workflow reads from and writes to the same context, making it the central place for data to flow through your pipeline.

## Defining a Context Type

Start by defining a TypeScript interface for your workflow's data:

```ts
interface TOnboardingContext {
  userId: string
  email: string
  emailVerified: boolean
  profileComplete: boolean
  welcomeEmailSent: boolean
}
```

## Type-Safe Schemas

Pass your context type as a generic to `@WorkflowSchema<T>()`. This gives you type-checked conditions:

```ts
@Workflow('onboarding')
@WorkflowSchema<TOnboardingContext>([ // [!code focus]
  'verify-email',
  { condition: (ctx) => ctx.emailVerified, id: 'collect-profile' }, // [!code focus] ctx is typed
  { condition: (ctx) => ctx.profileComplete, id: 'send-welcome' },
])
onboarding() {}
```

The `ctx` parameter in condition functions is typed as `TOnboardingContext`, so you get autocompletion and compile-time checks.

## Providing Initial Context

When you start a workflow, pass the initial context object:

```ts
const result = await wf.start('onboarding', { // [!code focus]
  userId: 'usr-42',
  email: 'alice@example.com',
  emailVerified: false,
  profileComplete: false,
  welcomeEmailSent: false,
})
```

This object is passed to the first step and persists across all subsequent steps.

## Accessing Context in Steps

### Option 1: Class Property (FOR_EVENT scope)

When the controller is event-scoped, inject context as a class property. This is the cleanest approach when multiple steps in the same controller need context access:

```ts
@Injectable('FOR_EVENT') // [!code focus]
@Controller()
export class OnboardingController {
  @WorkflowParam('context') // [!code focus]
  ctx!: TOnboardingContext // [!code focus]

  @Step('verify-email')
  verifyEmail() {
    // send verification email...
    this.ctx.emailVerified = true // [!code focus]
  }

  @Step('collect-profile')
  collectProfile() {
    this.ctx.profileComplete = true // same ctx, different step
  }

  @Step('send-welcome')
  sendWelcome() {
    sendEmail(this.ctx.email, 'Welcome!')
    this.ctx.welcomeEmailSent = true
  }
}
```

### Option 2: Method Parameter

For singleton controllers (the default scope), inject context directly into step methods:

```ts
@Controller()
export class OnboardingSteps {
  @Step('verify-email')
  verifyEmail(@WorkflowParam('context') ctx: TOnboardingContext) { // [!code focus]
    ctx.emailVerified = true
  }

  @Step('collect-profile')
  collectProfile(@WorkflowParam('context') ctx: TOnboardingContext) {
    ctx.profileComplete = true
  }
}
```

::: info
Use method parameters when the controller is a singleton — class properties would be shared across concurrent workflow executions, causing data corruption. With `@Injectable('FOR_EVENT')`, each execution gets its own controller instance, making class properties safe.
:::

## Mutating Context

Context mutations in one step are visible to all subsequent steps. The context object is passed by reference:

```ts
@Step('step-a')
stepA(@WorkflowParam('context') ctx: TMyContext) {
  ctx.value = 42
}

@Step('step-b')
stepB(@WorkflowParam('context') ctx: TMyContext) {
  console.log(ctx.value) // 42 — set by step-a
}
```

## Reading Context from Output

After a workflow completes (or pauses), the context is available in the output:

```ts
const result = await wf.start('onboarding', initialContext)

console.log(result.state.context) // [!code focus]
// { userId: 'usr-42', email: 'alice@example.com', emailVerified: true, ... }
```

The `state.context` reflects all mutations made by the steps that executed.

## Typing MoostWf for Output

Type the `MoostWf` instance to get typed output:

```ts
@Controller()
export class AppController {
  constructor(
    private wf: MoostWf<TOnboardingContext>, // [!code focus]
  ) {}

  async startOnboarding(userId: string, email: string) {
    const result = await this.wf.start('onboarding', {
      userId,
      email,
      emailVerified: false,
      profileComplete: false,
      welcomeEmailSent: false,
    })
    // result.state.context is typed as TOnboardingContext
  }
}
```

The generic parameter flows through to `TFlowOutput`, so `result.state.context` is properly typed.
