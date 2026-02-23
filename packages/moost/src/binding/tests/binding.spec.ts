import { getInstanceOwnMethods } from '../utils'
import { describe, it, expect } from 'vitest'

class A {
  method1() {
    /** */
  }

  method2() {
    /** */
  }

  prop1 = ''

  prop2 = ''

  prop3?: string

  prop4 = () => {
    /** */
  }
}

class B extends A {
  method1() {
    /** */
  }

  method5() {
    /** */
  }
}

describe('getInstanceMethods', () => {
  it('must return class instance methods list', () => {
    const instanceA = new A()
    const instanceB = new B()
    const methodsA = getInstanceOwnMethods(instanceA)
    const methodsB = getInstanceOwnMethods(instanceB)
    expect(methodsA).toContain('method1')
    expect(methodsA).toContain('method2')
    expect(methodsA).toContain('prop4')
    expect(methodsA.includes('prop1')).toBeFalsy()
    expect(methodsA.includes('prop2')).toBeFalsy()
    expect(methodsA.includes('prop3')).toBeFalsy()
    expect(methodsB).toContain('method1')
    expect(methodsB).toContain('method5')
    expect(methodsB).toContain('prop4')
    expect(methodsB.includes('prop1')).toBeFalsy()
    expect(methodsB.includes('prop2')).toBeFalsy()
    expect(methodsB.includes('prop3')).toBeFalsy()
    expect(methodsB).toContain('method2') // inheritance
  })

  it('must not return duplicate method names when child overrides parent', () => {
    const instanceB = new B()
    const methodsB = getInstanceOwnMethods(instanceB)
    const unique = [...new Set(methodsB)]
    expect(methodsB).toHaveLength(unique.length)
  })

  it('must not return duplicate method names with fakeInstance pattern', () => {
    // This is how bind-controller.ts creates instances: Object.create(constructor.prototype)
    const fakeInstance = Object.create(B.prototype)
    const methods = getInstanceOwnMethods(fakeInstance)
    const unique = [...new Set(methods)]
    expect(methods).toHaveLength(unique.length)
  })
})
