import { AsyncLocalStorage } from 'node:async_hooks'
import { createServer } from 'node:http'
import type { Server } from 'node:http'

import type { Context, ContextManager, Span } from '@opentelemetry/api'
import { context, ROOT_CONTEXT, SpanKind, trace } from '@opentelemetry/api'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import { Get, MoostHttp } from '@moostjs/event-http'
import { defineEventKind } from '@wooksjs/event-core'
import {
  Controller,
  createEventContext,
  Moost,
  replaceContextInjector,
  resetContextInjector,
  setControllerContext,
} from 'moost'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { useOtelContext } from './context'
import { SpanInjector } from './span-injector'

/** Minimal AsyncLocalStorage context manager (what `@opentelemetry/context-async-hooks` provides). */
class AlsContextManager implements ContextManager {
  private als = new AsyncLocalStorage<Context>()
  active() {
    return this.als.getStore() ?? ROOT_CONTEXT
  }
  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    ctx: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    return this.als.run(ctx, () => fn.apply(thisArg, args))
  }
  bind<T>(_ctx: Context, target: T): T {
    return target
  }
  enable() {
    return this
  }
  disable() {
    this.als.disable()
    return this
  }
}

const exporter = new InMemorySpanExporter()
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
const instrumentationTracer = provider.getTracer('fake-instrumentation-http')
const logger = { info() {}, warn() {}, error() {}, debug() {}, log() {} }

let injector: SpanInjector
let recordMetric: ReturnType<typeof vi.spyOn>
let httpAdapter: MoostHttp

@Controller('users')
class UsersController {
  @Get(':id')
  getUser() {
    return { ok: true }
  }

  @Get('nested/:id')
  async nested() {
    const res = await httpAdapter.getHttpApp().request('/users/inner')
    return { inner: (await res!.json()) as unknown }
  }
}

function spanNamed(name: string) {
  return exporter.getFinishedSpans().find((s) => s.name === name)
}

function parentId(span: ReadableSpan) {
  return span.parentSpanContext?.spanId
}

