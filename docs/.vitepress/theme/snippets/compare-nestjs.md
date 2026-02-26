<div class="file-sep">health.controller.ts</div>

```ts
@Controller()
export class HealthController {
  @Get('health')
  health() { return 'ok' }
}
```

<div class="file-sep">health.module.ts</div>

```ts
@Module({ controllers: [HealthController] })
export class HealthModule {}
```

<div class="file-sep">app.controller.ts</div>

```ts
@Controller()
export class AppController {
  @Get('hello/:name')
  hello(@Param('name') name: string) {
    return `Hello, ${name}!`
  }
}
```

<div class="file-sep">app.module.ts</div>

```ts
@Module({
  imports: [HealthModule],
  controllers: [AppController],
})
export class AppModule {}
```

<div class="file-sep">main.ts</div>

```ts
const app = await NestFactory.create(AppModule)
await app.listen(3000)
```
