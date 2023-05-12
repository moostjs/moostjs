import { HttpError } from '@wooksjs/event-http'
import { validatePipe } from 'moost'
import { TObject } from 'common'

export function httpValidatePipe(opts: Parameters<typeof validatePipe>) {
    return validatePipe({
        errorCb: (message, details) => {
            throw new HttpError<{
                statusCode: number
                message: string
                error: string
                details: string | TObject
            }>(400, {
                statusCode: 400,
                message,
                error: 'Validation Error',
                details,
            })
        },
        ...opts[0],
    })
}
