import * as wfOutlets from '@prostojs/wf/outlets'
import * as wooksWf from '@wooksjs/event-wf'
import { clearGlobalWooks, Controller, Moost } from 'moost'
import { describe, expect, it } from 'vitest'

import {
  HandleStateStrategy,
  hashWfHandle,
  MoostWf,
  outletHttp,
  renewStateToken,
  Step,
  Workflow,
  WorkflowSchema,
  WfStateStoreMemory,
} from './index'
import type { WfPauseRequest } from './index'

describe('renewStateToken re-export', () => {
  it('is the @wooksjs/event-wf function itself', () => {
    expect(typeof renewStateToken).toBe('function')
    expect(renewStateToken).toBe(wooksWf.renewStateToken)
  })

  it('inside a @Step, flags the next pause for a fresh state token', async () => {
    clearGlobalWooks()
    @Controller()
    class Invite {
      @Step('set-password')
      setPassword() {
        renewStateToken()
      }

      @Step('profile')
      profile() {
        return outletHttp({ step: 'profile' })
      }

      @Workflow('invite')
      @WorkflowSchema(['set-password', 'profile'])
      flow() {}
    }
    const wf = new MoostWf()
    const app = new Moost()
    app.adapter(wf as never)
    app.registerControllers(Invite)
    await app.init()

    const output = await wf.start('/invite', {}, { strategy: { name: 'store' } })
    expect((output.inputRequired as WfPauseRequest).renewStateToken).toBe(true)
  })
})

describe('hashWfHandle re-export', () => {
  it('is the @prostojs/wf/outlets function itself', () => {
    expect(hashWfHandle).toBe(wfOutlets.hashWfHandle)
  })

  it('revokes a hashed handle via consume(handle)', async () => {
    const store = new WfStateStoreMemory()
    const strategy = new HandleStateStrategy({ store, hashHandles: { secret: 's' } })
    const handle = await strategy.persist({ schemaId: 'flow', context: {}, indexes: [0] })
    expect(await store.get(hashWfHandle(handle, 's'))).not.toBeNull()

    await strategy.consume(handle)
    expect(await strategy.retrieve(handle)).toBeNull()
  })
})
