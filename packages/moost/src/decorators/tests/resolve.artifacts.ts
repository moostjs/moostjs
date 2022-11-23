/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    Resolve,
    Header,
    Cookie,
    Param,
    Params,
    Query,
    Url,
    Method,
    Req,
    Res,
    Const,
    Body,
    RawBody,
} from '../resolve.decorator'

export class ResolveDecoratorsTestClass {
    method(
        @Resolve(() => 'resolved') _p0: string,
        @Header('test') _p1: string,
        @Cookie('test') _p2: string,
        @Param('test') _p3: string,
        @Params() _p4: string,
        @Query() _p5: string,
        @Url() _p6: string,
        @Method() _p7: string,
        @Req() _p8: string,
        @Res() _p9: string,
        @Const(10) _p10: string,
        @Body() _p11: string,
        @RawBody() _p12: string,
    ) { /** */ }
}
