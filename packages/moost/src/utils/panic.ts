/* istanbul ignore file */
import { logError } from './log'

export function panic(error: string) {
    logError(error)
    return new Error(error)
}
