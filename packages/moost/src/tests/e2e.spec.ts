import { createProvideRegistry } from '@prostojs/infact'
import { Moost } from 'moost'
import { MoostHttp } from '@moostjs/event-http'
import { E2eTestMoost, SECRET, E2eInterceptor } from './e2e.artifacts'
import * as request from './request.artifacts'

describe('moost', () => {
    let moost: Moost
    let moostHttp: MoostHttp
    const globalInterceptor = jest.fn()
    const e2eInterceptor = jest.fn()

    beforeAll(async () => {
        moost = new E2eTestMoost()
        moostHttp = new MoostHttp()
        moost.adapter(moostHttp)
        await moost
            .applyGlobalInterceptors(globalInterceptor)
            .setProvideRegistry(createProvideRegistry([E2eInterceptor, () => new E2eInterceptor(e2eInterceptor)]))
        await moostHttp.listen(request.PORT)
        await moost.init()
    })

    describe('handler methods', () => {
        it('must assign @Get handler', async () => {
            const response = await request.get('getMethod')
            expect(response.status()).toBe(200)
            expect(await response.body()).toEqual('@Get method called')
        })
        // it('must assign @Head handler to @Get method', async () => {
        //     const response = await request.send('HEAD', 'getMethod')
        //     expect(response.status()).toBe(200)
        //     expect(await response.body()).toEqual('')
        // })
        it('must assign @Patch handler', async () => {
            const response = await request.send('PATCH', 'patchMethod')
            expect(response.status()).toBe(202)
            expect(await response.body()).toEqual('@Patch method called')
        })
        it('must assign @Post handler', async () => {
            const response = await request.post('postMethod', {})
            expect(response.status()).toBe(201)
            expect(await response.body()).toEqual('@Post method called')
        })
        it('must assign @Delete handler', async () => {
            const response = await request.send('DELETE', 'deleteMethod')
            expect(response.status()).toBe(202)
            expect(await response.body()).toEqual('@Delete method called')
        })
        it('must return 404 when sending GET request to @Post handler', async () => {
            const response = await request.get('postMethod')
            expect(response.status()).toBe(404)
        })
    })

    describe('nestedControllerMethod', () => {
        it('must call Nested Controller Method', async () => {
            const response = await request.get('nestedControllerMethod?value=1')
            expect(response.status()).toBe(200)
            expect(await response.body()).toEqual('{"value":"1"}')
            const response2 = await request.get('nestedControllerMethod?newValue=2')
            expect(response2.status()).toBe(200)
            expect(await response2.body()).toEqual('{"newValue":"2"}')
        })
        it('must call (FOR_EVENT) Nested Controller Method', async () => {
            const response = await request.get('req/nestedControllerMethod?value=3')
            expect(response.status()).toBe(200)
            expect(await response.body()).toEqual('{"value":"3"}')
            const response2 = await request.get('req/nestedControllerMethod?newValue=4')
            expect(response2.status()).toBe(200)
            expect(await response2.body()).toEqual('{"newValue":"4"}')
        })
    })

    describe('common dependency test', () => {
        it('must inject common dependency in Nested Controller Method', async () => {
            const response = await request.get('common_dep/secret')
            expect(response.status()).toBe(200)
            expect(await response.body()).toEqual(SECRET)
        })
        it('must inject common dependency in (FOR_EVENT) Nested Controller Method', async () => {
            const response = await request.get('req/common_dep/secret')
            expect(response.status()).toBe(200)
            expect(await response.body()).toEqual(SECRET)
        })
        it('must inject common dependency (same instance)', async () => {
            // compare internalSecret of common dependency to make sure it's the same instance
            const response = await request.get('common_dep/internal_secret')
            const response2 = await request.get('req/common_dep/internal_secret')
            expect(response.status()).toBe(200)
            expect(response2.status()).toBe(200)
            expect(await response.body()).toEqual(await response2.body())
        })
    })

    describe('interceptors', () => {
        it('must call globalInterceptor everywhere', async () => {
            const times = Math.round(Math.random() * 5) + 1
            jest.clearAllMocks()
            for (let i = 0; i < times; i++) {
                await request.get('getMethod') // root level
                await request.get('nestedControllerMethod?value=1') // nested controller
                await request.get('req/nestedControllerMethod?value=1') // nested (FOR_EVENT) controller
            }
            expect(globalInterceptor).toHaveBeenCalledTimes(times * 3)
        })
        it('must call local interceptor', async () => {
            const response = await request.get('intercept/test')
            expect(response.status()).toEqual(200)
            expect(e2eInterceptor).toHaveBeenCalledWith('/intercept/test')
            const response2 = await request.get('intercept/test2')
            expect(response2.status()).toEqual(200)
            expect(e2eInterceptor).toHaveBeenCalledWith('/intercept/test2')
        })
        it('must call (FOR_EVENT) local interceptor', async () => {
            const response = await request.get('intercept/for_request')
            expect(response.status()).toEqual(200)
            expect(await response.body()).toEqual('intercepted for url /intercept/for_request')
            const response2 = await request.get('intercept/for_request?second_time')
            expect(response2.status()).toEqual(200)
            expect(await response2.body()).toEqual('intercepted for url /intercept/for_request?second_time')
        })
    })

    afterAll(() => {
        void moostHttp?.getHttpApp().close()
    })
})

