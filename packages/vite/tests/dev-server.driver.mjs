// Driver for dev-server.spec.ts — starts a Vite dev server in a plain Node process, the
// way an app does, and reports what each kind of response carried. Two modes:
// - `plugin`: `vite` + `moostVite({ headers })` (inline config, like the `vite` CLI);
// - `server`: `createSSRServer()` from a `vite.config.mjs`, with `headers` and `use()`.
// Runs against the BUILT plugin (the fixture app must share the native `moost` /
// `@moostjs/event-http` instances with it): run `pnpm build vite` first.
// Emits one `__RESULT__ {json}` line on stdout.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.NODE_ENV = 'development'

const mode = process.argv[2] === 'server' ? 'server' : 'plugin'
const FIXTURE_ROOT = fileURLToPath(new URL(`fixture-tmp-dev-${mode}`, import.meta.url))
const PLUGIN_URL = new URL('../dist/index.mjs', import.meta.url).href
const SERVER_URL = new URL('../dist/prod-server.mjs', import.meta.url).href
const PORT = 25_123 + (process.pid % 500) + (mode === 'server' ? 500 : 0)

/** Headers of the plugin option; in `server` mode createSSRServer({ headers }) replaces them. */
const PLUGIN_HEADERS =
  mode === 'server'
    ? { 'x-plugin-only': '1', 'x-shared': 'base' }
    : { 'x-frame-options': 'DENY', 'x-shared': 'base' }
const SERVER_HEADERS = { 'x-frame-options': 'DENY', 'x-shared': 'base' }

const pluginOptions = {
  entry: './src/main.ts',
  middleware: true,
  prefix: '/api',
  ssrEntry: '/src/entry-server.ts',
  headers: PLUGIN_HEADERS,
}

const FIXTURE_FILES = {
  'index.html': `<!doctype html>
<html>
  <head><!--ssr-head--></head>
  <body>
    <div id="app"><!--ssr-outlet--></div>
    <!--ssr-state-->
    <script type="module" src="/src/ui/client.ts"></script>
  </body>
</html>
`,
  'public/robots.txt': 'User-agent: *\n',
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
`,
  'src/main.ts': `import { Controller, Moost } from 'moost'
import { Get, MoostHttp, SetHeader } from '@moostjs/event-http'

@Controller('api')
class ApiController {
  @Get('plain')
  plain() {
    return 'plain'
  }

  @Get('own')
  @SetHeader('x-shared', 'route')
  own() {
    return 'own'
  }
}

const app = new Moost()
app.adapter(new MoostHttp()).listen(3000)
app.registerControllers(ApiController)
void app.init()
`,
  'src/entry-server.ts': `export function render(url: string) {
  const nonce = 'ZGV2LW5vbmNl'
  return {
    html: '<main>PAGE ' + url + '</main>',
    state: '{"a":1}',
    nonce,
    headers: url === '/own' ? { 'x-shared': 'render' } : {},
  }
}
`,
  'src/ui/client.ts': `export const client = 'client_v1'
`,
  // read by createSSRServer() (server mode) from the working directory
  'vite.config.mjs': `import { moostVite } from ${JSON.stringify(PLUGIN_URL)}

export default {
  logLevel: 'error',
  server: { host: 'localhost', port: ${PORT} },
  html: { cspNonce: 'NONCE_PH' },
  ssr: { external: ['moost', '@moostjs/event-http'] },
  plugins: [moostVite(${JSON.stringify(pluginOptions)})],
}
`,
}

rmSync(FIXTURE_ROOT, { recursive: true, force: true })
for (const [rel, content] of Object.entries(FIXTURE_FILES)) {
  const abs = resolve(FIXTURE_ROOT, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

const HEADER_NAMES = ['x-frame-options', 'x-shared', 'x-plugin-only', 'x-mw']

let viteServer
let exitCode = 0
try {
  let baseUrl
  if (mode === 'plugin') {
    const { createServer } = await import('vite')
    const { moostVite } = await import(PLUGIN_URL)
    viteServer = await createServer({
      root: FIXTURE_ROOT,
      configFile: false,
      logLevel: 'error',
      server: { host: 'localhost', port: PORT },
      html: { cspNonce: 'NONCE_PH' },
      ssr: { external: ['moost', '@moostjs/event-http'] },
      plugins: [moostVite(pluginOptions)],
    })
    await viteServer.listen()
    baseUrl = `http://localhost:${viteServer.httpServer.address().port}`
  } else {
    process.chdir(FIXTURE_ROOT)
    const { createSSRServer } = await import(SERVER_URL)
    const app = await createSSRServer({ headers: SERVER_HEADERS })
    app.use((req, res, next) => {
      res.setHeader('x-mw', '1')
      if (req.url === '/robots.txt') {
        res.setHeader('x-shared', 'middleware')
      }
      if (req.url === '/mw-only') {
        res.end('MW')
        return
      }
      if (req.url === '/mw-error') {
        next(Object.assign(new Error('denied by middleware'), { status: 403 }))
        return
      }
      if (req.url === '/mw-throw') {
        throw new Error('middleware threw')
      }
      next()
    })
    // an async middleware whose promise rejects before it calls next()
    app.use(async (req, _res, next) => {
      if (req.url === '/mw-reject') {
        throw new Error('middleware rejected')
      }
      next()
    })
    const httpServer = await app.listen()
    baseUrl = `http://localhost:${httpServer.address().port}`
  }

  const probe = async (path) => {
    const res = await fetch(`${baseUrl}${path}`)
    const text = await res.text()
    const headers = {}
    for (const name of HEADER_NAMES) {
      const value = res.headers.get(name)
      if (value !== null) {
        headers[name] = value
      }
    }
    return { status: res.status, headers, text: text.slice(0, 2000) }
  }

  const report = {
    route: await probe('/api/plain'),
    routeOwn: await probe('/api/own'),
    page: await probe('/page'),
    pageOwn: await probe('/own'),
    publicFile: await probe('/robots.txt'),
    module: await probe('/src/ui/client.ts'),
    ...(mode === 'server'
      ? {
          mwOnly: await probe('/mw-only'),
          mwError: await probe('/mw-error'),
          mwThrow: await probe('/mw-throw'),
          mwReject: await probe('/mw-reject'),
          afterFailures: await probe('/api/plain'),
        }
      : {}),
  }
  console.log(`__RESULT__ ${JSON.stringify(report)}`)
} catch (error) {
  console.error(error)
  exitCode = 1
} finally {
  await viteServer?.close()
  rmSync(FIXTURE_ROOT, { recursive: true, force: true })
  // createSSRServer() in dev keeps its Vite watcher open: end the process here
  process.exit(exitCode)
}
