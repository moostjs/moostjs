// oxlint-disable max-classes-per-file -- each case needs its own adapter classes
import { createEventContext } from '@wooksjs/event-core'
import { describe, expect, it } from 'vitest'

import { getAdapterBrand, MOOST_ADAPTER_BRAND } from './adapter-brand'
import { setControllerContext, useControllerContext } from './composables'
import { Injectable } from './decorators'
import type { TMoostAdapter } from './moost'
import { Moost } from './moost'
import { createCaptureLogger } from './tests/capture-logger.artifacts'

const testLogger = { info() {}, warn() {}, error() {}, debug() {} }

/** An adapter class as one copy of its package defines it. */
function defineAdapterClass(brand: string) {
  return class FakeAdapter implements TMoostAdapter<unknown> {
    static readonly [MOOST_ADAPTER_BRAND] = brand
    readonly name = 'fake'
    bindHandler() {}
  }
}

/** Runs `fn` in an event whose controller is `app` (Moost is its own controller). */
function inAppEvent<R>(app: Moost, fn: () => Promise<R>): Promise<R> {
  return createEventContext({ logger: testLogger }, () => {
    setControllerContext(app, 'init' as keyof Moost, '')
    return fn()
  })
}

describe('adapter brand', () => {
  it('reads the brand off a class and its subclasses only', () => {
    const Adapter = defineAdapterClass('test/brand-read')
    class Sub extends Adapter {}
    expect(getAdapterBrand(Adapter)).toBe('test/brand-read')
    expect(getAdapterBrand(Sub)).toBe('test/brand-read')
    expect(getAdapterBrand(class Plain {})).toBeUndefined()
    expect(getAdapterBrand(undefined)).toBeUndefined()
  })

  it('instantiate() of the attached adapter class resolves it as before, silently', async () => {
    const { logger, warnings } = createCaptureLogger()
    const Adapter = defineAdapterClass('test/same-class')
    const app = new Moost({ logger })
    const adapter = app.adapter(new Adapter())
    await app.init()

    await expect(inAppEvent(app, () => useControllerContext().instantiate(Adapter))).resolves.toBe(
      adapter,
    )
    expect(warnings.filter((w) => w.includes('test/same-class'))).toEqual([])
  })

  it('instantiate() with the same adapter class from another package copy resolves the attached adapter and warns once', async () => {
    const { logger, warnings } = createCaptureLogger()
    const AppCopy = defineAdapterClass('test/other-copy')
    const OtherCopy = defineAdapterClass('test/other-copy')
    const app = new Moost({ logger })
    const adapter = app.adapter(new AppCopy())
    await app.init()

    const resolve = () => inAppEvent(app, () => useControllerContext().instantiate(OtherCopy))
    await expect(resolve()).resolves.toBe(adapter)
    await expect(resolve()).resolves.toBe(adapter)
    const reported = warnings.filter((w) => w.includes('test/other-copy'))
    expect(reported).toHaveLength(1)
    expect(reported[0]).toContain('another copy of its package')
  })

  it('instantiate() of the base adapter class resolves an attached subclass, silently', async () => {
    const { logger, warnings } = createCaptureLogger()
    const Adapter = defineAdapterClass('test/subclass')
    class CustomAdapter extends Adapter {}
    const app = new Moost({ logger })
    const adapter = app.adapter(new CustomAdapter())
    await app.init()

    await expect(inAppEvent(app, () => useControllerContext().instantiate(Adapter))).resolves.toBe(
      adapter,
    )
    expect(warnings.filter((w) => w.includes('test/subclass'))).toEqual([])
  })

  it('instantiate() of an unattached injectable subclass of the attached adapter class uses plain DI, silently', async () => {
    const { logger, warnings } = createCaptureLogger()
    const Adapter = defineAdapterClass('test/unattached-subclass')
    @Injectable()
    class Helper extends Adapter {}
    const app = new Moost({ logger })
    const adapter = app.adapter(new Adapter())
    await app.init()

    const helper = await inAppEvent(app, () => useControllerContext().instantiate(Helper))
    expect(helper).toBeInstanceOf(Helper)
    expect(helper).not.toBe(adapter)
    expect(warnings.filter((w) => w.includes('test/unattached-subclass'))).toEqual([])
  })

  it('a branded class with no matching adapter attached still fails as not injectable', async () => {
    const Adapter = defineAdapterClass('test/not-attached')
    const app = new Moost({ logger: createCaptureLogger().logger })
    await app.init()

    await expect(
      inAppEvent(app, () => useControllerContext().instantiate(Adapter)),
    ).rejects.toThrow(/not Injectable/)
  })
})
