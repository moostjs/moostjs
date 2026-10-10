import type { Span } from '@opentelemetry/api'
import { context, SpanKind, trace } from '@opentelemetry/api'
import type { RPCMetadata } from '@opentelemetry/core'
import { getRPCMetadata, RPCType } from '@opentelemetry/core'
import type { IncomingMessage, ServerResponse } from 'http'
import type { TContextInjectorHook } from 'moost'
import {
  ContextInjector,
  current,
  eventTypeKey,
  getConstructor,
  getMoostMate,
  globalKey,
  useControllerContext,
} from 'moost'
import { httpKind } from '@moostjs/event-http'
import { Socket } from 'net'

import {
  customMetricAttrsKey,
  customSpanAttrsKey,
  otelRouteKey,
  otelSpanKey,
  otelStartTimeKey,
  useOtelContext,
} from './context'
import { getMoostMetrics } from './metrics'
import type { TOtelMate } from './otel.mate'
import { withSpan } from './utils'

const tracer = trace.getTracer('moost-tracer')

type TAttributes = Record<string, string | number | boolean>

/** The otel-relevant metadata of one controller method — static per (class, method). */
interface THandlerOtelMeta {
  ignoreSpan?: boolean
  ignoreMeter?: boolean
  controllerName?: string
  description?: string
  label?: string
  id?: string
}

const NO_CONTROLLER_META: THandlerOtelMeta = {}

/** Per (controller class, method) cache of {@link THandlerOtelMeta}: two metadata reads once, not per span. */
const handlerOtelMetaCache = new WeakMap<Function, Map<string | undefined, THandlerOtelMeta>>()

function readHandlerOtelMeta(controller: object | undefined, method: string | undefined) {
  if (!controller) {
    return NO_CONTROLLER_META
  }
  const ctor = getConstructor(controller)
  let byMethod = handlerOtelMetaCache.get(ctor)
  if (!byMethod) {
    byMethod = new Map()
    handlerOtelMetaCache.set(ctor, byMethod)
  }
  let meta = byMethod.get(method)
  if (!meta) {
    const mate = getMoostMate<TOtelMate, TOtelMate, TOtelMate>()
    const cMeta = mate.read(controller)
    const mMeta = mate.read(controller, method)
    meta = {
      ignoreSpan: cMeta?.otelIgnoreSpan || mMeta?.otelIgnoreSpan,
      ignoreMeter: cMeta?.otelIgnoreMeter || mMeta?.otelIgnoreMeter,
      controllerName: ctor.name,
      description: mMeta?.description,
      label: mMeta?.label,
      id: mMeta?.id,
    }
    byMethod.set(method, meta)
  }
  return meta
}

/** Root spans already owned by a Moost event — never attached to (renamed, re-attributed) twice. */
const claimedSpans = new WeakSet<Span>()

/** A host server span an HTTP event attached to. */
interface THostServerSpan {
  span: Span
  /** The http instrumentation's RPC metadata of the request — Moost reports its route through it. */
  rpc?: RPCMetadata
  /** The mount path a host app (Express, Connect) stripped from `req.url`: prefixes the route. */
  mount: string
}

const otelHostSpanKey = globalKey<THostServerSpan>('otel.hostSpan')

/**
 * The server span of the http instrumentation (`@opentelemetry/instrumentation-http`) for this
 * network request, when no Moost event owns it yet.
 *
 * The instrumentation publishes it as the request's RPC metadata, so it is found even when a host
 * app's middleware span (Express instrumentation) is active, not the server span itself. Without
 * RPC metadata only an active SERVER span qualifies — anything else active (a lifecycle span of a
 * running event, a client span) is a parent, not the request's own span. An in-process request
 * (`fetch()` / `request()` on the HTTP app) runs on a fake socket and never attaches: it is not
 * the network request the server span stands for.
 */
function getHostServerSpan(req: IncomingMessage | undefined): THostServerSpan | undefined {
  if (!(req?.socket instanceof Socket)) {
    return undefined
  }
  const rpc = getRPCMetadata(context.active())
  if (rpc?.type === RPCType.HTTP && rpc.span) {
    return claimedSpans.has(rpc.span)
      ? undefined
      : { span: rpc.span, rpc, mount: getMountRoute(req, rpc) }
  }
  const active = trace.getActiveSpan() as (Span & { kind?: SpanKind }) | undefined
  return active?.kind === SpanKind.SERVER && !claimedSpans.has(active)
    ? { span: active, mount: '' }
    : undefined
}

/**
 * The route template a host app mounted Moost under, when it stripped that path from `req.url`
 * (`app.use('/api', moostMiddleware)`): the route the host's own instrumentation reported
 * for the request so far. Empty when Moost sees the whole path.
 */
function getMountRoute(req: IncomingMessage & { originalUrl?: string }, rpc: RPCMetadata) {
  const path = (url: string | undefined) => url?.split('?')[0]
  if (!req.originalUrl || path(req.originalUrl) === path(req.url) || !rpc.route) {
    return ''
  }
  return rpc.route.replace(/\/+$/, '')
}

