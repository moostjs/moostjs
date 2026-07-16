/**
 * Test fixture: a logger that captures `warn`/`error` output as plain strings
 * so specs can assert on logged diagnostics.
 */
export function createCaptureLogger() {
  const errors: string[] = []
  const warnings: string[] = []
  const noop = () => {}
  const logger = {
    error: (...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    },
    warn: (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    },
    log: noop,
    info: noop,
    debug: noop,
    trace: noop,
  }
  return { logger, errors, warnings }
}
