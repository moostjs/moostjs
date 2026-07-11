import { describe, expect, it } from 'vitest'

import { Inherit } from '../decorators/inherit.decorator'
import { Injectable } from '../decorators/injectable.decorator'
import { getMoostInfact, getMoostMate } from '.'

const mate = getMoostMate<{ rules?: string[] }, { rules?: string[] }>()
const Rule = (rule: string) => mate.decorate('rules', rule, true)
const Handler = (path: string) => mate.decorate('handlers', { type: 'TEST', path }, true)
const ParamTag = (source: string) => mate.decorate('paramSource', source)

class Base {
  @Handler('a')
  a() {
    return 'a'
  }

  @Handler('b')
  b() {
    return 'b'
  }

  @Handler('c')
  c() {
    return 'c'
  }

  @Handler('d')
  d() {
    return 'd'
  }

  @Handler('e')
  e() {
    return 'e'
  }

  @Handler('p')
  p(@ParamTag('BODY') body: string) {
    return body
  }

  @Handler('q')
  q(@ParamTag('BODY') body: string) {
    return body
  }
}

@Rule('class-rule')
@Inherit()
class Sub extends Base {
  override b() {
    return 'b2'
  }

  @Rule('c')
  override c() {
    return 'c2'
  }

  @Inherit()
  @Rule('d')
  override d() {
    return 'd2'
  }

  @Inherit(false)
  @Rule('e')
  override e() {
    return 'e2'
  }

  @Rule('p')
  override p(body: string) {
    return body
  }

  @Rule('q')
  override q(@ParamTag('QUERY') body: string) {
    return body
  }
}

class SubNoInherit extends Base {
  @Rule('c')
  override c() {
    return 'c2'
  }
}

describe('metadata inheritance across extends', () => {
  it('inherits method meta for methods defined only on the base', () => {
    expect(mate.read(Sub, 'a')?.handlers).toEqual([{ type: 'TEST', path: 'a' }])
  })

  it('inherits method meta for undecorated overrides', () => {
    expect(mate.read(Sub, 'b')?.handlers).toEqual([{ type: 'TEST', path: 'b' }])
  })

  it('merges parent meta into DECORATED overrides under class-level @Inherit()', () => {
    const meta = mate.read(Sub, 'c')
    // the parent's handler binding survives the override's own decorator
    expect(meta?.handlers).toEqual([{ type: 'TEST', path: 'c' }])
    expect(meta?.rules).toEqual(['c'])
  })

  it('merges parent meta into overrides with method-level @Inherit()', () => {
    const meta = mate.read(Sub, 'd')
    expect(meta?.handlers).toEqual([{ type: 'TEST', path: 'd' }])
    expect(meta?.rules).toEqual(['d'])
  })

  it('@Inherit(false) opts a decorated override out of the merge (full replacement)', () => {
    const meta = mate.read(Sub, 'e')
    expect(meta?.handlers).toBeUndefined()
    expect(meta?.rules).toEqual(['e'])
  })

  it('reads class-level meta from the subclass itself', () => {
    expect(mate.read(Sub)?.rules).toEqual(['class-rule'])
  })

  it('inherits param meta into a decorated override with no own param decorators', () => {
    const meta = mate.read(Sub, 'p')
    expect(meta?.rules).toEqual(['p'])
    expect(meta?.params?.[0]?.paramSource).toBe('BODY')
    // the design-time type still comes from the override itself
    expect(meta?.params?.[0]?.type).toBe(String)
  })

  it('keeps own param meta when the override re-declares its param decorators', () => {
    const meta = mate.read(Sub, 'q')
    expect(meta?.params?.[0]?.paramSource).toBe('QUERY')
  })

  it('does not inherit anything without @Inherit() on the subclass', () => {
    expect(mate.read(SubNoInherit, 'a')).toBeUndefined()
    expect(mate.read(SubNoInherit, 'c')?.handlers).toBeUndefined()
    expect(mate.read(SubNoInherit, 'c')?.rules).toEqual(['c'])
  })
})

describe('constructor param inheritance', () => {
  @Injectable()
  class Dep {
    value = 42
  }

  @Injectable()
  class BaseSvc {
    constructor(public dep: Dep) {}
  }

  @Injectable()
  class SubSvc extends BaseSvc {}

  it('subclass with no declared constructor inherits parent ctor param metadata', () => {
    expect(mate.read(SubSvc)?.params?.[0]?.type).toBe(Dep)
  })

  it('resolves inherited ctor params through DI end-to-end', async () => {
    const instance = await getMoostInfact().get(SubSvc)
    expect(instance).toBeInstanceOf(SubSvc)
    expect(instance.dep).toBeInstanceOf(Dep)
    expect(instance.dep.value).toBe(42)
  })
})
