import type { Span } from '@opentelemetry/api'
import { createEventContext, current, forkEventContext, run, setControllerContext } from 'moost'
import { describe, expect, it, vi } from 'vitest'

import { useOtelContext } from './context'
import { SpanInjector } from './span-injector'

const logger = { info() {}, warn() {}, error() {}, debug() {} }

class SourceController {
  close() {}
}

function fakeSpan() {
  return {
    setAttributes: vi.fn(),
    updateName: vi.fn(),
    spanContext: () => ({ traceId: 't', spanId: 's', traceFlags: 1 }),
  } as unknown as Span & {
    setAttributes: ReturnType<typeof vi.fn>
    updateName: ReturnType<typeof vi.fn>
  }
}

describe('SpanInjector — nested invocations', () => {
  it("a child context's routing / controller hooks never rename or re-attribute the parent's span", () => {
    const injector = new SpanInjector()
    const span = fakeSpan()
    createEventContext({ logger }, () => {
      useOtelContext().registerSpan(span)
      setControllerContext(new SourceController(), 'close', '/view/query')

      const child = forkEventContext()
      run(child, () => {
        setControllerContext(new SourceController(), 'close', '/source/close')
        injector.hook('POST', 'Handler:routed', '/source/close')
        injector.hook('POST', 'Controller:registered')
        injector.hook('POST', 'Handler:not_found')
      })
      expect(span.updateName).not.toHaveBeenCalled()
      expect(span.setAttributes).not.toHaveBeenCalled()

      // the event's own hooks still name its span
      injector.hook('GET', 'Handler:routed', '/view/query')
      injector.hook('GET', 'Controller:registered')
      expect(span.setAttributes).toHaveBeenCalledTimes(1)
      expect(span.updateName).toHaveBeenCalledTimes(1)
    })
  })

  it('registerSpan keeps the span on the registering context — a child event never overwrites its parent span', () => {
    const parentSpan = fakeSpan()
    const childSpan = fakeSpan()
    createEventContext({ logger }, () => {
      const parent = current()
      useOtelContext().registerSpan(parentSpan)
      createEventContext({ logger, parent }, () => {
        useOtelContext().registerSpan(childSpan)
        expect(useOtelContext().getSpan()).toBe(childSpan)
      })
      expect(useOtelContext(parent).getSpan()).toBe(parentSpan)
    })
  })
})
