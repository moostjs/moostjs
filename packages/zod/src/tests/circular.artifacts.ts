import { LazyType } from '../zod.decorators'

export class CircularTest {
    name = ''

    @LazyType(() => CircularTest).optional()
    child?: CircularTest = { name: 'test' }
}
