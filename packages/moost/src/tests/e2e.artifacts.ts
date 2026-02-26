import { Delete, Get, Patch, Post, Query, Url } from '@moostjs/event-http'
import { useRequest } from '@wooksjs/event-http'

import type { TFunction } from '../common-types'
import type { TOvertakeFn } from '../composables/interceptor.composable'
import {
  Before,
  Controller,
  ImportController,
  Inject,
  Injectable,
  Intercept,
  Interceptor,
  Optional,
  Overtake,
  Provide,
} from '../decorators'
import { Moost } from '../..'

@Interceptor()
export class E2eInterceptor {
  constructor(private readonly trackableFn: TFunction) {}

  @Before()
  track() {
    const { url } = useRequest()
    this.trackableFn(url)
  }
}

@Interceptor(undefined, 'FOR_EVENT')
class E2eInterceptorForRequest {
  constructor(@Url() private readonly url: string) {}

  @Before()
  intercept(@Overtake() reply: TOvertakeFn) {
    reply(`intercepted for url ${this.url}`)
  }
}

@Injectable()
class E2eCommonDep {
  private readonly internalSecret = Math.random()

  constructor(@Inject('SECRET') private readonly secret: string) {
    console.log(`internalSecret = ${this.internalSecret.toString()}`)
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
  constructor(private readonly commonDep: E2eCommonDep) {}

  @Get('nestedControllerMethod')
  nestedControllerMethod(@Query() query: string) {
    return query
  }

  @Get('common_dep/secret')
  secret() {
    console.log('call common_dep/secret', this.commonDep)
    return this.commonDep.getSecret()
  }

  @Get('common_dep/internal_secret')
  internalSecret() {
    return this.commonDep.getInternalSecret()
  }
}

@Injectable('FOR_EVENT')
@Controller('req')
class E2eRequestController {
  constructor(
    @Optional()
    @Query()
    private readonly query: string | undefined,
    private readonly commonDep: E2eCommonDep,
  ) {}

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

console.log(`SECRET = ${SECRET}`)

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
