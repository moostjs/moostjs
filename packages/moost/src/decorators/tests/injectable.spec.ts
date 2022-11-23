import { getMoostMate } from '../../metadata/moost-metadata'
import { Injectable } from '../injectable.decorator'

@Injectable()
class A {

}

describe('controller.decorator', () => {
    const metaA = getMoostMate().read(A)
    it('@Injectable must set injectable', () => {
        expect(metaA).toHaveProperty('injectable', true)
    })
})
