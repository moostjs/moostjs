/* eslint-disable @typescript-eslint/no-unused-vars */
import { Get, Post } from './decorators'
import { Moost } from './moost'

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
        console.log(`a[0] = ${ a[symbols[0]] }`)
        console.log(`a[1] = ${ a[symbols[1]] }`)
        expect(A).toBe(A)
    })
})
