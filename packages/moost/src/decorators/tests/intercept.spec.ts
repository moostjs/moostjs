import { getMoostMate } from '../../metadata/moost-metadata'
import { Intercept } from '../intercept.decorator'
import { describe, it, expect } from 'vitest'

const fn = () => {
  /** */
}
@Intercept(fn)
class A {}

describe('intercept.decorator', () => {
  const metaA = getMoostMate().read(A)
  it('@Intercept must set intercept', () => {
    expect(metaA).toHaveProperty('interceptors')
    expect(metaA?.interceptors).toHaveLength(1)
    expect((metaA?.interceptors || [])[0]).toHaveProperty('handler', fn)
  })
})
