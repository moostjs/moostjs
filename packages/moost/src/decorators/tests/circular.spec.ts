import { getMoostMate } from '../../metadata/moost-metadata'
import { CircularTestClassA, CircularTestClassB } from './circular.artifacts'

describe('circular.decorator', () => {
    const metaB = getMoostMate().read(CircularTestClassB)
    it('@Circular must set type resolver in params', () => {
        expect(metaB).toHaveProperty('params')
        if (metaB?.params) {
            expect(metaB.params).toHaveLength(1)
            expect(metaB.params[0]).toBeDefined()
            if (metaB.params[0]) {
                expect(metaB.params[0]).toHaveProperty('circular')
                if (metaB.params[0].circular) {
                    expect(metaB.params[0].circular()).toBe(CircularTestClassA)
                }
            }
        }
    })
})
