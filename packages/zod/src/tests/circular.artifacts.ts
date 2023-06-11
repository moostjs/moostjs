import { Lazy } from '../zod.decorators'
import { getZodMate } from '../zod.mate'

const mate = getZodMate()

export class CircularTest {
    name = ''

    @Lazy(() => CircularTest)
    @mate.decorate('optional', true)
    child?: CircularTest = { name: 'test' }
}
