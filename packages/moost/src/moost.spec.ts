import { Get, Post } from '@moostjs/event-http'

import { Moost } from './moost'

import { describe, it, expect } from 'vitest'

class A extends Moost {
  @Get()
  @Post()
  test() {
    return 'ok'
  }
}

describe('moost', () => {
  it('must work', () => {
    const a: Record<symbol, number> = {}
    const symbols = [Symbol(), Symbol()]
    a[symbols[0]] = 0
    a[symbols[1]] = 1
    console.log(`a[0] = ${a[symbols[0]]}`)
    console.log(`a[1] = ${a[symbols[1]]}`)

    expect(A).toBe(A)
  })
})
