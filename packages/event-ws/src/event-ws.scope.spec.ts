import { MoostHttp, Upgrade } from '@moostjs/event-http'
import type { WooksWs } from '@wooksjs/event-ws'
import {
  Controller,
  getMoostInfact,
  Inject,
  Injectable,
  Moost,
  useControllerContext,
  useScopeId,
} from 'moost'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Message, MessageData } from './decorators'
import { MoostWs } from './event-ws'

@Injectable('FOR_EVENT')
class Principal {
  readonly id = Math.random()
}

function scopes() {
  return (getMoostInfact() as unknown as { scopes: Map<string, unknown> }).scopes
}

let upgradeScope = ''

@Controller()
class WsScopeController {
  constructor(@Inject('WooksWs') private ws: WooksWs) {}

  @Upgrade('ws')
  async upgrade() {
    upgradeScope = useScopeId()
    await useControllerContext().instantiate(Principal)
    return this.ws.upgrade()
  }

  @Message('probe', '/probe')
  async probe(@MessageData() data: { delay: number }) {
    const scope = useScopeId()
    const principal = (await useControllerContext().instantiate(Principal)) as Principal
    await new Promise((resolve) => setTimeout(resolve, data.delay))
    return { scope, principal: principal.id, alive: scopes().has(scope) }
  }
}

describe('MoostWs event DI scopes on a real server', () => {
  let http: MoostHttp | undefined
  afterEach(async () => {
    await http?.onDispose()
    http = undefined
  })

  it('gives each message its own scope and releases the upgrade scope with its handler', async () => {
    const app = new Moost()
    http = new MoostHttp()
    app.adapter(http)
    app.adapter(new MoostWs({ httpApp: http }))
    app.registerControllers(WsScopeController)
    await app.init()
    await http.listen(0)
    const { port } = http.getHttpApp().getServer()!.address() as { port: number }
    const before = scopes().size

    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    const replies = new Map<number, { scope: string; principal: number; alive: boolean }>()
    const done = Promise.withResolvers<undefined>()
    socket.addEventListener('message', (e) => {
      const { id, data } = JSON.parse(String(e.data)) as { id: number; data: never }
      replies.set(id, data)
      if (replies.size === 2) {
        done.resolve(undefined)
      }
    })
    await new Promise((resolve) => socket.addEventListener('open', resolve))
    // concurrent messages on one connection: the fast one must not end the slow one's scope
    socket.send(JSON.stringify({ event: 'probe', path: '/probe', data: { delay: 30 }, id: 1 }))
    socket.send(JSON.stringify({ event: 'probe', path: '/probe', data: { delay: 0 }, id: 2 }))
    await done.promise

    const [slow, fast] = [replies.get(1)!, replies.get(2)!]
    expect(slow.alive).toBe(true)
    expect(new Set([slow.scope, fast.scope, upgradeScope]).size).toBe(3)
    expect(slow.principal).not.toBe(fast.principal)
    // the connection is still open — only per-event scopes existed, all released
    await vi.waitFor(() => expect(scopes().size).toBe(before))
    socket.close()
  })
})
