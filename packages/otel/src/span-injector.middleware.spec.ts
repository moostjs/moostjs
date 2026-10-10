import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

import { context, ROOT_CONTEXT, SpanKind, trace } from '@opentelemetry/api'
import type { RPCMetadata } from '@opentelemetry/core'
import { getRPCMetadata, RPCType, setRPCMetadata } from '@opentelemetry/core'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { Get, MoostHttp } from '@moostjs/event-http'
import { Controller, Moost, replaceContextInjector, resetContextInjector } from 'moost'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { useOtelContext } from './context'
import { SpanInjector } from './span-injector'
import { AlsContextManager } from './tests/als-context-manager.artifacts'

/*
 * Moost mounted as a middleware of a host app. The span topology mirrors the real
 * instrumentations (verified against @opentelemetry/instrumentation-http 0.223 and
 * @opentelemetry/instrumentation-express 0.71 with Express 4):
 *  - instrumentation-http: a SERVER span plus the request's RPC metadata, active while the
 *    listener runs; when the response finishes it sets `http.route` from the RPC metadata and
 *    renames the span `{METHOD} {route}`;
 *  - instrumentation-express: each layer reports its mount route to the RPC metadata and runs
 *    under its own active INTERNAL span (`middleware - {name}`), ended on next() / close.
 */

const exporter = new InMemorySpanExporter()
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
const httpInstrumentation = provider.getTracer('fake-instrumentation-http')
const expressInstrumentation = provider.getTracer('fake-instrumentation-express')

type TReq = IncomingMessage & { originalUrl?: string }
interface TLayer {
  path?: string
  name: string
  handle: (req: TReq, res: ServerResponse, next: () => void) => unknown
}

let injector: SpanInjector
let recordMetric: ReturnType<typeof vi.spyOn>
let httpAdapter: MoostHttp

@Controller('users')
class UsersController {
  @Get(':id')
  getUser() {
    return { ok: true }
  }
}

function instrumentedListener(listener: (req: TReq, res: ServerResponse) => void) {
  return (req: TReq, res: ServerResponse) => {
    const span = httpInstrumentation.startSpan(req.method || 'GET', { kind: SpanKind.SERVER })
    const rpc: RPCMetadata = { type: RPCType.HTTP, span }
    res.on('finish', () => {
      if (rpc.route) {
        span.setAttribute('http.route', rpc.route)
        span.updateName(`${req.method} ${rpc.route}`)
      }
      span.end()
    })
    context.with(setRPCMetadata(trace.setSpan(ROOT_CONTEXT, span), rpc), () => listener(req, res))
  }
}

/** A tiny Express-like layer stack: a mounted layer sees `req.url` without its mount path. */
function hostApp(layers: TLayer[], instrumented: boolean) {
  return (req: TReq, res: ServerResponse) => {
    const originalUrl = req.url || '/'
    req.originalUrl = originalUrl
    const parentCtx = context.active()
    let i = 0
    const next = (): unknown => {
      while (i < layers.length) {
        const layer = layers[i++]
        if (layer.path && !originalUrl.startsWith(layer.path)) {
          continue
        }
        req.url = layer.path ? originalUrl.slice(layer.path.length) || '/' : originalUrl
        if (!instrumented) {
          return context.with(parentCtx, () => layer.handle(req, res, next))
        }
        getRPCMetadata(parentCtx)!.route = layer.path
        const span = expressInstrumentation.startSpan(`middleware - ${layer.name}`, {}, parentCtx)
        let ended = false
        const end = () => {
          if (!ended) {
            ended = true
            span.end()
          }
        }
        res.once('close', end)
        return context.with(trace.setSpan(parentCtx, span), () =>
          layer.handle(req, res, () => {
            end()
            return context.with(parentCtx, next)
          }),
        )
      }
      res.statusCode = 404
      res.end()
    }
    next()
  }
}

/** The way a host mounts Moost: requests no Moost route matches go on to the next layer. */
function moostLayer(path?: string): TLayer {
  const pending = new WeakMap<IncomingMessage, () => void>()
  const cb = httpAdapter.getServerCb((req) => pending.get(req)?.())
  return {
    path,
    name: 'moost',
    handle: (req, res, next) => {
      pending.set(req, next)
      return cb(req, res)
    },
  }
}

