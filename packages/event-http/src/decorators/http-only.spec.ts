import { createEventContext, defineEventKind, EventContext, run } from '@wooksjs/event-core'
import { httpKind } from '@wooksjs/event-http'
import { describe, expect, it, vi } from 'vitest'

import { forHttpEvents } from './http-only'

const logger = { info() {}, warn() {}, error() {}, debug() {} } as never
// the check compares kind names only: an empty-seed kind of the same name stands in for HTTP
const fakeHttpKind = defineEventKind(httpKind.name, {})
const wsMessageKind = defineEventKind('ws:message', {})

function childOfHttp(kind: typeof fakeHttpKind) {
  const parent = new EventContext({ logger })
  parent.seed(fakeHttpKind, {})
  const child = new EventContext({ logger, parent })
  child.seed(kind, {})
  return child
}

describe('forHttpEvents', () => {
  it('runs for an HTTP event and for an HTTP child of one (invoke)', () => {
    const fn = vi.fn()
    createEventContext({ logger }, fakeHttpKind, {}, forHttpEvents(fn))
    run(childOfHttp(fakeHttpKind), forHttpEvents(fn))
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("skips a non-HTTP child of an HTTP event (WS message) — never reads the parent's type", () => {
    const fn = vi.fn()
    run(childOfHttp(wsMessageKind), forHttpEvents(fn))
    expect(fn).not.toHaveBeenCalled()
  })

  it('skips a context without an event type', () => {
    const fn = vi.fn()
    createEventContext({ logger }, forHttpEvents(fn))
    expect(fn).not.toHaveBeenCalled()
  })
})
