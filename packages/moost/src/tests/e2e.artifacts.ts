import { useRequest } from '@wooksjs/event-http'
import { TClassFunction } from '../class-function'
import { Controller, Delete, Get, Injectable, Patch, Post, ImportController, Query, Inject, Provide, TInterceptorFn, Intercept, Url } from '../decorators'
import { Moost } from '../moost'
import { TFunction } from '../types'

@Injectable()
export class E2eInterceptor implements TClassFunction<TInterceptorFn> {
    constructor(private trackableFn: TFunction) {

    }

    handler() {
        const { url } = useRequest()
        this.trackableFn(url)
    }
}

@Injectable('FOR_REQUEST')
class E2eInterceptorForRequest implements TClassFunction<TInterceptorFn> {
    constructor(@Url() private url: string) {

    }

    handler: TInterceptorFn = (before) => {
        before((reply) => {
            reply('intercepted for url ' + this.url)
        })
    }
}

@Injectable()
class E2eCommonDep {
    private internalSecret = Math.random()

    constructor(@Inject('SECRET') private secret: string) {
        console.log('internalSecret = ' + this.internalSecret.toString())
    }

    getSecret() {
        return this.secret
    }

    getInternalSecret() {
        return this.internalSecret
    }
}

@Injectable()
@Controller()
class E2eController {
    constructor(private commonDep: E2eCommonDep) {

    }

    @Get('nestedControllerMethod')
    nestedControllerMethod(@Query() query: string) {
        return query
    }

    @Get('common_dep/secret')
    secret() {
        return this.commonDep.getSecret()
    }

    @Get('common_dep/internal_secret')
    internalSecret() {
        return this.commonDep.getInternalSecret()
    }
}

@Injectable('FOR_REQUEST')
@Controller('req')
class E2eRequestController {
    constructor(@Query() private query: string, private commonDep: E2eCommonDep) {

    }
    
    @Get('nestedControllerMethod')
    nestedControllerMethod() {
        return this.query
    }

    @Get('common_dep/secret')
    secret() {
        return this.commonDep.getSecret()
    }

    @Get('common_dep/internal_secret')
    internalSecret() {
        return this.commonDep.getInternalSecret()
    }
}

@Injectable()
@Intercept(E2eInterceptor)
@Controller('intercept')
class E2eControllerWithInterceptor {
    @Get('*')
    test() {
        return 'ok'
    }

    @Get('for_request')
    @Intercept(E2eInterceptorForRequest)
    test2() {
        return 'ok'
    }
}

export const SECRET = Math.random().toString()

console.log('SECRET = ' + SECRET)

@Provide('SECRET', () => SECRET)
@ImportController(E2eController)
@ImportController(E2eRequestController)
@ImportController(E2eControllerWithInterceptor)
export class E2eTestMoost extends Moost {
    @Get()
    getMethod() {
        return '@Get method called'
    }

    @Patch()
    patchMethod() {
        return '@Patch method called'
    }

    @Post()
    postMethod() {
        return '@Post method called'
    }

    @Delete()
    deleteMethod() {
        return '@Delete method called'
    }
}
