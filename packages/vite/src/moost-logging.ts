import { Moost } from 'moost'

/**
 * A single record describing a handler binding in Moost.
 * @property {string} eventName - The name of the event/route (e.g. HTTP verb + path).
 * @property {Function} classConstructor - The controller class constructor.
 * @property {string} method - The name of the method within the controller class.
 */
interface TItem {
  eventName: string
  classConstructor: Function
  method: string
}

/**
 * Converts a TItem into a flattened string to uniquely identify it.
 * @param {TItem} item - The handler registration item to flatten.
 * @returns {string} A unique string key for the item.
 */
function flattenItem(item: TItem): string {
  return `${item.eventName}||${item.classConstructor.name}||${item.method}`
}

/**
 * A storage mechanism to track old and new handler registrations
 * across multiple initialization cycles. During each init:
 * 1. Start recording newly encountered handlers.
 * 2. Compare them against previously recorded handlers to detect
 *    which are newly added vs. removed.
 * 3. Store the new state as the old map for the next cycle.
 */
class LogsStorage {
  /**
   * A map of flattenItem() => TItem
   * representing the previous cycle's known handlers.
   */
  oldMap = new Map<string, TItem>()

  /**
   * The handlers discovered in the current cycle,
   * awaiting finalization.
   */
  newItems: TItem[] = []

  isFirstRun = true

  /**
   * Called at the start of an init cycle to
   * clear out the list of new items.
   */
  startRecording() {
    this.newItems = []
  }

  /**
   * Records a newly encountered handler (via logMappedHandler).
   *
   * @param {TItem} item - The handler registration item to record.
   * @returns {boolean} True if this item is newly added (not in oldMap),
   *                    false if it existed already.
   */
  record(item: TItem): boolean {
    const flat = flattenItem(item)
    this.newItems.push(item)
    return !this.oldMap.has(flat)
  }

  /**
   * Called at the end of an init cycle.
   * 1. Builds a newMap of all newly encountered handlers.
   * 2. Logs/strokes out any handlers that have disappeared compared
   *    to the previous cycle.
   * 3. Updates oldMap so it becomes the baseline for the next cycle.
   *
   * @param {(item: TItem) => void} logRemovedItem - A callback that logs
   *        removed items (presumably by striking them out).
   */
  endRecording(logRemovedItem: (item: TItem) => void) {
    const newMap = new Map<string, TItem>()

    // Build newMap from the newItems collected during this cycle
    for (const item of this.newItems) {
      const flat = flattenItem(item)
      newMap.set(flat, item)
    }

    // For every item in oldMap that isn't present in newMap,
    // call the provided logRemovedItem callback
    for (const [flat, item] of this.oldMap.entries()) {
      if (!newMap.has(flat)) {
        logRemovedItem(item)
      }
    }

    // Update oldMap so the next init cycle compares against this newMap
    this.oldMap = newMap
    this.newItems = []

    this.isFirstRun = false
  }
}

/**
 * A reference to a shared LogsStorage instance that persists
 * across init cycles in dev mode.
 */
let logsStorage: LogsStorage | undefined

/** Whether {@link patchMoostHandlerLogging} already installed its wrappers in this process. */
let installed = false

/**
 * The slot {@link captureMoostInit} fills: receives every `init()` promise the
 * wrapper below produces. Unset in prod/test, where nothing consumes a capture.
 */
let onInitCaptured: ((promise: Promise<void>) => void) | undefined

