import { describe, expect, it, vi } from 'vitest'

import { getMoostMate } from '../../metadata'
import type { TPipeMetas } from '../../pipes'
import { Resolve } from '../resolve.decorator'

class LabelTarget {
  m(@Resolve(() => 'v', 'given') a: string, @Resolve(() => 'w') b: string) {
    return [a, b]
  }

  @Resolve(() => 'p')
  declare prop: string
}

describe('@Resolve label filling', () => {
  const mate = getMoostMate()

  it('fills the label on the first resolution only, then just resolves', () => {
    const params = mate.read(new LabelTarget(), 'm')!.params!
    const metas = { type: LabelTarget, key: 'm' } as unknown as TPipeMetas
    expect(params[0].resolver!(metas, 'PARAM')).toBe('v')
    expect(mate.read(new LabelTarget(), 'm')!.params![0].label).toBe('given')

    const readSpy = vi.spyOn(mate, 'read')
    try {
      for (let i = 0; i < 3; i++) {
        expect(params[0].resolver!(metas, 'PARAM')).toBe('v')
      }
      expect(readSpy).not.toHaveBeenCalled()
    } finally {
      readSpy.mockRestore()
    }
    // no label given and not a property: none is invented
    expect(params[1].resolver!(metas, 'PARAM')).toBe('w')
    expect(mate.read(new LabelTarget(), 'm')!.params![1].label).toBeUndefined()
  })

  it('a property resolver without a label is labelled with the property key', () => {
    const propMeta = mate.read(new LabelTarget(), 'prop')!
    const metas = { type: LabelTarget, key: 'prop' } as unknown as TPipeMetas
    expect(propMeta.resolver!(metas, 'PROP')).toBe('p')
    expect(mate.read(new LabelTarget(), 'prop')!.label).toBe('prop')
  })
})
