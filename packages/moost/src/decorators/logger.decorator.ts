import { useLogger } from '@wooksjs/event-core'

import { getMoostMate } from '../metadata'
import { resolveMoost } from './resolve-moost'
import { Resolve } from './resolve.decorator'

/**
 * Resolves event logger from event context
 * @param topic
 * @returns Resolver to '@wooksjs/event-core' (Logger)
 */
export function InjectEventLogger(topic?: string) {
  return Resolve(() => {
    const l = useLogger()
    return topic && typeof l.topic === 'function' ? l.topic(topic) : l
  })
}

/**
 * Resolves app-level logger
 * @param topic - logger topic (can be overrided by @LoggerTopic)
 * @returns
 */
export function InjectMoostLogger(topic?: string) {
  return Resolve(async (metas) => {
    const moostApp = await resolveMoost()
    const meta = metas.classMeta
    return moostApp.getLogger(meta?.loggerTopic || topic || meta?.id)
  })
}

/**
 * Sets logger topic (used in @InjectMoostLogger)
 * @param topic - logger topic (banner)
 * @returns
 */
export function LoggerTopic(topic: string) {
  return getMoostMate().decorate('loggerTopic', topic)
}
