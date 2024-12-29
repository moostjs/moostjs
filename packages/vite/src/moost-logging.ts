/* eslint-disable @typescript-eslint/ban-types */
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

/**
 * Patches Moost’s .init() and .logMappedHandler() methods so that, during dev:
 * - Only newly added handlers are logged normally.
 * - Removed handlers are logged/stroked out to indicate removal.
 * - Prevents repeated logs from flooding the console across multiple hot reloads.
 */
export function patchMoostHandlerLogging(): void {
  // Save the original init method
  const origInit = Moost.prototype.init

  /**
   * Monkey-patch Moost.init:
   * 1. Start a new recording cycle in LogsStorage.
   * 2. Call the real .init().
   * 3. End the recording, logging any removed handlers.
   */
  Moost.prototype.init = async function init() {
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
        '✖️ '
      )
    })
  }

  // Save the original logMappedHandler method
  const origLogMappedHandler = Moost.prototype.logMappedHandler

  /**
   * Monkey-patch Moost.logMappedHandler:
   * If we haven’t seen this particular route+class+method combination
   * in a previous cycle, call the original logger. Otherwise, skip it
   * to avoid duplicate logs.
   */
  Moost.prototype.logMappedHandler = function logMappedHandler(
    eventName: string,
    classConstructor: Function,
    method: string
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
        logsStorage!.isFirstRun ? '' : '➕ '
      )
    }
  }
}
