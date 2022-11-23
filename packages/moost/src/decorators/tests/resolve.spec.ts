import { getMoostMate } from '../../metadata'
import { ResolveDecoratorsTestClass } from './resolve.artifacts'
import * as wooksComposables from '@wooksjs/event-http'
import * as eventCore from '@wooksjs/event-core'
import * as wooksBody from '@wooksjs/http-body'

jest.mock('@wooksjs/event-http')
const mWooksComposables = wooksComposables as jest.Mocked<typeof wooksComposables>
jest.mock('@wooksjs/event-core')
const mEventCore = eventCore as jest.Mocked<typeof eventCore>
jest.mock('@wooksjs/http-body')
const mWooksBody = wooksBody as jest.Mocked<typeof wooksBody>

console.log('mWooks.useHeaders')

mWooksComposables.useHeaders.mockImplementation(() => ({
    test: 'test header value',
}))

mWooksComposables.useCookies.mockImplementation(() => ({ 
    getCookie: (name: string) => ({ test: 'test cookie value' })[name] || null,
    rawCookies: '',
}))

mEventCore.useRouteParams.mockImplementation(() => ({
    get: () => 'test route param',
    params: { test: 'test route param' },
} as ReturnType<typeof mEventCore.useRouteParams>))

mWooksComposables.useSearchParams.mockImplementation(() => ({
    jsonSearchParams: () => ({ test: 'test query value' }),
    urlSearchParams: () => ({ get: () => 'test query value'}),
} as unknown as ReturnType<typeof wooksComposables.useSearchParams>))

mWooksComposables.useRequest.mockImplementation(() => ({
    url: 'test url',
    method: 'PUT',
    rawRequest: 'raw request',
    rawResponse: () => 'raw response',
} as unknown as ReturnType<typeof wooksComposables.useRequest>))

mWooksComposables.useResponse.mockImplementation(() => ({
    rawResponse: () => 'raw response',
} as unknown as ReturnType<typeof wooksComposables.useResponse>))

mWooksBody.useBody.mockImplementation(() => ({
    parseBody: () => 'parsed body',
    rawBody: () => 'raw body',
} as unknown as ReturnType<typeof mWooksBody.useBody>))

const instance = new ResolveDecoratorsTestClass()
const meta = getMoostMate().read(instance, 'method')

describe('resolve decorators', () => {
    it('must set resolved for @Resolve', () => {
        const i = 0
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta?.params[i].resolver()).toBe('resolved')
        }
    })
    it('must set resolved for @Header', () => {
        const i = 1
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toBe('test header value')
        }
    })
    it('must set resolved for @Cookie', () => {
        const i = 2
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toBe('test cookie value')
        }
    })
    it('must set resolved for @Param', () => {
        const i = 3
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toBe('test route param')
        }
    })
    it('must set resolved for @Params', () => {
        const i = 4
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toEqual({ test: 'test route param' })
        }
    })
    it('must set resolved for @Query', () => {
        const i = 5
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toEqual({ test: 'test query value' })
        }
    })
    it('must set resolved for @Url', () => {
        const i = 6
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toBe('test url')
        }
    })
    it('must set resolved for @Method', () => {
        const i = 7
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toBe('PUT')
        }
    })
    it('must set resolved for @Req', () => {
        const i = 8
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toBe('raw request')
        }
    })
    it('must set resolved for @Res', () => {
        const i = 9
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toBe('raw response')
        }
    })
    it('must set resolved for @Const', () => {
        const i = 10
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta?.params[i].resolver()).toBe(10)
        }
    })
    it('must set resolved for @Body', () => {
        const i = 11
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toBe('parsed body')
        }
    })
    it('must set resolved for @RawBody', () => {
        const i = 12
        expect((meta?.params || [])[i]).toHaveProperty('resolver')
        if (meta?.params[i].resolver) {
            expect(meta.params[i].resolver()).toBe('raw body')
        }
    })
})
