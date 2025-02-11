import { getConstructor, useAsyncEventContext, useControllerContext } from 'moost'

import type { TArbacMeta } from './arbac.mate'
import { MoostArbac } from './moost-arbac'
import { ArbacUserProvider } from './user.provider'

/**
 * Composable for ARBAC (Advanced Role-Based Access Control) utilities within MoostJS.
 *
 * @template TScope - Type representing the scope of access control.
 */
export function useArbac<TScope extends object>() {
  const store = useAsyncEventContext<{
    arbac: {
      scopes: TScope[] | undefined
    }
  }>().store('arbac')

  const cc = useControllerContext()

  const getScopes = () => store.get('scopes')
  const setScopes = (scope: TScope[] | undefined) => store.set('scopes', scope)

  const evaluate = async (opts: { resource: string; action: string }) => {
    const user = await cc.instantiate(ArbacUserProvider)
    const userId = await user.getUserId()
    const arbac = (await cc.instantiate(MoostArbac)) as MoostArbac<object, TScope>
    const result = await arbac.evaluate(opts, {
      id: userId,
      roles: await user.getRoles(userId),
      attrs: async (id: string) => user.getAttrs(id),
    })
    Object.assign(result, { userId })
    return result as typeof result & { userId: string }
  }

  const cMeta = cc.getControllerMeta() as
    | (ReturnType<typeof cc.getControllerMeta> & TArbacMeta)
    | undefined
  const mMeta = cc.getMethodMeta() as
    | (ReturnType<typeof cc.getControllerMeta> & TArbacMeta)
    | undefined

  const resource =
    mMeta?.arbacResourceId ||
    cMeta?.arbacResourceId ||
    cMeta?.id ||
    getConstructor(cc.getController()).name
  const action = mMeta?.arbacActionId || mMeta?.id || cc.getMethod() || ''
  const isPublic = mMeta?.arbacPublic || cMeta?.arbacPublic || false

  return {
    /**
     * Get evaluated scopes
     */
    getScopes,
    /**
     * Set evaluated scopes
     */
    setScopes,
    /**
     * Evaluate access control for the given resource and action.
     */
    evaluate,
    /**
     * Current resource
     */
    resource,
    /**
     * Current action
     */
    action,
    /**
     * Public flag (if true, access must be granted without evaluation)
     */
    isPublic,
  }
}
