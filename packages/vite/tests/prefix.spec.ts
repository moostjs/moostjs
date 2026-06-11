import { describe, expect, it } from 'vitest'

import { matchesPrefix, normalizePrefixes } from '../src/utils'

describe('normalizePrefixes', () => {
  it('returns undefined when prefix is omitted', () => {
    expect(normalizePrefixes()).toBeUndefined()
    expect(normalizePrefixes(undefined)).toBeUndefined()
    expect(normalizePrefixes(null)).toBeUndefined()
    expect(normalizePrefixes('')).toBeUndefined()
  })

  it('returns undefined for an empty or all-falsy array', () => {
    expect(normalizePrefixes([])).toBeUndefined()
    expect(normalizePrefixes([''])).toBeUndefined()
  })

  it('normalizes a single string to a one-entry array', () => {
    expect(normalizePrefixes('/api')).toEqual(['/api'])
  })

  it('ensures leading slash and strips trailing slash', () => {
    expect(normalizePrefixes('api')).toEqual(['/api'])
    expect(normalizePrefixes('/api/')).toEqual(['/api'])
    expect(normalizePrefixes('api/')).toEqual(['/api'])
  })

  it('normalizes every entry of an array', () => {
    expect(normalizePrefixes(['/api', '.well-known/'])).toEqual(['/api', '/.well-known'])
  })
})

describe('matchesPrefix', () => {
  const prefixes = ['/api', '/.well-known']

  it('matches the mount itself', () => {
    expect(matchesPrefix('/api', prefixes)).toBe(true)
    expect(matchesPrefix('/.well-known', prefixes)).toBe(true)
  })

  it('matches paths below any mount', () => {
    expect(matchesPrefix('/api/users', prefixes)).toBe(true)
    expect(matchesPrefix('/.well-known/oauth-authorization-server/mcp', prefixes)).toBe(true)
  })

  it('matches the mount with a query string', () => {
    expect(matchesPrefix('/api?foo=1', prefixes)).toBe(true)
  })

  it('does not match sibling paths sharing the prefix as a substring', () => {
    expect(matchesPrefix('/apiary', prefixes)).toBe(false)
    expect(matchesPrefix('/apiary/x', prefixes)).toBe(false)
  })

  it('does not match unrelated paths', () => {
    expect(matchesPrefix('/', prefixes)).toBe(false)
    expect(matchesPrefix('/assets/app.js', prefixes)).toBe(false)
  })
})
