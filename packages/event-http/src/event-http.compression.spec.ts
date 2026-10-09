import { request as httpRequest } from 'node:http'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'

import type { TWooksHttpOptions } from '@wooksjs/event-http'
import { HttpError } from '@wooksjs/event-http'
import { Controller, defineBeforeInterceptor, Intercept, Moost, TInterceptorPriority } from 'moost'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Compress, Get } from './decorators'
import { MoostHttp } from './event-http'

const big = { items: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `item number ${i}` })) }
const bigJson = JSON.stringify(big)

const denyGuard = defineBeforeInterceptor(() => {
  throw new HttpError(401, `denied: ${'x'.repeat(2000)}`)
}, TInterceptorPriority.GUARD)

@Controller()
class PlainController {
  @Get('plain')
  plain() {
    return big
  }

  @Get('on')
  @Compress()
  on() {
    return big
  }

  @Get('off')
  @Compress(false)
  off() {
    return big
  }

  @Get('gzip-only')
  @Compress({ encodings: ['gzip'] })
  gzipOnly() {
    return big
  }

  @Get('high-threshold')
  @Compress({ threshold: 1_000_000 })
  highThreshold() {
    return big
  }

  @Get('guarded')
  @Compress()
  @Intercept(denyGuard)
  guarded() {
    return big
  }
}

@Controller('off-ctrl')
@Compress(false)
class OffController {
  @Get('inherit')
  inherit() {
    return big
  }

  @Get('override')
  @Compress(true)
  override() {
    return big
  }
}

interface TRawResponse {
  status: number
  encoding: string | undefined
  vary: string | undefined
  body: Buffer
}

function getRaw(url: string, acceptEncoding = 'br, gzip'): Promise<TRawResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { headers: { 'accept-encoding': acceptEncoding } }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          encoding: res.headers['content-encoding'],
          vary: res.headers.vary,
          body: Buffer.concat(chunks),
        }),
      )
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

function decode(res: TRawResponse): string {
  if (res.encoding === 'br') {
    return brotliDecompressSync(res.body).toString()
  }
  if (res.encoding === 'gzip') {
    return gunzipSync(res.body).toString()
  }
  return res.body.toString()
}

async function startApp(opts?: TWooksHttpOptions) {
  const app = new Moost()
  const http = new MoostHttp(opts)
  app.adapter(http)
  app.registerControllers(PlainController, OffController)
  await app.init()
  await http.listen(0)
  const { port } = http.getHttpApp().getServer()!.address() as { port: number }
  return { http, base: `http://127.0.0.1:${port}` }
}

describe('@Compress with app-level compression off (default)', () => {
  let http: MoostHttp
  let base = ''

  beforeAll(async () => {
    ;({ http, base } = await startApp())
  })
  afterAll(async () => {
    await http.onDispose()
  })

  it('leaves undecorated handlers uncompressed', async () => {
    const res = await getRaw(`${base}/plain`)
    expect(res.status).toBe(200)
    expect(res.encoding).toBeUndefined()
    expect(res.body.toString()).toBe(bigJson)
  })

  it('@Compress() turns compression on with the defaults (brotli preferred)', async () => {
    const res = await getRaw(`${base}/on`)
    expect(res.status).toBe(200)
    expect(res.encoding).toBe('br')
    expect(res.vary).toMatch(/accept-encoding/i)
    expect(res.body.length).toBeLessThan(bigJson.length)
    expect(decode(res)).toBe(bigJson)
  })

  it('@Compress(options) applies the options', async () => {
    const res = await getRaw(`${base}/gzip-only`)
    expect(res.encoding).toBe('gzip')
    expect(decode(res)).toBe(bigJson)
  })

  it('respects Accept-Encoding', async () => {
    const res = await getRaw(`${base}/on`, 'identity')
    expect(res.encoding).toBeUndefined()
    expect(res.body.toString()).toBe(bigJson)
  })

  it('method-level @Compress(true) overrides class-level @Compress(false)', async () => {
    const inherited = await getRaw(`${base}/off-ctrl/inherit`)
    expect(inherited.encoding).toBeUndefined()
    const res = await getRaw(`${base}/off-ctrl/override`)
    expect(res.encoding).toBe('br')
    expect(decode(res)).toBe(bigJson)
  })

  it('applies to error responses raised by guards', async () => {
    const res = await getRaw(`${base}/guarded`)
    expect(res.status).toBe(401)
    expect(res.encoding).toBe('br')
    expect(decode(res)).toContain('denied: xxx')
  })
})

describe('@Compress with app-level compression on', () => {
  let http: MoostHttp
  let base = ''

  beforeAll(async () => {
    ;({ http, base } = await startApp({ compression: { encodings: ['gzip', 'br'] } }))
  })
  afterAll(async () => {
    await http.onDispose()
  })

  it('compresses undecorated handlers with the app settings (MoostHttp passes the option through)', async () => {
    const res = await getRaw(`${base}/plain`)
    expect(res.encoding).toBe('gzip')
    expect(decode(res)).toBe(bigJson)
  })

  it('@Compress() keeps the app settings', async () => {
    const res = await getRaw(`${base}/on`)
    expect(res.encoding).toBe('gzip')
    expect(decode(res)).toBe(bigJson)
  })

  it('@Compress(false) opts a handler out', async () => {
    const res = await getRaw(`${base}/off`)
    expect(res.status).toBe(200)
    expect(res.encoding).toBeUndefined()
    expect(res.body.toString()).toBe(bigJson)
  })

  it('class-level @Compress(false) opts every handler of the controller out', async () => {
    const res = await getRaw(`${base}/off-ctrl/inherit`)
    expect(res.encoding).toBeUndefined()
    expect(res.body.toString()).toBe(bigJson)
  })

  it('@Compress(options) layers over the app settings', async () => {
    // threshold above the body size — sent as is
    const skipped = await getRaw(`${base}/high-threshold`)
    expect(skipped.encoding).toBeUndefined()
    expect(skipped.body.toString()).toBe(bigJson)
  })
})
