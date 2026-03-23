import { describe, expect, it } from 'vitest'

import { getWfMate } from '../../meta-types'
import { Step, StepTTL, Workflow, WorkflowSchema } from '../wf.decorator'

const mate = getWfMate()

class TestWorkflows {
  @Step('validate')
  validate() {}

  @Workflow('onboarding')
  @WorkflowSchema(['validate', 'complete'])
  onboarding() {}

  @Step('send-email')
  @StepTTL(60_000)
  sendEmail() {}

  @Step('no-ttl')
  noTtl() {}
}

describe('wf.decorator', () => {
  describe('@Step', () => {
    it('stores WF_STEP handler in metadata', () => {
      const meta = mate.read(TestWorkflows, 'validate')
      expect(meta?.handlers).toHaveLength(1)
      expect(meta?.handlers?.[0]).toEqual({ path: 'validate', type: 'WF_STEP' })
    })
  })

  describe('@Workflow + @WorkflowSchema', () => {
    it('stores WF_FLOW handler and schema in metadata', () => {
      const meta = mate.read(TestWorkflows, 'onboarding')
      expect(meta?.handlers).toHaveLength(1)
      expect(meta?.handlers?.[0]).toEqual({ path: 'onboarding', type: 'WF_FLOW' })
      expect(meta?.wfSchema).toEqual(['validate', 'complete'])
    })
  })

  describe('@StepTTL', () => {
    it('stores TTL value in metadata', () => {
      const meta = mate.read(TestWorkflows, 'sendEmail')
      expect(meta?.wfStepTTL).toBe(60_000)
    })

    it('does not set TTL when decorator is absent', () => {
      const meta = mate.read(TestWorkflows, 'noTtl')
      expect(meta?.wfStepTTL).toBeUndefined()
    })
  })
})
