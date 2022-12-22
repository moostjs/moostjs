import http from 'http'

export const PORT = 3123

export interface TRequestResponse {
    body: () => Promise<string>
    header: (name: string) => string
    status: () => number
}

export const send = (method: string, path: string, body?: unknown, _headers?: Record<string, string>): Promise<TRequestResponse> => {
    return new Promise((resolve) => {
        const headers: Record<string, string> = _headers || {}
        if (body) {
            if (typeof body === 'object') {
                body = JSON.stringify(body)
                headers['content-type'] = 'application/json'
            }
            if (!headers['content-type']) {
                headers['content-type'] = 'text/plain'
            }
            if (typeof body === 'string') {
                headers['content-length'] = Buffer.byteLength(body).toString()
            }
        }
        const req = http.request('http://localhost:' + PORT.toString() + '/' + path,
            { method, headers },
            (res) => {
                resolve({
                    body(): Promise<string> {
                        return (new Promise((resolve, reject) => {
                            let body = Buffer.from('')
                            res.on('data', function(chunk) {
                                body = Buffer.concat([body, chunk])
                            })
                            res.on('error', function(err) {
                                reject(err)
                            })
                            res.on('end', function() {
                                resolve(body.toString())
                            })
                        }))
                    },
                    header(headerName: string) {
                        return res.headers[headerName] as string
                    },
                    status() {
                        return res.statusCode || 0
                    },
                })
            })
        if (body) {
            req.write(body)
        }
        req.end()
    })
}

export const get = (path: string): Promise<TRequestResponse> => {
    return send('GET', path)
}

export const post = (path: string, body: unknown): Promise<TRequestResponse> => {
    return send('POST', path, body)
}
