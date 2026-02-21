import { replaceContextInjector } from 'moost'

import { SpanInjector } from './span-injector'

export function enableOtelForMoost() {
  replaceContextInjector(new SpanInjector())
}
