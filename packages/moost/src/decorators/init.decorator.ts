import { getMoostMate } from '../metadata/moost-metadata'
import { resolveMoost } from './resolve-moost'
import { Resolve } from './resolve.decorator'

/**
 * ## MoostInit
 * ### @Decorator
 * Marks a controller method to run **once**, after Moost has bound every
 * controller (so the full `getControllersOverview()` is available) and
 * **before** adapters begin serving.
 *
 * The method runs on the controller's SINGLETON instance inside a synthetic
 * init context. Argument injection goes through the RESOLVE pipe only —
 * constructor injection, `@InjectMoost`, `@Inject`, and other `@Resolve`-based
 * params work; transform/validate pipes and interceptors are **not** applied
 * (init is application setup, not an event). Request-scoped composables
 * (`useRequest`, `useHeaders`, `useRouteParams`, …) are unavailable. Async
 * methods are awaited; a throwing hook rejects `Moost.init()` (fail-fast).
 *
 * Applying `@MoostInit` to a `FOR_EVENT` controller is a configuration error and
 * throws at bind time (there is no singleton instance / event at init).
 *
 * @param opts.priority lower runs first across all `@MoostInit` methods (default 0)
 *
 * @example
 * ```ts
 * │  @Controller('auth')
 * │  export class AuthController {
 * │    constructor(private readonly holder: RefreshPathHolder) {}
 * │
 * │    @MoostInit()
 * │    initRefreshCookiePath(@InjectMoost() moost: Moost) {
 * │      // overview is COMPLETE here — this controller's route is mounted
 * │      this.holder.value = resolveRefreshCookiePath(moost)
 * │    }
 * │  }
 * ```
 */
export function MoostInit(opts?: { priority?: number }): MethodDecorator {
  return getMoostMate().decorate('moostInit', { priority: opts?.priority ?? 0 }, false)
}

/**
 * ## InjectMoost
 * ### @Decorator
 * Injects the running {@link Moost} application instance into a method (or
 * constructor) parameter. Intended for `@MoostInit` methods that need the wired
 * app (e.g. `getControllersOverview()`), but works in any DI-resolved position.
 */
export function InjectMoost() {
  return Resolve(() => resolveMoost())
}
