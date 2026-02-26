/**
 * Checks whether a value is a PromiseLike (thenable).
 * Single source of truth — import from here instead of duplicating.
 */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    value !== undefined &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  )
}

/**
 * Merges multiple arrays of items with a `priority` field, returning a
 * single sorted-by-priority array.  Accepts `undefined` entries for convenience.
 */
export function mergeSorted<T extends { priority: number }>(
  ...lists: (T[] | readonly T[] | undefined)[]
): T[] {
  let total = 0
  for (const l of lists) {
    if (l) {
      total += l.length
    }
  }
  if (total === 0) {
    return []
  }
  const merged: T[] = []
  for (const l of lists) {
    if (l) {
      for (const item of l) {
        merged.push(item)
      }
    }
  }
  return merged.toSorted((a, b) => a.priority - b.priority)
}
