import { getMoostMate } from '../../metadata/moost-metadata'
import type { TInterceptorDef } from '../intercept.decorator'
import { Intercept, TInterceptorPriority } from '../intercept.decorator'
import { describe, it, expect } from 'vitest'

const fn = () => {
  /** */
}
@Intercept(fn)
class A {}

const def: TInterceptorDef = {
  after() {},
  priority: TInterceptorPriority.AFTER_ALL,
  _name: 'myDef',
}
@Intercept(def)
class B {}

describe('intercept.decorator', () => {
  const metaA = getMoostMate().read(A)
  it('@Intercept must set intercept with function', () => {
    expect(metaA).toHaveProperty('interceptors')
    expect(metaA?.interceptors).toHaveLength(1)
    expect((metaA?.interceptors || [])[0]).toHaveProperty('handler', fn)
  })

  const metaB = getMoostMate().read(B)
  it('@Intercept must set intercept with TInterceptorDef', () => {
    expect(metaB).toHaveProperty('interceptors')
    expect(metaB?.interceptors).toHaveLength(1)
    const interceptor = (metaB?.interceptors || [])[0]
    expect(interceptor).toHaveProperty('handler', def)
    expect(interceptor).toHaveProperty('priority', TInterceptorPriority.AFTER_ALL)
    expect(interceptor).toHaveProperty('name', 'myDef')
  })
})
