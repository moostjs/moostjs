import { getMoostValido } from '../../metadata/valido'
import { ValidateDecoratorTestArrayClass, ValidateDecoratorTestBooleanClass, ValidateDecoratorTestClass, ValidateDecoratorTestIsTypeOfClass, ValidateDecoratorTestNumberClass, ValidateDecoratorTestStringClass } from './validate.artifacts'

const valido = getMoostValido()

describe('validate decorator', () => {
    it('must validate property', async () => {
        expect(await valido.validateDTO({ prop: 'random' }, ValidateDecoratorTestClass))
            .toEqual({ prop: 'expected value' })
        expect(await valido.validateDTO({ prop: 'value' }, ValidateDecoratorTestClass))
            .toEqual(true)
    })
    // it('must validate parameter (method argument)', () => {
    //     // need to run server
    // })
    it('must validate IsTypeOf value', async () => {
        expect(await valido.validateDTO({ prop: 5 }, ValidateDecoratorTestIsTypeOfClass))
            .toEqual({ prop: '"prop" string expected' })
        expect(await valido.validateDTO({ prop: 'string' }, ValidateDecoratorTestIsTypeOfClass))
            .toEqual(true)
    })
    it('must validate IsString', async () => {
        expect(await valido.validateDTO({ prop: 5 }, ValidateDecoratorTestStringClass))
            .toEqual({ prop: '"prop" string expected' })
        expect(await valido.validateDTO({ prop: 'abc' }, ValidateDecoratorTestStringClass))
            .toEqual({ prop: '"prop" does not satisfy min length 4' })
        expect(await valido.validateDTO({ prop: 'abcd' }, ValidateDecoratorTestStringClass))
            .toEqual(true)
        expect(await valido.validateDTO({ prop: 'abcdefghij' }, ValidateDecoratorTestStringClass))
            .toEqual(true)
        expect(await valido.validateDTO({ prop: 'abcdefghijk' }, ValidateDecoratorTestStringClass))
            .toEqual({ prop: '"prop" does not satisfy max length 10' })
        expect(await valido.validateDTO({ prop: 'abcd456' }, ValidateDecoratorTestStringClass))
            .toEqual({ prop: '"prop" does not satisfy regex /^[a-z]*$/' })
    })
    it('must validate IsNumber', async () => {
        expect(await valido.validateDTO({ prop: 'string' }, ValidateDecoratorTestNumberClass))
            .toEqual({ prop: '"prop" number expected' })
        expect(await valido.validateDTO({ prop: 3 }, ValidateDecoratorTestNumberClass))
            .toEqual({ prop: '"prop" does not satisfy min = 4' })
        expect(await valido.validateDTO({ prop: 4 }, ValidateDecoratorTestNumberClass))
            .toEqual(true)
        expect(await valido.validateDTO({ prop: 10 }, ValidateDecoratorTestNumberClass))
            .toEqual(true)
        expect(await valido.validateDTO({ prop: 11 }, ValidateDecoratorTestNumberClass))
            .toEqual({ prop: '"prop" does not satisfy max = 10' })
        expect(await valido.validateDTO({ prop: 5.5 }, ValidateDecoratorTestNumberClass))
            .toEqual({ prop: '"prop" expected to be integer number' })
    })
    it('must validate IsBoolean', async () => {
        expect(await valido.validateDTO({ prop: 'true' }, ValidateDecoratorTestBooleanClass))
            .toEqual({ prop: '"prop" boolean expected' })
        expect(await valido.validateDTO({ prop: true }, ValidateDecoratorTestBooleanClass))
            .toEqual(true)
    })

    it('must validate IsArray', async () => {
        expect(await valido.validateDTO({
            prop: [1, 2],
            propStr: [1, '2'],
            propTuple: 'string',
        }, ValidateDecoratorTestArrayClass))
            .toEqual({
                propStr: ['"propStr[0]" string expected'],
                propTuple: '"propTuple" array expected',
            })
        expect(await valido.validateDTO({
            prop: [1],
            propStr: ['1', '2'],
            propTuple: ['string'],
        }, ValidateDecoratorTestArrayClass))
            .toEqual({
                prop: '"prop" does not satisfy min length 2',
                propTuple: [
                    'Expected object, got "string"',
                ],
            })
        expect(await valido.validateDTO({
            prop: [1, 2, 3, 4, 5],
            propStr: ['1', '2', true],
            propTuple: [{ prop: 5 }, { prop: 5 }],
        }, ValidateDecoratorTestArrayClass))
            .toEqual({
                prop: '"prop" does not satisfy max length 4',
                propStr: [ undefined, undefined, '"propStr[2]" string expected'],
                propTuple: [
                    undefined,
                    {
                        prop: '"prop" boolean expected',
                    },
                ],
            })
        expect(await valido.validateDTO({
            prop: [1, 2, 3, 4],
            propStr: ['1', '2', 'true'],
            propTuple: [{ prop: 5 }, { prop: false }],
        }, ValidateDecoratorTestArrayClass)).toBe(true)
    })
})
