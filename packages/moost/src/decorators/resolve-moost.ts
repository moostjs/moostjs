import { useControllerContext } from '../composables'
import { Moost } from '../moost'

/**
 * Resolves the running {@link Moost} application instance from the current
 * controller context: returns the controller directly when it already IS the
 * Moost app (Moost registers itself as a controller), otherwise resolves it
 * through DI. Shared by `@InjectMoost` and `@InjectMoostLogger`.
 */
export async function resolveMoost(): Promise<Moost> {
  const { instantiate, getController } = useControllerContext()
  const controller = getController()
  return controller instanceof Moost ? controller : await instantiate(Moost)
}
