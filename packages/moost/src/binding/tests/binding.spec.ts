import { getInstanceOwnMethods } from '../utils'

class A {
    method1() { /** */ }

    method2() { /** */ }

    prop1 = ''

    prop2 = ''

    prop3?: string

    prop4 = () => { /** */ }
}

class B extends A {
    method1() { /** */ }

    method5() { /** */ }
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
})
