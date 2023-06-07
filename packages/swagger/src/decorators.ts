import { getSwaggerMate } from './swagger.mate'

export const SwaggerTag = (tag: string) => getSwaggerMate().decorate('swaggerTags', tag, true)

export const SwaggerExclude = () => getSwaggerMate().decorate('swaggerExclude', true)

export const SwaggerDescription = (descr: string) => getSwaggerMate().decorate('swaggerDescription', descr)

