import { getMoostMate } from '../../metadata/moost-metadata'
import { Injectable } from '../injectable.decorator'
import { describe, it, expect } from 'vitest'

@Injectable()
class A {}

describe('controller.decorator', () => {
  const metaA = getMoostMate().read(A)
  it('@Injectable must set injectable', () => {
    expect(metaA).toHaveProperty('injectable', true)
  })
})
