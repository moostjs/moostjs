import { getMoostMate, TInjectableScope } from '../metadata/moost-metadata'

/**
 * Mark the Class as Injectable to enable it to be used in dependency injection
 * @decorator
 * @param scope - Scope for injection ("FOR_EVENT" | "SINGLETON" | true)
 * FOR_EVENT - will create a new instance for each incoming request
 * SINGLETON | true - will create a new instance only once
 * @param label - field label
 */
export function Injectable(scope: true | TInjectableScope = true): ClassDecorator {
    return getMoostMate().decorate('injectable', scope)
}

export const insureInjectable = getMoostMate().decorate((meta) => {
    if (!meta.injectable) meta.injectable = true
    return meta
})
