import {
  DEFAULT_FORWARD_HEADERS as wooksForwardHeaders,
  securityHeaders as wooksSecurityHeaders,
} from '@wooksjs/event-http'
import { describe, expect, it } from 'vitest'

import { DEFAULT_FORWARD_HEADERS, securityHeaders } from './index'

describe('re-exports from @wooksjs/event-http', () => {
  it('DEFAULT_FORWARD_HEADERS and securityHeaders come with @moostjs/event-http', () => {
    expect(DEFAULT_FORWARD_HEADERS).toBe(wooksForwardHeaders)
    expect(securityHeaders).toBe(wooksSecurityHeaders)
    expect(securityHeaders()).toMatchObject({ 'x-content-type-options': 'nosniff' })
  })
})
