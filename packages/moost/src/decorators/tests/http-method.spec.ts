import { getMoostMate } from '../../metadata/moost-metadata'
import { HttpMethodTestClass } from './http-method.artifacts'

function simpleTest(fnName: string, httpMethod: string, path?: string) {
    const meta = getMoostMate().read(HttpMethodTestClass, fnName)

    expect(meta).toHaveProperty('httpHandler')
    expect(meta?.httpHandler).toHaveLength(1)
    if (meta?.httpHandler) {
        expect(meta.httpHandler[0]).toEqual({ method: httpMethod, path: path })
    }
}

const tests = [
    ['Get(\'\')', 'root', 'GET', ''],
    ['Get(\'path\')', 'test', 'GET', 'path'],

    ['All()', 'all', '*', undefined],
    ['Get()', 'get', 'GET', undefined],
    ['Put()', 'put', 'PUT', undefined],
    ['Post()', 'post', 'POST', undefined],
    ['Delete()', 'delete', 'DELETE', undefined],
    ['Patch()', 'patch', 'PATCH', undefined],

    ['HttpMethod("OPTIONS")', 'options', 'OPTIONS', undefined],
]

describe('http-method.decorator', () => {
    for (const t of tests as [string, string, string, string][]) {
        const s = JSON.stringify(t[3])
        it(`@${ t[0] } must resolve to http method '${t[2]}' for "${ t[1] }" with path = ${ s }`, () => {
            simpleTest(...(t.slice(1) as [string, string, string]))
        })        
    }
})
