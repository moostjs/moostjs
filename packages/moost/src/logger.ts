import type { TConsoleBase } from '@prostojs/logger'
import { coloredConsole, createConsoleTransort, ProstoLogger } from '@prostojs/logger'

let defaultLogger: TConsoleBase | ProstoLogger | undefined

export function setDefaultLogger(logger: TConsoleBase) {
  defaultLogger = logger
}

export function getDefaultLogger(topic: string) {
  if (!defaultLogger) {
    defaultLogger = new ProstoLogger({
      level: 4,
      transports: [
        createConsoleTransort({
          format: coloredConsole,
        }),
      ],
    })
  }
  return topic && defaultLogger instanceof ProstoLogger
    ? defaultLogger.createTopic(topic)
    : defaultLogger
}
