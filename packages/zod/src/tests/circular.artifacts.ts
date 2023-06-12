import { LazyType } from '../zod.decorators'
import { getZodMate } from '../zod.mate'

const mate = getZodMate()

export class CircularTest {
    name = ''

    @LazyType(() => CircularTest)
    @mate.decorate('optional', true)
    child?: CircularTest = { name: 'test' }
}
