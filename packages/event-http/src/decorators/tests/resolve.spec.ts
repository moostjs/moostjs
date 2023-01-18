import { ResolveDecoratorsTestClass } from './resolve.artifacts'
import * as wooksComposables from '@wooksjs/event-http'
import * as eventCore from '@wooksjs/event-core'
import * as wooksBody from '@wooksjs/http-body'
import { getMoostMate } from 'moost'

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

describe('resolve http-decorators', () => {
    it('must set resolved for @Header', () => {
        const i = 0
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(meta.params[i].resolver({
                    methodMeta: meta,
                    paramMeta: meta.params[i],
                }, 'PARAM')).toBe('test header value')
            }
        }
    })
    it('must set resolved for @Cookie', () => {
        const i = 1
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(meta.params[i].resolver({
                    methodMeta: meta,
                    paramMeta: meta.params[i],
                }, 'PARAM')).toBe('test cookie value')
            }
        }
    })
    it('must set resolved for @Query', () => {
        const i = 2
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(meta.params[i].resolver({
                    methodMeta: meta,
                    paramMeta: meta.params[i],
                }, 'PARAM')).toEqual({ test: 'test query value' })
            }
        }
    })
    it('must set resolved for @Url', () => {
        const i = 3
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(meta.params[i].resolver({
                    methodMeta: meta,
                    paramMeta: meta.params[i],
                }, 'PARAM')).toBe('test url')
            }
        }
    })
    it('must set resolved for @Method', () => {
        const i = 4
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(meta.params[i].resolver({
                    methodMeta: meta,
                    paramMeta: meta.params[i],
                }, 'PARAM')).toBe('PUT')
            }
        }
    })
    it('must set resolved for @Req', () => {
        const i = 5
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(meta.params[i].resolver({
                    methodMeta: meta,
                    paramMeta: meta.params[i],
                }, 'PARAM')).toBe('raw request')
            }
        }
    })
    it('must set resolved for @Res', () => {
        const i = 6
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(meta.params[i].resolver({
                    methodMeta: meta,
                    paramMeta: meta.params[i],
                }, 'PARAM')).toBe('raw response')
            }
        }
    })
    it('must set resolved for @Body', () => {
        const i = 7
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(meta.params[i].resolver({
                    methodMeta: meta,
                    paramMeta: meta.params[i],
                }, 'PARAM')).toBe('parsed body')
            }
        }
    })
    it('must set resolved for @RawBody', () => {
        const i = 8
        expect(meta?.params).toBeDefined()
        if (meta?.params) {
            expect((meta?.params || [])[i]).toHaveProperty('resolver')
            if (meta?.params[i].resolver) {
                expect(meta.params[i].resolver({
                    methodMeta: meta,
                    paramMeta: meta.params[i],
                }, 'PARAM')).toBe('raw body')
            }
        }
    })
})
