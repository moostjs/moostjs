// oxlint-disable max-classes-per-file -- the DI graph of one bundled-server scenario
import {
  Controller,
  createProvideRegistry,
  createReplaceRegistry,
  getMoostMate,
  Injectable,
  Moost,
  useControllerContext,
} from 'moost'
import { afterEach, describe, expect, it } from 'vitest'

import { Get } from './decorators'
import { MoostHttp } from './event-http'

// Two DI tokens with identical source text — what a bundler makes of abstract
// token classes once their abstract members are erased (`var X = class {}`).
const AppLogger = class {}
// oxlint-disable-next-line no-redeclare -- class token + its instance shape
interface AppLogger {
  info: (msg: string) => string
}
const UserProvider = class {}
// oxlint-disable-next-line no-redeclare -- class token + its instance shape
interface UserProvider {
  id: number
}

let userSeq = 0

@Injectable('FOR_EVENT')
class RequestUser {
  readonly id = ++userSeq
}

/** A singleton built at startup that depends on the logger token by type. */
@Injectable()
class AuditService {
  constructor(readonly logger: AppLogger) {}
}

@Controller()
class MeController {
  constructor(readonly audit: AuditService) {}

  @Get('me')
  async me() {
    const user = (await useControllerContext().instantiate(UserProvider)) as UserProvider
    return {
      user: user.id,
      isRequestUser: user instanceof RequestUser,
      log: this.audit.logger.info('me'),
    }
  }
}

describe('DI keys by class identity on a real server', () => {
  let http: MoostHttp | undefined
  afterEach(async () => {
    await http?.onDispose()
    http = undefined
  })

  it('boots a singleton on one class {} token beside a FOR_EVENT replacement of another', async () => {
    expect(String(AppLogger)).toBe(String(UserProvider))
    // the param type is the token class itself (decorator metadata), i.e. the by-type path
    expect(getMoostMate().read(AuditService)?.params?.[0]?.type).toBe(AppLogger)

    const app = new Moost()
    app.setProvideRegistry(
      createProvideRegistry([AppLogger, () => ({ info: (msg: string) => `logged:${msg}` })]),
    )
    app.setReplaceRegistry(createReplaceRegistry([UserProvider, RequestUser]))
    http = new MoostHttp()
    app.adapter(http)
    app.registerControllers(MeController)
    // up to 0.6.40 the replacement also hit AppLogger (same key): startup failed
    // resolving the FOR_EVENT RequestUser outside of any event scope
    await app.init()
    await http.listen(0)
    const address = http.getHttpApp().getServer()!.address() as { port: number }

    const get = async () => {
      const res = await fetch(`http://127.0.0.1:${address.port}/me`)
      expect(res.status).toBe(200)
      return (await res.json()) as { user: number; isRequestUser: boolean; log: string }
    }
    const first = await get()
    const second = await get()
    expect(first).toMatchObject({ isRequestUser: true, log: 'logged:me' })
    expect(second).toMatchObject({ isRequestUser: true, log: 'logged:me' })
    // each request resolves its own request-scoped user
    expect(second.user).not.toBe(first.user)
  })
})
