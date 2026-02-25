import { useLogger } from '@wooksjs/event-core'

import { useControllerContext } from '../composables'
import { getMoostMate } from '../metadata'
import { Moost } from '../moost'
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
    const { instantiate, getController } = useControllerContext()
    const controller = getController()
    const moostApp = controller instanceof Moost ? controller : await instantiate(Moost)
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