/** Waits until the span with this name is exported (the server span ends on 'finish'). */
async function waitForSpan(name: string) {
  for (let i = 0; i < 50 && !spanNamed(name); i++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return spanNamed(name)
}

describe('SpanInjector — HTTP events', () => {
  let instrumented: Server
  let bare: Server
  let instrumentedBase: string
  let bareBase: string

  beforeAll(async () => {
    context.setGlobalContextManager(new AlsContextManager())
    trace.setGlobalTracerProvider(provider)
    injector = new SpanInjector()
    recordMetric = vi.spyOn(injector.metrics.moostEventDuration, 'record')
    replaceContextInjector(injector)

    const app = new Moost()
    const http = new MoostHttp()
    httpAdapter = http
    app.adapter(http)
    app.registerControllers(UsersController)
    await app.init()
    const cb = http.getServerCb()

    // mimics @opentelemetry/instrumentation-http: a SERVER span named after the method,
    // active while the request listener runs, ended when the response finishes
    instrumented = createServer((req, res) => {
      const span = instrumentationTracer.startSpan(req.method || 'GET', { kind: SpanKind.SERVER })
      res.on('finish', () => span.end())
      context.with(trace.setSpan(ROOT_CONTEXT, span), () => cb(req, res))
    })
    bare = createServer(cb)
    await Promise.all([
      new Promise<void>((resolve) => instrumented.listen(0, resolve)),
      new Promise<void>((resolve) => bare.listen(0, resolve)),
    ])
    instrumentedBase = `http://127.0.0.1:${(instrumented.address() as { port: number }).port}`
    bareBase = `http://127.0.0.1:${(bare.address() as { port: number }).port}`
  })

  afterEach(() => {
    exporter.reset()
    recordMetric.mockClear()
  })

  afterAll(async () => {
    resetContextInjector()
    await Promise.all([
      new Promise((resolve) => instrumented.close(resolve)),
      new Promise((resolve) => bare.close(resolve)),
    ])
    trace.disable()
    context.disable()
  })

  it('attaches to the http instrumentation server span: renames it and sets moost attributes', async () => {
    const res = await fetch(`${instrumentedBase}/users/42`)
    expect(res.status).toBe(200)
    const root = await waitForSpan('GET /users/:id')
    expect(root).toBeDefined()
    expect(root!.kind).toBe(SpanKind.SERVER)
    expect(root!.instrumentationScope.name).toBe('fake-instrumentation-http')
    expect(root!.attributes).toMatchObject({
      'moost.controller': 'UsersController',
      'moost.handler': 'getUser',
      'moost.route': '/users/:id',
      'moost.event_type': 'http',
    })
    const spans = exporter.getFinishedSpans()
    // no duplicate event span next to the instrumentation's
    expect(spans.filter((s) => s.name.endsWith(' Event'))).toHaveLength(0)
    expect(spans.filter((s) => s.kind === SpanKind.SERVER)).toHaveLength(1)
    // lifecycle spans are children of the attached span
    const handler = spans.find((s) => s.name.startsWith('Handler:'))
    expect(handler).toBeDefined()
    expect(handler!.spanContext().traceId).toBe(root!.spanContext().traceId)
    expect(parentId(handler!)).toBe(root!.spanContext().spanId)
  })

  it('records the response status in the HTTP event metrics', async () => {
    await fetch(`${instrumentedBase}/users/42`)
    await waitForSpan('GET /users/:id')
    await vi.waitFor(() => expect(recordMetric).toHaveBeenCalled())
    expect(recordMetric.mock.calls[0][1]).toMatchObject({
      'moost.event_type': 'http',
      'http.status_code': 200,
      'moost.is_error': 0,
    })
  })

  it('renames the attached span to the raw URL when no route matched', async () => {
    const res = await fetch(`${instrumentedBase}/nope`)
    expect(res.status).toBe(404)
    const root = await waitForSpan('GET /nope')
    expect(root).toBeDefined()
    expect(root!.instrumentationScope.name).toBe('fake-instrumentation-http')
    await vi.waitFor(() => expect(recordMetric).toHaveBeenCalled())
    expect(recordMetric.mock.calls[0][1]).toMatchObject({
      'http.status_code': 404,
      'moost.is_error': 1,
    })
  })

  it('creates its own SERVER root span when no http instrumentation span is active', async () => {
    const res = await fetch(`${bareBase}/users/7`)
    expect(res.status).toBe(200)
    const root = await waitForSpan('GET /users/:id')
    expect(root).toBeDefined()
    expect(root!.kind).toBe(SpanKind.SERVER)
    expect(root!.instrumentationScope.name).toBe('moost-tracer')
    expect(parentId(root!)).toBeUndefined()
    expect(root!.attributes['moost.event_type']).toBe('http')
  })

  it('an in-process request inside a handler gets its own span — never claims the caller span', async () => {
    const res = await fetch(`${instrumentedBase}/users/nested/1`)
    expect(res.status).toBe(200)
    const root = await waitForSpan('GET /users/nested/:id')
    expect(root).toBeDefined()
    expect(root!.instrumentationScope.name).toBe('fake-instrumentation-http')
    expect(root!.attributes['moost.handler']).toBe('nested')
    const inner = spanNamed('GET /users/:id')
    expect(inner).toBeDefined()
    expect(inner!.instrumentationScope.name).toBe('moost-tracer')
    expect(inner!.spanContext().traceId).toBe(root!.spanContext().traceId)
    expect(inner!.attributes['moost.handler']).toBe('getUser')
  })
})

describe('SpanInjector — non-HTTP events', () => {
  const cliKind = defineEventKind('CLI', {})

  beforeAll(() => {
    context.setGlobalContextManager(new AlsContextManager())
    trace.setGlobalTracerProvider(provider)
  })

  afterEach(() => exporter.reset())

  class CliController {
    list() {}
  }

  it('starts and ends its own root span even under an active SERVER span', () => {
    const injector = new SpanInjector()
    const outer = instrumentationTracer.startSpan('GET', { kind: SpanKind.SERVER })
    let registered: Span | undefined
    context.with(trace.setSpan(ROOT_CONTEXT, outer), () => {
      replaceContextInjector(injector)
      try {
        createEventContext({ logger }, cliKind, {}, () => {
          registered = useOtelContext().getSpan()
          setControllerContext(new CliController(), 'list', 'users list')
          injector.hook('CLI', 'Handler:routed', 'users list')
          injector.hook('CLI', 'Controller:registered')
        })
      } finally {
        resetContextInjector()
      }
    })
    outer.end()
    const root = spanNamed('CLI users list')
    expect(root).toBeDefined()
    expect(registered).not.toBe(outer)
    expect(root!.instrumentationScope.name).toBe('moost-tracer')
    expect(root!.kind).toBe(SpanKind.INTERNAL)
    expect(root!.attributes).toMatchObject({
      'moost.controller': 'CliController',
      'moost.handler': 'list',
      'moost.event_type': 'CLI',
    })
    expect(spanNamed('GET')).toBeDefined() // the outer span is not renamed
  })
})
