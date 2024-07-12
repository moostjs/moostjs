import { getOtelMate } from './otel.mate'

const mate = getOtelMate()

/**
 * Annotate controller and/or handler to filter
 * out the corresponding spans from transporting
 *
 * Requires use of MoostBatchSpanProcessor or MoostSimpleSpanProcessor
 */
export const OtelIgnoreSpan = () => mate.decorate('otelIgnoreSpan', true)

/**
 * Annotate controller and/or handler to suppress metrics
 */
export const OtelIgnoreMeter = () => mate.decorate('otelIgnoreMeter', true)
