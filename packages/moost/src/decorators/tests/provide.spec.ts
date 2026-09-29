import { getClassKey } from '@prostojs/infact'

import { getMoostMate, getMoostInfact } from '../../metadata'
import {
  EmailService,
  NotificationService,
  PrimaryDbToken,
  ProvideTestClass,
  ReplicaDbToken,
  ToInjectTestClass,
  TwinTokenConsumer,
} from './provide.artifacts'
import { describe, it, expect } from 'vitest'

describe('provide.decorator', () => {
  it('must set provide meta', () => {
    const meta = getMoostMate().read(ProvideTestClass)
    const key = getClassKey(ToInjectTestClass)
    expect(meta).toHaveProperty('provide')
    if (meta?.provide) {
      expect(Object.getOwnPropertySymbols(meta.provide).includes(key)).toBe(true)
      if (meta.provide[key]) {
        expect(meta.provide[key].fn()).toHaveProperty('type', 'via class')
      }
      expect(meta.provide).toHaveProperty('to-inject')
      if (meta.provide['to-inject']) {
        expect(meta.provide['to-inject'].fn()).toHaveProperty('type', 'via string')
      }
    }
  })
  it('must set inject meta normalized to the provide-registry key', () => {
    const meta = getMoostMate().read(ProvideTestClass)
    expect(meta).toHaveProperty('params')
    if (meta?.params) {
      expect(meta.params).toHaveLength(1)
      expect(meta.params[0]).toHaveProperty('inject')
      // class keys are normalized to the identity key
      // that createProvideRegistry stores them under
      expect(meta.params[0].inject).toBe(getClassKey(ToInjectTestClass))
    }
  })
  it('must resolve class-keyed @Inject from class-keyed @Provide', async () => {
    const instance = await getMoostInfact().get(NotificationService)
    expect(instance).toBeInstanceOf(NotificationService)
    expect(instance?.email).toBeInstanceOf(EmailService)
    expect(instance?.email.transport).toBe('smtp')
  })
  it('must resolve identical-source class tokens to their own @Provide', async () => {
    expect(String(PrimaryDbToken)).toBe(String(ReplicaDbToken))
    const instance = await getMoostInfact().get(TwinTokenConsumer)
    expect(instance?.primary).toBe('primary')
    expect(instance?.replica).toBe('replica')
  })
})
