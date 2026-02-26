```ts
@Controller()
export class Commands {
  @Cli('deploy/:env')
  deploy(
    @Param('env') env: string,
    @CliOption('verbose', 'v') verbose: boolean,
  ) {
    if (verbose) console.log(`Target: ${env}`)
    return `Deploying to ${env}...`
  }
}
```
