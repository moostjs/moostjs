/* istanbul ignore file */
import { banner } from './banner'

export function log(text: string) {
    console.log(__DYE_GREEN__ + __DYE_DIM__ + banner() + text + __DYE_RESET__)
}

export function logBright(text: string) {
    console.log(__DYE_GREEN__ + banner() + text + __DYE_RESET__)
}

export function warn(text: string) {
    console.warn(__DYE_YELLOW__ + banner() + text + __DYE_RESET__)
}

export function logError(error: string) {
    console.error(__DYE_RED_BRIGHT__ + __DYE_BOLD__ + banner() + error + __DYE_RESET__)
}

export function traceError(expl: string, e: Error) {
    logError(expl)
    logError(e.message)
    if (e.stack) {
        warn(e.stack)
    }    
}