import { getMoostMate } from '../../metadata/moost-metadata'
import { TPipeData } from '../../pipes'
import { PipeDecoratorTestClass } from './pipe.artifacts'

describe('pipe.decorator', () => {
    const meta = getMoostMate().read(PipeDecoratorTestClass)
    const methodMeta = getMoostMate().read(PipeDecoratorTestClass, 'method')
    it('@Pipe must set pipe for class', () => {
        expect(meta).toHaveProperty('pipes')
        expect(meta?.pipes).toHaveLength(1)
        expect(methodMeta?.params).toBeDefined()
        if (methodMeta?.params) {
            expect(
                (meta?.pipes as TPipeData[])[0].handler(
                    undefined,
                    { paramMeta: methodMeta?.params[0] },
                    'PARAM'
                )
            ).toBe('test pipe 1')
        }
    })
    it('@Pipe must set pipe for method', () => {
        expect(methodMeta).toHaveProperty('pipes')
        expect(methodMeta?.pipes).toHaveLength(1)
        expect(methodMeta?.params).toBeDefined()
        if (methodMeta?.params) {
            expect(
                (methodMeta?.pipes as TPipeData[])[0].handler(
                    undefined,
                    { paramMeta: methodMeta?.params[0] },
                    'PARAM'
                )
            ).toBe('test pipe 2')
        }
    })
    it('@Pipe must set pipe for method argument', () => {
        expect(methodMeta?.params).toBeDefined()
        expect(methodMeta?.params).toBeInstanceOf(Array)
        if (methodMeta?.params) {
            expect(methodMeta?.params[0]).toHaveProperty('pipes')
            expect(methodMeta?.params[0].pipes).toHaveLength(1)
            expect(
                (methodMeta?.params[0].pipes as TPipeData[])[0].handler(
                    undefined,
                    { paramMeta: methodMeta.params[0] },
                    'PARAM'
                )
            ).toBe('test pipe 3')
        }
    })
})