/**
 * The controller context of the current event, or `undefined` while no handler is resolved yet
 * (an unmatched route reports `Handler:not_found` before any controller context exists).
 */
function readControllerContext() {
  const cc = useControllerContext()
  try {
    return {
      controller: cc.getController() as object | undefined,
      method: cc.getMethod(),
      route: cc.getRoute(),
    }
  } catch {
    return undefined
  }
}

/** Context injector that wraps Moost lifecycle hooks with OpenTelemetry spans and records metrics. */
export class SpanInjector extends ContextInjector<TContextInjectorHook> {
  metrics = getMoostMetrics()

  with<T>(name: TContextInjectorHook, attributes: TAttributes, cb: () => T): T
  with<T>(name: TContextInjectorHook, cb: () => T): T
  with<T>(name: TContextInjectorHook, attributes: TAttributes | (() => T), cb?: () => T): T {
    const fn = typeof attributes === 'function' ? attributes : cb!
    const attrs = typeof attributes === 'object' ? attributes : undefined
    if (name === 'Event:start' && attrs?.eventType) {
      return this.startEvent(attrs.eventType as string, fn)
    } else if (name !== 'Event:start') {
      if (this.getIgnoreSpan()) {
        return fn()
      }
      const span = tracer.startSpan(name, {
        kind: SpanKind.INTERNAL,
        attributes: attrs,
      })
      return this.withSpan(span, fn, {
        withMetrics: false,
        endSpan: true,
      })
    }
    return fn()
  }

  protected patchRsponse() {
    const res = this.getResponse()
    if (res) {
      const originalWriteHead = res.writeHead
      // also catches the implicit `writeHead(statusCode)` of a bare `res.end()`
      res.writeHead = ((...args: Parameters<typeof originalWriteHead>) => {
        res._statusCode = args[0]
        return originalWriteHead.apply(res, args)
      }) as typeof originalWriteHead
    }
  }

  protected startEvent<T>(eventType: string, cb: () => T): T {
    if (eventType === 'init') {
      return cb()
    }
    const { registerSpan } = useOtelContext()
    const isHttp = eventType === httpKind.name
    const req = isHttp ? this.getRequest() : undefined
    if (isHttp) {
      this.patchRsponse()
    }
    // An HTTP event attaches to the server span of the http instrumentation
    // (`@opentelemetry/instrumentation-http`) instead of creating a duplicate. Without one it
    // starts its own: a SERVER root when nothing is active (no instrumentation), else an INTERNAL
    // child (in-process `request()`, SSR render inside a handler — not a network request), named
    // after the method until routing names it (an HTTP context without routing keeps that name).
    const host = getHostServerSpan(req)
    const active = trace.getActiveSpan()
    const span =
      host?.span ??
      tracer.startSpan(
        isHttp ? req?.method || 'HTTP' : `${eventType} Event`,
        isHttp && !active ? { kind: SpanKind.SERVER } : undefined,
      )
    claimedSpans.add(span)
    registerSpan(span)
    if (host) {
      current().set(otelHostSpanKey, host)
    }
    const opts = { withMetrics: true, endSpan: !host }
    if (host && active && active !== host.span) {
      // The server span is an ancestor (a host app's middleware span is active): keep the
      // active span, so Moost's spans nest under the host middleware that runs Moost.
      const outer = context.active()
      return this.withSpan(span, () => context.with(outer, cb), opts)
    }
    return this.withSpan(span, cb, opts)
  }

  getEventType() {
    const ctx = current()
    return ctx.has(eventTypeKey) ? ctx.get(eventTypeKey) : undefined
  }

  getIgnoreSpan() {
    const cc = readControllerContext()
    return readHandlerOtelMeta(cc?.controller, cc?.method).ignoreSpan
  }

  getControllerHandlerMeta() {
    const cc = readControllerContext()
    const methodName = cc?.method
    const meta = readHandlerOtelMeta(cc?.controller, methodName)
    return {
      ignoreMeter: meta.ignoreMeter,
      ignoreSpan: meta.ignoreSpan,
      attrs: {
        'moost.controller': meta.controllerName,
        'moost.handler': methodName,
        'moost.handler_description': meta.description,
        'moost.handler_label': meta.label,
        'moost.handler_id': meta.id,
        'moost.ignore': meta.ignoreSpan,
        'moost.route': cc?.route,
        'moost.event_type': this.getEventType(),
      },
    }
  }

