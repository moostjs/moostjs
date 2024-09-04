/* eslint-disable sonarjs/no-duplicate-string */
import type { Span } from '@opentelemetry/api'
import { SpanKind, trace } from '@opentelemetry/api'
import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'http'
import type { TContextInjectorHook } from 'moost'
import { ContextInjector, getConstructor, useAsyncEventContext, useControllerContext } from 'moost'

import type { TOtelContext } from './context'
import { useOtelContext } from './context'
import { getMoostMetrics } from './metrics'
import type { TOtelMate } from './otel.mate'
import { withSpan } from './utils'

const tracer = trace.getTracer('moost-tracer')

type TAttributes = Record<string, string | number | boolean>

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
      } else {
        const span = tracer.startSpan(name, {
          kind: SpanKind.INTERNAL,
          attributes: attrs,
        })
        return this.withSpan(span, fn, {
          withMetrics: false,
          endSpan: true,
        })
      }
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
          arg2?: OutgoingHttpHeaders
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
    if (eventType === 'HTTP') {
      // http span is expected to be created by http instrumentation
      this.patchRsponse()
    } else {
      span = tracer.startSpan(`${eventType} Event`)
    }
    if (span) {
      registerSpan(span)
      return this.withSpan(span, cb, {
        withMetrics: true,
        endSpan: eventType !== 'HTTP',
      })
    }
    return cb()
  }

  getEventType() {
    return useAsyncEventContext().getCtx().event.type
  }

  getIgnoreSpan() {
    const { getMethodMeta, getControllerMeta } = useControllerContext()
    const cMeta = getControllerMeta<TOtelMate>()
    const mMeta = getMethodMeta<TOtelMate>()
    return cMeta?.otelIgnoreSpan || mMeta?.otelIgnoreSpan
  }

  getControllerHandlerMeta() {
    const { getMethod, getMethodMeta, getController, getControllerMeta, getRoute } =
      useControllerContext()
    const methodName = getMethod()
    const controller = getController() as object | undefined
    const cMeta = controller ? getControllerMeta<TOtelMate>() : undefined
    const mMeta = controller ? getMethodMeta<TOtelMate>() : undefined
    return {
      ignoreMeter: cMeta?.otelIgnoreMeter || mMeta?.otelIgnoreMeter,
      ignoreSpan: cMeta?.otelIgnoreSpan || mMeta?.otelIgnoreSpan,
      attrs: {
        'moost.controller': controller ? getConstructor(controller).name : undefined,
        'moost.handler': methodName,
        'moost.handler_description': mMeta?.description,
        'moost.handler_label': mMeta?.label,
        'moost.handler_id': mMeta?.id,
        'moost.ignore': cMeta?.otelIgnoreSpan || mMeta?.otelIgnoreSpan,
        'moost.route': getRoute(),
        'moost.event_type': this.getEventType(),
      },
    }
  }

  hook(
    method: string,
    name: 'Handler:not_found' | 'Handler:routed' | 'Controller:registered',
    route?: string
  ): void {
    if (method === 'WF_STEP') {
      // ignore "WF_STEP" to prevent interference with "WF_FLOW"
      return
    }
    if (method === '__SYSTEM__') {
      // it is a fake controller that handles 404 errors
      return
    }
    const { getSpan } = useOtelContext()
    if (name === 'Handler:not_found') {
      const chm = this.getControllerHandlerMeta()
      const span = getSpan()
      if (span) {
        const eventType = this.getEventType()
        if (eventType === 'HTTP') {
          const req = this.getRequest()
          span.updateName(`${req?.method || ''} ${req?.url}`)
        }
      }
      this.startEventMetrics(chm.attrs, route)
    } else if (name === 'Controller:registered') {
      const _route = useAsyncEventContext<TOtelContext>().store('otel').get('route')
      const chm = this.getControllerHandlerMeta()
      if (!chm.ignoreMeter) {
        this.startEventMetrics(chm.attrs, _route)
      }
      const span = getSpan()
      if (span) {
        span.setAttributes(chm.attrs)
        if (chm.attrs['moost.event_type'] === 'HTTP') {
          span.updateName(`${this.getRequest()?.method || ''} ${_route || '<unresolved>'}`)
        } else {
          span.updateName(`${chm.attrs['moost.event_type']} ${_route || '<unresolved>'}`)
        }
      }
    }
    if (name !== 'Controller:registered') {
      useAsyncEventContext<TOtelContext>().store('otel').set('route', route)
    }
  }

  withSpan<T>(
    span: Span,
    cb: () => T,
    opts: {
      withMetrics: boolean
      endSpan: boolean
    }
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
        const customAttrs = useAsyncEventContext<TOtelContext>().store('customSpanAttrs').value
        if (customAttrs) {
          _span.setAttributes(customAttrs)
        }
        _span.end()
      }
    })
  }

  // start event metrics
  startEventMetrics(a: Record<string, string | number | boolean | undefined>, route?: string) {
    useAsyncEventContext<TOtelContext>().store('otel').set('startTime', Date.now())
  }

  // end event metrics
  endEventMetrics(a: Record<string, string | number | boolean | undefined>, error?: Error) {
    const otelStore = useAsyncEventContext<TOtelContext>().store('otel')
    const route = otelStore.get('route')
    const duration = Date.now() - (otelStore.get('startTime') || Date.now() - 1)
    const customAttrs = useAsyncEventContext<TOtelContext>().store('customMetricAttrs').value || {}
    const attrs = {
      ...customAttrs,
      route,
      'moost.event_type': a['moost.event_type'],
      'moost.is_error': error ? 1 : 0,
    } as Record<string, string | number>
    if (a['moost.event_type'] === 'HTTP') {
      // eslint-disable-next-line unicorn/no-lonely-if
      if (!attrs.route) {
        attrs.route = this.getRequest()?.url || ''
      }
      attrs['http.status_code'] = this.getResponse()?._statusCode || 0
      attrs['moost.is_error'] = attrs['moost.is_error'] || attrs['http.status_code'] > 399 ? 1 : 0
    }
    this.metrics.moostEventDuration.record(duration, attrs)
  }

  getRequest() {
    return useAsyncEventContext<{ event: { req: IncomingMessage } }>().store('event').get('req')
  }

  getResponse() {
    return useAsyncEventContext<{
      event: { res: ServerResponse & { _statusCode?: number; _contentLength?: number } }
    }>()
      .store('event')
      .get('res')
  }
}
