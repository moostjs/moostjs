import { Pipe } from '../pipe.decorator'

@Pipe(() => 'test pipe 1')
export class PipeDecoratorTestClass {
  @Pipe(() => 'test pipe 2')
  method(
    @Pipe(() => 'test pipe 3')
    a: string
  ) {
    /** */
  }
}