  hook(
    method: string,
    name: 'Handler:not_found' | 'Handler:routed' | 'Controller:registered',
    route?: string,
  ): void {
    if (method === 'WF_STEP') {
      // ignore "WF_STEP" to prevent interference with "WF_FLOW"
      return
    }
    if (method === '__SYSTEM__') {
      // it is a fake controller that handles 404 errors
      return
    }
    const ctx = current()
    if (!ctx.hasOwn(otelSpanKey) && ctx.has(otelSpanKey)) {
      // A nested invocation (a child context such as `MoostHttp.invoke()`) sees its parent
      // event's span only through the parent — never rename or re-attribute that span, nor
      // start event metrics for it.
      if (name !== 'Controller:registered') {
        ctx.set(otelRouteKey, route)
      }
      return
    }
    const { getSpan } = useOtelContext(ctx)
    if (name === 'Handler:not_found') {
      const chm = this.getControllerHandlerMeta()
      const span = getSpan()
      if (span) {
        const eventType = this.getEventType()
        if (eventType === httpKind.name) {
          // the method only — a raw URL would make span names unbounded (scanners, ids)
          span.updateName(this.getRequest()?.method || 'HTTP')
        }
      }
      this.startEventMetrics(chm.attrs, route)
    } else if (name === 'Controller:registered') {
      const _route = ctx.has(otelRouteKey) ? ctx.get(otelRouteKey) : undefined
      const chm = this.getControllerHandlerMeta()
      if (!chm.ignoreMeter) {
        this.startEventMetrics(chm.attrs, _route)
      }
      const span = getSpan()
      if (span) {
        span.setAttributes(chm.attrs)
        if (chm.attrs['moost.event_type'] === httpKind.name) {
          const host = ctx.has(otelHostSpanKey) ? ctx.get(otelHostSpanKey) : undefined
          const httpRoute = _route ? `${host?.mount || ''}${_route}` : undefined
          span.updateName(`${this.getRequest()?.method || ''} ${httpRoute || '<unresolved>'}`)
          if (httpRoute) {
            span.setAttribute('http.route', httpRoute)
            if (host?.rpc) {
              // the http instrumentation names its span and sets `http.route` on it and on its
              // request metrics from this when the response finishes — overriding the mount
              // route a host app's instrumentation reported
              host.rpc.route = httpRoute
            }
          }
        } else {
          span.updateName(`${chm.attrs['moost.event_type']} ${_route || '<unresolved>'}`)
        }
      }
    }
    if (name !== 'Controller:registered') {
      ctx.set(otelRouteKey, route)
    }
  }

  withSpan<T>(
    span: Span,
    cb: () => T,
    opts: {
      withMetrics: boolean
      endSpan: boolean
    },
  ): T {
    return withSpan(span, cb, (_span, exception, result) => {
      if (result instanceof Error) {
        _span.recordException(result)
      }
      if (opts.withMetrics) {
        const chm = this.getControllerHandlerMeta()
        if (!chm.ignoreMeter) {
          this.endEventMetrics(chm.attrs, result instanceof Error ? result : exception)
        }
      }
      if (opts.endSpan) {
        const ctx = current()
        const customAttrs = ctx.has(customSpanAttrsKey) ? ctx.get(customSpanAttrsKey) : undefined
        if (customAttrs) {
          _span.setAttributes(customAttrs)
        }
        _span.end()
      }
    })
  }

  // start event metrics
  startEventMetrics(a: Record<string, string | number | boolean | undefined>, route?: string) {
    current().set(otelStartTimeKey, Date.now())
  }

  // end event metrics
  endEventMetrics(a: Record<string, string | number | boolean | undefined>, error?: Error) {
    const ctx = current()
    const route = ctx.has(otelRouteKey) ? ctx.get(otelRouteKey) : undefined
    const startTime = ctx.has(otelStartTimeKey) ? ctx.get(otelStartTimeKey) : undefined
    if (startTime === undefined && route === undefined && a['moost.event_type'] === httpKind.name) {
      // an HTTP context that never routed (`withHttpContext()`, e.g. an SSR render of a page the
      // host serves) is no handled request: its duration and status would be meaningless
      return
    }
    const duration = Date.now() - (startTime || Date.now() - 1)
    const customAttrs = ctx.has(customMetricAttrsKey) ? ctx.get(customMetricAttrsKey) : {}
    const attrs = {
      ...customAttrs,
      route,
      'moost.event_type': a['moost.event_type'],
      'moost.is_error': error ? 1 : 0,
    } as Record<string, string | number>
    if (a['moost.event_type'] === httpKind.name) {
      // no raw-URL fallback for an unmatched route: it would make the metric unbounded
      attrs['http.status_code'] = this.getResponse()?._statusCode || 0
      attrs['moost.is_error'] = attrs['moost.is_error'] || attrs['http.status_code'] > 399 ? 1 : 0
    }
    this.metrics.moostEventDuration.record(duration, attrs)
  }

  getRequest() {
    try {
      return current().get(httpKind.keys.req)
    } catch {
      return undefined
    }
  }

  getResponse() {
    try {
      const response = current().get(httpKind.keys.response)
      return (response as unknown as { getRawRes: (p?: boolean) => ServerResponse })?.getRawRes(
        true,
      ) as ServerResponse & { _statusCode?: number }
    } catch {
      return undefined
    }
  }
}
