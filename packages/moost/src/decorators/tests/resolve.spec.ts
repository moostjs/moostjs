import { getMoostMate } from '../../metadata'
import { ResolveDecoratorsTestClass } from './resolve.artifacts'
import * as wooksComposables from '@wooksjs/event-http'
import * as eventCore from '@wooksjs/event-core'
import * as wooksBody from '@wooksjs/http-body'

jest.mock('@wooksjs/event-http')
const mWooksComposables = wooksComposables as jest.Mocked<
    typeof wooksComposables
>
jest.mock('@wooksjs/event-core')
const mEventCore = eventCore as jest.Mocked<typeof eventCore>
jest.mock('@wooksjs/http-body')
const mWooksBody = wooksBody as jest.Mocked<typeof wooksBody>

console.log('mWooks.useHeaders')

mWooksComposables.useHeaders.mockImplementation(() => ({
    test: 'test header value',
}))

mWooksComposables.useCookies.mockImplementation(() => ({
    getCookie: (name: string) => ({ test: 'test cookie value' }[name] || null),
    rawCookies: '',
}))

mEventCore.useRouteParams.mockImplementation(
    () =>
        ({
            get: () => 'test route param',
            params: { test: 'test route param' },
        } as ReturnType<typeof mEventCore.useRouteParams>)
)

mWooksComposables.useSearchParams.mockImplementation(
    () =>
        ({
            jsonSearchParams: () => ({ test: 'test query value' }),
            urlSearchParams: () => ({ get: () => 'test query value' }),
        } as unknown as ReturnType<typeof wooksComposables.useSearchParams>)
)

mWooksComposables.useRequest.mockImplementation(
    () =>
        ({
            url: 'test url',
            method: 'PUT',
            rawRequest: 'raw request',
            rawResponse: () => 'raw response',
        } as unknown as ReturnType<typeof wooksComposables.useRequest>)
)

mWooksComposables.useResponse.mockImplementation(
    () =>
        ({
            rawResponse: () => 'raw response',
        } as unknown as ReturnType<typeof wooksComposables.useResponse>)
)

mWooksBody.useBody.mockImplementation(
    () =>
        ({
            parseBody: () => 'parsed body',
            rawBody: () => 'raw body',
        } as unknown as ReturnType<typeof mWooksBody.useBody>)
)

const instance = new ResolveDecoratorsTestClass()
const meta = getMoostMate().read(instance, 'method')

describe('resolve decorators', () => {
    it('must set resolved for @Resolve', () => {
        const i = 0
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect(meta.params[i]).toHaveProperty('resolver')
            if (meta.params[i].resolver) {
                expect(
                    meta.params[i].resolver(
                        {
                            methodMeta: meta,
                            type: ResolveDecoratorsTestClass,
                            paramMeta: meta.params[i],
                            targetMeta: meta.params[i],
                            key: '',
                        },
                        'PARAM'
                    )
                ).toBe('resolved')
            }
        }
    })
    it('must set resolved for @Param', () => {
        const i = 1
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(eventCore.useRouteParams().get('test')).toBe(
                    'test route param'
                )
                expect(
                    meta.params[i].resolver(
                        {
                            methodMeta: meta,
                            type: ResolveDecoratorsTestClass,
                            paramMeta: meta.params[i],
                            targetMeta: meta.params[i],
                            key: '',
                        },
                        'PARAM'
                    )
                ).toBe('test route param')
            }
        }
    })
    it('must set resolved for @Params', () => {
        const i = 2
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(
                    meta.params[i].resolver(
                        {
                            methodMeta: meta,
                            type: ResolveDecoratorsTestClass,
                            paramMeta: meta.params[i],
                            targetMeta: meta.params[i],
                            key: '',
                        },
                        'PARAM'
                    )
                ).toEqual({ test: 'test route param' })
            }
        }
    })
    it('must set resolved for @Const', () => {
        const i = 3
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(
                    meta?.params[i].resolver(
                        {
                            methodMeta: meta,
                            type: ResolveDecoratorsTestClass,
                            paramMeta: meta.params[i],
                            targetMeta: meta.params[i],
                            key: '',
                        },
                        'PARAM'
                    )
                ).toBe(10)
            }
        }
    })
})