/**
 * Hands every `Moost.prototype.init()` promise to `onCapture`, letting a boot
 * await the app's **initialization** instead of only its module evaluation.
 *
 * The documented entry shape is `app.adapter(http).listen(port)` followed by an
 * **un-awaited** `app.init()`: the HTTP middleware is therefore captured *before*
 * init finishes, and nothing else observes a rejecting init — a bind error, a DI
 * audit error or a throwing `@MoostInit` hook would leave the dev server serving
 * a half-booted app (the routes bound before the failure answer 200, the rest
 * fall through to the SPA fallback) instead of the plugin's 502. That is also
 * why the plugin's `bootError` gate runs BEFORE the captured middleware, and why
 * the SSR fallback checks it too: `listen()` ran first and left both a middleware
 * and the local-fetch hook behind.
 *
 * Patches the plugin's **own** `moost` import, exactly like the handler logging
 * does: in dev the runtime is externalized, so the plugin and the app share one
 * native `moost` instance (the premise the DI eject in `restart-cleanup` rests on
 * too, and what `ssrExternalCheck` warns about when it stops holding). Unlike the
 * adapters there is nothing to re-establish per reload — a static import is never
 * re-evaluated — and unlike them it must NOT be pulled through the SSR module
 * runner: importing `moost` there registers it as the runner's first module and
 * makes subsequent hot updates re-evaluate the entry only, serving every one of
 * its dependencies (controllers included) from the stale cache.
 *
 * There is exactly ONE `init` wrapper per process (installed by
 * {@link patchMoostHandlerLogging}) and this only fills its slot, so the newest
 * plugin instance wins: Vite re-imports the config on every config-file
 * `server.restart()`, re-running the plugin factory, and a per-instance wrapper
 * would stack on the previous one and keep the dead instance's scope alive.
 *
 * @param onCapture receives each captured init promise (already marked handled).
 */
export function captureMoostInit(onCapture: (promise: Promise<void>) => void): void {
  onInitCaptured = onCapture
}

/**
 * Patches Moost’s .init() and .logMappedHandler() methods — once per process —
 * so that, during dev:
 * - Only newly added handlers are logged normally.
 * - Removed handlers are logged/stroked out to indicate removal.
 * - Prevents repeated logs from flooding the console across multiple hot reloads.
 * - Every init() promise reaches the {@link captureMoostInit} slot, if filled.
 */
export function patchMoostHandlerLogging(): void {
  if (installed) {
    return
  }
  installed = true

  // Save the original methods
  const origInit = Moost.prototype.init
  const origLogMappedHandler = Moost.prototype.logMappedHandler

  /**
   * The logging body of the patched Moost.init:
   * 1. Start a new recording cycle in LogsStorage.
   * 2. Call the real .init().
   * 3. End the recording, logging any removed handlers.
   */
  const initWithLogging = async function (this: Moost) {
    if (!logsStorage) {
      logsStorage = new LogsStorage()
    }

    // Begin tracking newly encountered handlers this cycle
    logsStorage.startRecording()

    // Run the original init code
    await origInit.call(this)

    // End tracking: log any removed items by calling the
    // replaced logMappedHandler with a "removed" flag
    logsStorage.endRecording((item: TItem) => {
      // Provide a 4th argument (true) to indicate removal,
      // which the original logging might show as struck out.
      origLogMappedHandler.call(
        this,
        item.eventName,
        item.classConstructor,
        item.method,
        true,
        '❌ ',
      )
    })
  }

  Moost.prototype.init = function init() {
    const promise = initWithLogging.call(this)
    if (onInitCaptured) {
      // Marked handled here, not at the boot's await: the entry leaves `app.init()`
      // un-awaited, and an init rejecting before the boot reaches its await would
      // take the dev server down on `unhandledRejection`. Awaiting the same promise
      // later still throws.
      promise.catch(() => {})
      onInitCaptured(promise)
    }
    return promise
  }

  /**
   * Monkey-patch Moost.logMappedHandler:
   * If we haven’t seen this particular route+class+method combination
   * in a previous cycle, call the original logger. Otherwise, skip it
   * to avoid duplicate logs.
   */
  Moost.prototype.logMappedHandler = function logMappedHandler(
    eventName: string,
    classConstructor: Function,
    method: string,
  ) {
    // logsStorage.record returns true if this item is new
    // (not seen in oldMap)
    if (logsStorage!.record({ eventName, classConstructor, method })) {
      origLogMappedHandler.call(
        this,
        eventName,
        classConstructor,
        method,
        false,
        logsStorage!.isFirstRun ? '' : '✅ ',
      )
    }
  }
}
