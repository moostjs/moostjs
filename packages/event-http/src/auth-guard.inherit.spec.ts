// oxlint-disable max-classes-per-file -- base controller + subclasses of one scenario
import {
  clearGlobalWooks,
  Controller,
  defineInterceptor,
  Inherit,
  Intercept,
  Moost,
  TInterceptorPriority,
} from 'moost'
import { describe, expect, it } from 'vitest'

import { Authenticate, defineAuthGuard } from './auth-guard'
import { Body, Post } from './decorators'
import { HttpError } from './index'
import { MoostHttp } from './event-http'

/**
 * A base CRUD controller maps its validation errors to a structured 400 via a
 * class-level interceptor. A subclass that adds `@Authenticate(guard)` must keep
 * that mapping: class-level interceptors accumulate along `extends` under
 * `@Inherit()` instead of the subclass's own list replacing the base's.
 */
class ValidationLikeError extends Error {}

const mapValidationErrors = defineInterceptor(
  {
    error: (error, reply) => {
      if (error instanceof ValidationLikeError) {
        reply(new HttpError(400, { message: error.message, statusCode: 400 }))
      }
    },
  },
  TInterceptorPriority.BEFORE_ALL,
)

const guard = defineAuthGuard({ bearer: { format: 'JWT' } }, (transports) => {
  if (transports.bearer !== 'good') {
    throw new HttpError(401, 'bad token')
  }
})

@Intercept(mapValidationErrors)
@Controller('products')
class BaseCrudController {
  @Post('')
  insert(@Body() body: { name?: string }) {
    if (!body?.name) {
      throw new ValidationLikeError('name is required')
    }
    return { ok: true }
  }
}

@Authenticate(guard)
@Inherit()
class ProductsController extends BaseCrudController {}

async function boot(controller: Function) {
  clearGlobalWooks() // a fresh Wooks per app: no routes shared with the previous one
  const app = new Moost()
  const http = new MoostHttp()
  app.adapter(http)
  app.registerControllers(controller)
  await app.init()
  return http
}

const post = (http: MoostHttp, body: unknown, token = 'good') =>
  http.request('/products', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

describe('@Authenticate on a subclass of a controller with class-level error mapping', () => {
  it('base controller alone: an invalid write answers 400', async () => {
    const http = await boot(BaseCrudController)
    const res = await post(http, {})
    expect(res?.status).toBe(400)
  })

  it('authenticated subclass: an invalid write still answers 400 (not 500)', async () => {
    const http = await boot(ProductsController)
    const res = await post(http, {})
    expect(res?.status).toBe(400)
    expect(await res?.json()).toMatchObject({ message: 'name is required' })
  })

  it('authenticated subclass: the guard runs (401) and a valid write passes', async () => {
    const http = await boot(ProductsController)
    const denied = await post(http, {}, 'bad')
    expect(denied?.status).toBe(401)
    const ok = await post(http, { name: 'x' })
    expect(ok?.status).toBe(201)
    expect(await ok?.json()).toEqual({ ok: true })
  })
})
