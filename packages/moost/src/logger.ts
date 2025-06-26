import type { TConsoleBase, TProstoLoggerOptions } from '@prostojs/logger'
import { coloredConsole, createConsoleTransort, ProstoLogger } from '@prostojs/logger'

let defaultLogger: TConsoleBase | ProstoLogger | undefined

export function setDefaultLogger(logger: TConsoleBase) {
  defaultLogger = logger
}

export function getDefaultLogger(topic: string) {
  if (!defaultLogger) {
    defaultLogger = new ProstoLogger({
      level: 4,
      transports: [loggerConsoleTransport],
    })
  }
  return topic && defaultLogger instanceof ProstoLogger
    ? defaultLogger.createTopic(topic)
    : defaultLogger
}

export function createLogger(opts?: Partial<TProstoLoggerOptions>): ProstoLogger {
  return new ProstoLogger({
    ...opts,
    level: opts?.level ?? 4,
    transports: opts?.transports ?? [loggerConsoleTransport],
  })
}

export const loggerConsoleTransport = createConsoleTransort({
  format: coloredConsole,
})
