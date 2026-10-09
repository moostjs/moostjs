import type { Span } from '@opentelemetry/api'
import { SpanKind, trace } from '@opentelemetry/api'
import type { OutgoingHttpHeaders, ServerResponse } from 'http'
import type { TContextInjectorHook } from 'moost'
import {
  ContextInjector,
  current,
  eventTypeKey,
  getConstructor,
  getMoostMate,
  useControllerContext,
} from 'moost'
import { httpKind } from '@moostjs/event-http'

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
      Object.assign(res, {
        writeHead: (
          arg0: number,
          arg1?: string | OutgoingHttpHeaders,
          arg2?: OutgoingHttpHeaders,
        ) => {
          res._statusCode = arg0
          const headers =
            typeof arg2 === 'object' ? arg2 : typeof arg1 === 'object' ? arg1 : undefined
          res._contentLength = headers?.['content-length'] ? Number(headers['content-length']) : 0
          return originalWriteHead.apply(res, [arg0, arg1, arg2] as unknown as Parameters<
            typeof originalWriteHead
          >)
        },
      })
    }
  }

  protected startEvent<T>(eventType: string, cb: () => T): T {
    if (eventType === 'init') {
      return cb()
    }
    const { registerSpan } = useOtelContext()
    let span = trace.getActiveSpan()
    if (eventType === httpKind.kind) {
      // http span is expected to be created by http instrumentation
      this.patchRsponse()
    } else {
      span = tracer.startSpan(`${eventType} Event`)
    }
    if (span) {
      registerSpan(span)
      return this.withSpan(span, cb, {
        withMetrics: true,
        endSpan: eventType !== httpKind.kind,
      })
    }
    return cb()
  }

  getEventType() {
    const ctx = current()
    return ctx.has(eventTypeKey) ? ctx.get(eventTypeKey) : undefined
  }

  getIgnoreSpan() {
    const { getController, getMethod } = useControllerContext()
    return readHandlerOtelMeta(getController() as object | undefined, getMethod()).ignoreSpan
  }

  getControllerHandlerMeta() {
    const { getMethod, getController, getRoute } = useControllerContext()
    const methodName = getMethod()
    const meta = readHandlerOtelMeta(getController() as object | undefined, methodName)
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
        'moost.route': getRoute(),
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
        if (eventType === httpKind.kind) {
          const req = this.getRequest()
          span.updateName(`${req?.method || ''} ${req?.url}`)
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
        if (chm.attrs['moost.event_type'] === httpKind.kind) {
          span.updateName(`${this.getRequest()?.method || ''} ${_route || '<unresolved>'}`)
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
    const duration = Date.now() - (startTime || Date.now() - 1)
    const customAttrs = ctx.has(customMetricAttrsKey) ? ctx.get(customMetricAttrsKey) : {}
    const attrs = {
      ...customAttrs,
      route,
      'moost.event_type': a['moost.event_type'],
      'moost.is_error': error ? 1 : 0,
    } as Record<string, string | number>
    if (a['moost.event_type'] === httpKind.kind) {
      if (!attrs.route) {
        attrs.route = this.getRequest()?.url || ''
      }
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
      ) as ServerResponse & { _statusCode?: number; _contentLength?: number }
    } catch {
      return undefined
    }
  }
}