const hostLayers = (): TLayer[] => [
  {
    path: '/assets',
    name: 'assets',
    handle: (_req, res) => res.end('asset'),
  },
  {
    // an SSR render: runs in an HTTP context of the request, fetches API data in-process
    path: '/page',
    name: 'ssr',
    handle: async (req, res) => {
      const { result } = await httpAdapter.withHttpContext(req, res, async () => {
        const span = useOtelContext().getSpan()
        const data = await (await httpAdapter.request('/users/1'))!.json()
        return { data, span }
      })
      ssrRenderSpan = result.span
      res.end(JSON.stringify(result.data))
    },
  },
  {
    // a host route calling Moost in-process without an HTTP context of its own
    path: '/host-calls',
    name: 'host-calls',
    handle: async (_req, res) => {
      res.end(await (await httpAdapter.request('/users/1'))!.text())
    },
  },
]

let ssrRenderSpan: unknown

function spans() {
  return exporter.getFinishedSpans()
}
function spanNamed(name: string) {
  return spans().find((s) => s.name === name)
}
function serverSpans() {
  return spans().filter((s) => s.kind === SpanKind.SERVER)
}
function moostSpans() {
  return spans().filter((s) => s.instrumentationScope.name === 'moost-tracer')
}
function parentId(span: ReadableSpan) {
  return span.parentSpanContext?.spanId
}

const servers: Server[] = []
const bases: Record<'express' | 'expressApi' | 'connect' | 'bare', string> = {
  express: '',
  expressApi: '',
  connect: '',
  bare: '',
}

