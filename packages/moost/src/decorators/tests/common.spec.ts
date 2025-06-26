import { getMoostMate } from '../../metadata'
import { CommonDecoratorsTestClass } from './common.artifacts'
import { describe, it, expect } from 'vitest'

const instance = new CommonDecoratorsTestClass()
const meta = getMoostMate().read(instance, 'method')
describe('common decorators', () => {
  it('must set label property on param', () => {
    expect((meta?.params || [])[0]).toHaveProperty('label', 'my-label')
  })
  it('must set optional property on param', () => {
    expect((meta?.params || [])[1]).toHaveProperty('optional', true)
  })
})
