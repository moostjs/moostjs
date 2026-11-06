import * as wfOutlets from '@prostojs/wf/outlets'
import { describe, expect, it } from 'vitest'

import { HandleStateStrategy, hashWfHandle, WfStateStoreMemory } from './index'

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
