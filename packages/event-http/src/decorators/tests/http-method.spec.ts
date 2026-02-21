import { getMoostMate } from 'moost'

import { HttpMethodTestClass } from './http-method.artifacts'
import { describe, it, expect } from 'vitest'

function simpleTest(fnName: string, httpMethod: string, path?: string) {
  const meta = getMoostMate().read(HttpMethodTestClass, fnName)

  expect(meta).toHaveProperty('handlers')
  expect(meta?.handlers).toHaveLength(1)
  if (meta?.handlers) {
    expect(meta.handlers[0]).toEqual({
      method: httpMethod,
      path,
      type: 'HTTP',
    })
  }
}

const tests = [
  ["Get('')", 'root', 'GET', ''],
  ["Get('path')", 'test', 'GET', 'path'],

  ['All()', 'all', '*', undefined],
  ['Get()', 'get', 'GET', undefined],
  ['Put()', 'put', 'PUT', undefined],
  ['Post()', 'post', 'POST', undefined],
  ['Delete()', 'delete', 'DELETE', undefined],
  ['Patch()', 'patch', 'PATCH', undefined],

  ['HttpMethod("OPTIONS")', 'options', 'OPTIONS', undefined],
]

describe('http-method.decorator', () => {
  for (const t of tests as [string, string, string, string][]) {
    const s = JSON.stringify(t[3])
    it(`@${t[0]} must resolve to http method '${t[2]}' for "${t[1]}" with path = ${s}`, () => {
      simpleTest(...(t.slice(1) as [string, string, string]))
    })
  }
})
