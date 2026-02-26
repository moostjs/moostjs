<div class="file-sep">health.controller.ts</div>

```ts
@Controller()
export class HealthController {
  @Get('health')
  health() { return 'ok' }
}
```

<div class="file-sep">main.ts</div>

```ts
@ImportController(HealthController)
class App extends Moost {
  @Get('hello/:name')
  hello(@Param('name') name: string) {
    return `Hello, ${name}!`
  }
}

const app = new App()
app.adapter(new MoostHttp()).listen(3000)
app.init()
```
