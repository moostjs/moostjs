/* eslint-disable @typescript-eslint/no-unused-vars */
import { Label, Optional, Required, Dto, Validate, IsArray } from '../decorators'
import { getMoostValido } from '../metadata/valido'

const valido = getMoostValido()

@Dto()
class A {
    @Label('Some String')
    @Validate<string>((opts) => {
        expect(opts.type).toBe(String)
        expect(opts.key).toBe('s')
        expect(opts.label).toBe('Some String')
        return opts.value.length > 5 || `"${opts.label}" is too short`
    })
    s: string = ''

    @Validate<number>((opts) => {
        if (opts.value === 6) {
            expect(opts.parent).toBeDefined()
            expect(opts.parent && (opts.parent as { n: string }).n).toBe('nested')
        }
        return opts.value % 2 === 0 || 'expected even number, got ' + opts.value
    })
    n: number = 5
}

@Dto({ allowExtraFields: true })
class B {
    @Validate(({value}) => typeof value === 'number' || 'expected Number type')
    n: number = 0

    @Optional()
    a?: A
}

@Dto()
class C {
    @Required()
    s: string = ''

    @Required()
    n: number = 0
}

@Dto()
class D {
    @IsArray()
    simpleArray: number[] = []

    @IsArray({ itemType: () => C })
    complexArray: C[] = []
}

describe('validateDTO', () => {
    it('must validate DTO', async () => {
        expect(await valido.validateDTO({
            s: 'test',
            n: 5,
            extra: 'not allowed',
        }, A)).toEqual({
            s: '"Some String" is too short',
            n: 'expected even number, got 5',
            extra: 'Unexpected field "extra"',
        })
    })
    it('must validate nested DTO', async () => {
        expect(await valido.validateDTO({
            n: 'nested',
            a: {
                s: 'test',
                n: 6,
            },
            extra: 'allowed',
        }, B)).toEqual({
            n: 'expected Number type',
            a: {
                s: '"Some String" is too short',
            },
        })
    })
    it('must validate required field', async () => {
        expect(await valido.validateDTO({ s: '' }, C)).toEqual({
            n: 'Field "n" is required',
        })
    })
    it('must validate array fields (negative)', async () => {
        expect(await valido.validateDTO({
            simpleArray: 'not array',
            complexArray: [{ s: 'test' }],
        }, D)).toEqual({
            complexArray: [{
                n: 'Field "n" is required',
            }],
            simpleArray: '"simpleArray" array expected',
        })
    })
    it('must validate array fields (positive)', async () => {
        expect(await valido.validateDTO({
            simpleArray: [1, 2, 3],
            complexArray: [{ s: 'test', n: 5 }],
        }, D)).toEqual(true)
    })
})
