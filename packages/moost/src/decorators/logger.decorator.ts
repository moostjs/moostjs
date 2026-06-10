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
  // useLogger(topic) derives a child logger via createTopic when supported,
  // falling back to the base logger otherwise
  return Resolve(() => (topic ? useLogger(topic) : useLogger()))
}

/**
 * Resolves app-level logger
 * @param topic - logger topic (falls back to @LoggerTopic, then to class @Id)
 * @returns
 */
export function InjectMoostLogger(topic?: string) {
  return Resolve(async (metas) => {
    const moostApp = await resolveMoost()
    const meta = metas.classMeta
    return moostApp.getLogger(topic || meta?.loggerTopic || meta?.id)
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
