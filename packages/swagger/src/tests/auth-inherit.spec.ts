// oxlint-disable max-classes-per-file -- base controller + subclass of one scenario
import { Authenticate, defineAuthGuard, Get, MoostHttp } from '@moostjs/event-http'
import { Controller, Inherit, Moost } from 'moost'
import { beforeAll, describe, expect, it } from 'vitest'

import { mapToSwaggerSpec } from '../mapping'

/**
 * `@Authenticate` on a base controller and on its `@Inherit()` subclass: both
 * guards run (class-level interceptors accumulate along `extends`), so the
 * spec must document both — schemes discovered, requirements AND-combined.
 */
const bearerGuard = defineAuthGuard({ bearer: { format: 'JWT' } }, () => undefined)
const apiKeyGuard = defineAuthGuard(
  { apiKey: { name: 'X-API-Key', in: 'header' } },
  () => undefined,
)

@Authenticate(bearerGuard)
@Controller('base-auth')
class BaseAuthController {
  @Get('item')
  item() {
    return 'ok'
  }
}

@Authenticate(apiKeyGuard)
@Inherit()
class SubAuthController extends BaseAuthController {}

@Controller('method-auth')
class BaseMethodAuthController {
  @Authenticate(bearerGuard)
  @Get('item')
  item() {
    return 'base'
  }
}

@Inherit()
class SubMethodAuthController extends BaseMethodAuthController {
  @Authenticate(apiKeyGuard)
  override item() {
    return 'sub'
  }
}

describe('swagger auth discovery across extends', () => {
  let spec: ReturnType<typeof mapToSwaggerSpec>

  beforeAll(async () => {
    const app = new Moost()
    app.adapter(new MoostHttp())
    app.registerControllers(SubAuthController, SubMethodAuthController)
    await app.init()
    spec = mapToSwaggerSpec(app.getControllersOverview())
  })

  it('discovers the security schemes of the base and the subclass guard', () => {
    expect(spec.components.securitySchemes?.bearerAuth).toBeDefined()
    expect(spec.components.securitySchemes?.apiKeyAuth).toBeDefined()
  })

  it('AND-combines the inherited and the own guard on the operation', () => {
    expect(spec.paths['/base-auth/item'].get.security).toEqual([{ bearerAuth: [], apiKeyAuth: [] }])
  })

  it('AND-combines a guarded base method and its guarded override at handler level', () => {
    expect(spec.paths['/method-auth/item'].get.security).toEqual([
      { bearerAuth: [], apiKeyAuth: [] },
    ])
  })
})
