/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    Header,
    Cookie,
    Query,
    Url,
    Method,
    Req,
    Res,
    Body,
    RawBody,
} from '../resolve.decorator'

export class ResolveDecoratorsTestClass {
    method(
        @Header('test') _p1: string,
        @Cookie('test') _p2: string,
        @Query() _p5: string,
        @Url() _p6: string,
        @Method() _p7: string,
        @Req() _p8: string,
        @Res() _p9: string,
        @Body() _p11: string,
        @RawBody() _p12: string
    ) {
        /** */
    }
}
