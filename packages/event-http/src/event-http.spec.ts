import { describe, expect, it } from 'vitest'

import { MoostHttp } from './event-http'

describe('MoostHttp.onDispose', () => {
  it('resolves when nothing was ever listened', async () => {
    const http = new MoostHttp()

    expect(http.getHttpApp().getServer()).toBeUndefined()
    await expect(http.onDispose()).resolves.toBeUndefined()
  })

  it('closes a server started with listen(0)', async () => {
    const http = new MoostHttp()
    await http.listen(0)

    expect(http.getHttpApp().getServer()?.listening).toBe(true)

    await http.onDispose()

    expect(http.getHttpApp().getServer()?.listening).toBe(false)
  })

  it('is safe to call twice (already closed server)', async () => {
    const http = new MoostHttp()
    await http.listen(0)
    await http.onDispose()

    await expect(http.onDispose()).resolves.toBeUndefined()
  })
})