async function listen(listener: (req: TReq, res: ServerResponse) => void) {
  const server = createServer(listener)
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`
}

/** Waits until the request's root span is exported: SERVER when instrumented. */
async function request(url: string, root = (s: ReadableSpan) => s.kind === SpanKind.SERVER) {
  const res = await fetch(url)
  const body = await res.text()
  await vi.waitFor(() => expect(spans().some(root)).toBe(true))
  return { status: res.status, body }
}

describe('SpanInjector — Moost as middleware of a host app', () => {
  beforeAll(async () => {
    context.setGlobalContextManager(new AlsContextManager())
    trace.setGlobalTracerProvider(provider)
    injector = new SpanInjector()
    recordMetric = vi.spyOn(injector.metrics.moostEventDuration, 'record')
    replaceContextInjector(injector)

    const app = new Moost()
    httpAdapter = new MoostHttp()
    app.adapter(httpAdapter)
    app.registerControllers(UsersController)
    await app.init()

    bases.express = await listen(
      instrumentedListener(hostApp([moostLayer(), ...hostLayers()], true)),
    )
    bases.expressApi = await listen(
      instrumentedListener(hostApp([moostLayer('/api'), ...hostLayers()], true)),
    )
    bases.connect = await listen(
      instrumentedListener(hostApp([moostLayer(), ...hostLayers()], false)),
    )
    bases.bare = await listen(hostApp([moostLayer(), ...hostLayers()], false))
  })

  afterEach(() => {
    exporter.reset()
    recordMetric.mockClear()
    ssrRenderSpan = undefined
  })

  afterAll(async () => {
    resetContextInjector()
    await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))))
    trace.disable()
    context.disable()
  })

  describe('with http + express instrumentation (host middleware span active)', () => {
    it('attaches to the server span through the host middleware span: route, name, attributes', async () => {
      const { status } = await request(`${bases.express}/users/42`)
      expect(status).toBe(200)
      // one SERVER span — the instrumentation's — named and routed by Moost
      expect(serverSpans()).toHaveLength(1)
      const root = serverSpans()[0]
      expect(root.instrumentationScope.name).toBe('fake-instrumentation-http')
      expect(root.name).toBe('GET /users/:id')
      expect(root.attributes).toMatchObject({
        'http.route': '/users/:id',
        'moost.route': '/users/:id',
        'moost.handler': 'getUser',
        'moost.event_type': 'http',
      })
      // no event span of Moost's own next to it
      expect(moostSpans().filter((s) => !s.name.includes(':'))).toHaveLength(0)
      // Moost's spans nest under the host middleware that ran Moost
      const middleware = spanNamed('middleware - moost')!
      expect(parentId(middleware)).toBe(root.spanContext().spanId)
      const handler = moostSpans().find((s) => s.name.startsWith('Handler:'))!
      expect(parentId(handler)).toBe(middleware.spanContext().spanId)
      await vi.waitFor(() => expect(recordMetric).toHaveBeenCalledTimes(1))
      expect(recordMetric.mock.calls[0][1]).toMatchObject({
        route: '/users/:id',
        'http.status_code': 200,
        'moost.is_error': 0,
      })
    })

    it('prefixes the route with the mount path the host stripped from the URL', async () => {
      const { status } = await request(`${bases.expressApi}/api/users/42`)
      expect(status).toBe(200)
      const root = serverSpans()[0]
      expect(root.name).toBe('GET /api/users/:id')
      expect(root.attributes['http.route']).toBe('/api/users/:id')
      expect(root.attributes['moost.route']).toBe('/users/:id')
    })

    it('a request the host serves never touches tracing: no Moost span, name or metric', async () => {
      const { status, body } = await request(`${bases.express}/assets/app.js`)
      expect(status).toBe(200)
      expect(body).toBe('asset')
      expect(moostSpans()).toHaveLength(0)
      const root = serverSpans()[0]
      expect(root.name).toBe('GET /assets')
      expect(root.attributes['moost.event_type']).toBeUndefined()
      expect(recordMetric).not.toHaveBeenCalled()
    })

    it('a host route calling Moost in-process gets an INTERNAL span — never the server span', async () => {
      const { body } = await request(`${bases.express}/host-calls`)
      expect(JSON.parse(body)).toEqual({ ok: true })
      const root = serverSpans()[0]
      expect(root.name).toBe('GET /host-calls')
      expect(root.attributes['moost.route']).toBeUndefined()
      const inner = spanNamed('GET /users/:id')!
      expect(inner.instrumentationScope.name).toBe('moost-tracer')
      expect(inner.kind).toBe(SpanKind.INTERNAL)
      expect(parentId(inner)).toBe(spanNamed('middleware - host-calls')!.spanContext().spanId)
    })
  })

  describe('with http instrumentation only (server span active)', () => {
    it('attaches to the server span and reports the route', async () => {
      await request(`${bases.connect}/users/42`)
      expect(serverSpans()).toHaveLength(1)
      const root = serverSpans()[0]
      expect(root.instrumentationScope.name).toBe('fake-instrumentation-http')
      expect(root.name).toBe('GET /users/:id')
      expect(root.attributes['http.route']).toBe('/users/:id')
      const handler = moostSpans().find((s) => s.name.startsWith('Handler:'))!
      expect(parentId(handler)).toBe(root.spanContext().spanId)
    })

    it('a request the host serves leaves the server span unclaimed — an SSR render attaches to it', async () => {
      const { body } = await request(`${bases.connect}/page`)
      expect(JSON.parse(body)).toEqual({ ok: true })
      const root = serverSpans()[0]
      expect(root.name).toBe('GET') // nothing named it after a route
      expect(ssrRenderSpan).toBeDefined()
      expect(
        (ssrRenderSpan as { spanContext: () => { spanId: string } }).spanContext().spanId,
      ).toBe(root.spanContext().spanId)
      // the render's in-process API fetch is an INTERNAL child, not a second server span
      const inner = spanNamed('GET /users/:id')!
      expect(inner.kind).toBe(SpanKind.INTERNAL)
      expect(parentId(inner)).toBe(root.spanContext().spanId)
      expect(serverSpans()).toHaveLength(1)
      // the render never routes: only the API fetch records a metric
      await vi.waitFor(() => expect(recordMetric).toHaveBeenCalled())
      expect(recordMetric.mock.calls.map((c) => (c[1] as { route?: string }).route)).toEqual([
        '/users/:id',
      ])
    })

    it('a host route calling Moost in-process never claims the active server span', async () => {
      await request(`${bases.connect}/host-calls`)
      const root = serverSpans()[0]
      expect(root.name).toBe('GET')
      expect(root.attributes['moost.route']).toBeUndefined()
      const inner = spanNamed('GET /users/:id')!
      expect(inner.instrumentationScope.name).toBe('moost-tracer')
      expect(inner.kind).toBe(SpanKind.INTERNAL)
      expect(parentId(inner)).toBe(root.spanContext().spanId)
    })
  })

  describe('without http instrumentation', () => {
    it('Moost starts its own SERVER root span for a request it serves', async () => {
      await request(`${bases.bare}/users/42`)
      const root = serverSpans()[0]
      expect(root.instrumentationScope.name).toBe('moost-tracer')
      expect(root.name).toBe('GET /users/:id')
      expect(root.attributes['http.route']).toBe('/users/:id')
      expect(parentId(root)).toBeUndefined()
    })

    it('a request the host serves produces no span and no metric', async () => {
      const res = await fetch(`${bases.bare}/assets/app.js`)
      expect(await res.text()).toBe('asset')
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(spans()).toHaveLength(0)
      expect(recordMetric).not.toHaveBeenCalled()
    })

    it('an SSR render of a host-served page is named after the method', async () => {
      await request(`${bases.bare}/page`, (s) => s.name === 'GET')
      const root = spanNamed('GET')!
      expect(root.kind).toBe(SpanKind.SERVER)
      expect(root.instrumentationScope.name).toBe('moost-tracer')
      expect(parentId(spanNamed('GET /users/:id')!)).toBe(root.spanContext().spanId)
    })
  })
})
