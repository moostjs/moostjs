import { getMoostMate } from '../../metadata'
import { ProvideTestClass, ToInjectTestClass } from './provide.artifacts'

describe('provide.decorator', () => {
  it('must set provide meta', () => {
    const meta = getMoostMate().read(ProvideTestClass)
    const key = Symbol.for(ToInjectTestClass as unknown as string)
    expect(meta).toHaveProperty('provide')
    if (meta?.provide) {
      expect(Object.getOwnPropertySymbols(meta.provide).includes(key)).toBe(true)
      if (meta.provide[key]) {
        expect(meta.provide[key].fn()).toHaveProperty('type', 'via class')
      }
      expect(meta.provide).toHaveProperty('to-inject')
      if (meta.provide['to-inject']) {
        expect(meta.provide['to-inject'].fn()).toHaveProperty('type', 'via string')
      }
    }
  })
  it('must set inject meta', () => {
    const meta = getMoostMate().read(ProvideTestClass)
    expect(meta).toHaveProperty('params')
    if (meta?.params) {
      expect(meta.params).toHaveLength(1)
      expect(meta.params[0]).toHaveProperty('inject')
      expect(meta.params[0].inject).toBe(ToInjectTestClass)
    }
  })
})
