import { clearGlobalWooks, Controller, Moost } from 'moost'
import { beforeAll, describe, expect, it } from 'vitest'

import { MoostHttp } from '../../event-http'
import { Get } from '../http-method.decorator'
import { Query } from '../resolve.decorator'

@Controller()
class QueryController {
  @Get('query')
  query(@Query() query: Record<string, string>) {
    return { query, type: typeof query }
  }

  @Get('query-item')
  item(@Query('name') name?: string) {
    return { name: name ?? null }
  }
}

let http: MoostHttp

beforeAll(async () => {
  clearGlobalWooks()
  const app = new Moost()
  http = new MoostHttp()
  app.adapter(http)
  app.registerControllers(QueryController)
  await app.init()
})

async function getJson(path: string): Promise<unknown> {
  const res = await http.request(path)
  if (!res) {
    throw new Error(`no route for ${path}`)
  }
  return res.json()
}

describe('@Query()', () => {
  it('resolves an empty object when the request has no query string', async () => {
    expect(await getJson('/query')).toEqual({ query: {}, type: 'object' })
  })

  it('resolves an empty object for an empty query string', async () => {
    expect(await getJson('/query?')).toEqual({ query: {}, type: 'object' })
  })

  it('resolves the parsed query', async () => {
    expect(await getJson('/query?a=1&b=2')).toEqual({ query: { a: '1', b: '2' }, type: 'object' })
  })

  it('@Query(name) still resolves undefined for a missing item', async () => {
    expect(await getJson('/query-item')).toEqual({ name: null })
    expect(await getJson('/query-item?name=x')).toEqual({ name: 'x' })
  })
})
