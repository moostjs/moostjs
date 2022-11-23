import { Inject, Provide } from '../provide.decorator'

export class ToInjectTestClass {
    constructor(public type: string) {}
}

@Provide(ToInjectTestClass, () => new ToInjectTestClass('via class'))
@Provide('to-inject', () => new ToInjectTestClass('via string'))
export class ProvideTestClass {
    constructor(@Inject(ToInjectTestClass) public a: ToInjectTestClass) {}
}
