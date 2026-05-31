import { createEventContext, current, key } from '@wooksjs/event-core'
import { describe, expect, it } from 'vitest'

import { globalKey } from './global-key'

const testLogger = { info() {}, warn() {}, error() {}, debug() {} }

describe('globalKey', () => {
  it('interns by name: repeated calls return one shared Key instance', () => {
    // Two calls model two moost module copies resolving the same logical slot.
    expect(globalKey('test.intern')).toBe(globalKey('test.intern'))
  })

  it('survives a duplicate load: a value set via one resolution reads back via another', () => {
    // This is the upstream bug ("controller.instance" 500s): one moost copy SETS
    // the slot, another READS it. Interning makes both resolutions the same Key,
    // so the round-trip succeeds instead of throwing `Key "..." is not set`.
    const setterKey = globalKey<string>('test.roundtrip')
    const readerKey = globalKey<string>('test.roundtrip')
    createEventContext({ logger: testLogger }, () => {
      const ctx = current()
      ctx.set(setterKey, 'value')
      expect(ctx.get(readerKey)).toBe('value')
    })
  })

  it('regression guard: bare key() with the same name does NOT share storage', () => {
    // Proves why globalKey is needed — two independent key() calls (what duplicate
    // moost copies produce) get distinct ids and fail to find each other's value.
    const setterKey = key<string>('test.bare')
    const readerKey = key<string>('test.bare')
    createEventContext({ logger: testLogger }, () => {
      const ctx = current()
      ctx.set(setterKey, 'value')
      expect(() => ctx.get(readerKey)).toThrow(/not set/)
    })
  })
})
