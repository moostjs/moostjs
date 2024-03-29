/* eslint-disable @typescript-eslint/no-unused-vars */
import { Const, Param, Params, Resolve } from '../resolve.decorator'

export class ResolveDecoratorsTestClass {
  method(
    @Resolve(() => 'resolved') _p0: string,
    @Param('test') _p3: string,
    @Params() _p4: string,
    @Const(10) _p10: string
  ) {
    /** */
  }
}
