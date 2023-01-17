import { Controller, ImportController } from '../controller.decorator'
import { getMoostMate } from '../../metadata/moost-metadata'
import { TFunction } from 'common'

@Controller('my-path')
class A {

}

@ImportController(() => A)
@ImportController('path-a', () => A)
@ImportController(A)
@ImportController('path-a2', A)
class B {

}

describe('controller.decorator', () => {
    const metaA = getMoostMate().read(A)
    const metaB = getMoostMate().read(B)
    it('@Controller must set prefix to metadata', () => {
        expect(metaA).toHaveProperty('controller', { prefix: 'my-path' })
    })
    // it('@Controller must set injectable as well', () => {
    //     expect(metaA).toHaveProperty('injectable', true)
    // })
    it('@ImportController must set imported controllers', () => {
        expect(metaB).toHaveProperty('importController')
        expect(metaB?.importController).toHaveLength(4)
        if (metaB?.importController) {
            expect(metaB.importController[0].typeResolver).toBeDefined()
            expect(metaB.importController[0].prefix).toBeUndefined()
            if (metaB.importController[0].typeResolver) {
                expect((metaB.importController[0].typeResolver as TFunction)()).toBe(A)
            }
            expect(metaB.importController[1].typeResolver).toBeDefined()
            expect(metaB.importController[1].prefix).toBe('path-a')
            if (metaB.importController[1].typeResolver) {
                expect((metaB.importController[1].typeResolver as TFunction)()).toBe(A)
            }
            expect(metaB.importController[2].typeResolver).toBeDefined()
            expect(metaB.importController[2].prefix).toBeUndefined()
            if (metaB.importController[2].typeResolver) {
                expect(metaB.importController[2].typeResolver).toBe(A)
            }
            expect(metaB.importController[3].typeResolver).toBeDefined()
            expect(metaB.importController[3].prefix).toBe('path-a2')
            if (metaB.importController[3].typeResolver) {
                expect(metaB.importController[3].typeResolver).toBe(A)
            }
        }
    })
})
