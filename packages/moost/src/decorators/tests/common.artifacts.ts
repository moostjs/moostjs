import { Label, Optional } from '../common.decorator'

export class CommonDecoratorsTestClass {
    method(
        @Label('my-label')
            _labelled: string,
        @Optional()
            _optional: string,
    ) { /** */ }
}
