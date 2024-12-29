import { useEventLogger } from '@wooksjs/event-core'

import { useControllerContext } from '../composables'
import { getMoostMate } from '../metadata'
import { Moost } from '../moost'
import { Resolve } from './resolve.decorator'

/**
 * Resolves event logger from event context
 * @param topic
 * @returns Resolver to '@wooksjs/event-core' (EventLogger)
 */
export function InjectEventLogger(topic?: string) {
  return Resolve(() => useEventLogger(topic))
}

/**
 * Resolves app-level logger
 * @param topic - logger topic (can be overrided by @LoggerTopic)
 * @returns
 */
export function InjectMoostLogger(topic?: string) {
  return Resolve(async () => {
    const { instantiate, getControllerMeta } = useControllerContext()
    const moostApp = await instantiate(Moost)
    const meta = getControllerMeta()
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
