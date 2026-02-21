import { replaceContextInjector } from 'moost'

import { SpanInjector } from './span-injector'

/**
 * Enables OpenTelemetry integration for Moost by replacing the default
 * context injector with a span-aware `SpanInjector`.
 * Call this before creating or starting your Moost application.
 */
export function enableOtelForMoost() {
  replaceContextInjector(new SpanInjector())
}
