import type { TSwaggerResponseConfigValue, TSwaggerResponseOpts } from './swagger.mate'
import { getSwaggerMate } from './swagger.mate'

export const SwaggerTag = (tag: string) => getSwaggerMate().decorate('swaggerTags', tag, true)

export const SwaggerExclude = () => getSwaggerMate().decorate('swaggerExclude', true)

export const SwaggerDescription = (descr: string) =>
  getSwaggerMate().decorate('swaggerDescription', descr)

export function SwaggerResponse(opts: TSwaggerResponseOpts): MethodDecorator
export function SwaggerResponse(code: number, opts: TSwaggerResponseOpts): MethodDecorator
export function SwaggerResponse(
  code: number | TSwaggerResponseOpts,
  opts?: TSwaggerResponseOpts
): MethodDecorator {
  return getSwaggerMate().decorate(meta => {
    meta.swaggerResponses = meta.swaggerResponses || {}
    const keyCode = typeof code === 'number' ? code : 0
    const opt = typeof code === 'number' ? opts : code
    const contentType =
      typeof (opt as { contentType: string }).contentType === 'string'
        ? (opt as { contentType: string }).contentType
        : '*/*'
    // const description = typeof (opt as { description: string }).description === 'string' ? (opt as { description: string }).description : undefined
    const response = (
      ['object', 'function'].includes(typeof (opt as { response: unknown }).response)
        ? (opt as { response: unknown }).response
        : opt
    ) as TSwaggerResponseConfigValue
    meta.swaggerResponses[keyCode] = meta.swaggerResponses[keyCode] || {}
    meta.swaggerResponses[keyCode][contentType] = response
    // meta.swaggerResponses[keyCode].description = description
    return meta
  })
}

export function SwaggerRequestBody(opt: TSwaggerResponseOpts) {
  return getSwaggerMate().decorate(meta => {
    meta.swaggerRequestBody = meta.swaggerRequestBody || {}
    const contentType =
      typeof (opt as { contentType: string }).contentType === 'string'
        ? (opt as { contentType: string }).contentType
        : 'application/json'
    const response = (
      typeof (opt as { contentType: string }).contentType === 'string'
        ? (opt as { response: string }).response
        : opt
    ) as TSwaggerResponseConfigValue
    meta.swaggerRequestBody[contentType] = response
    return meta
  })
}
