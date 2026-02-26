import type { TWooksWsOptions } from '@wooksjs/event-ws'
import { Moost } from 'moost'

import { MoostWs } from './event-ws'

interface TWsAppOptions {
  /**
   * WooksWs configuration options
   */
  ws?: TWooksWsOptions
}

/**
 * Quick WS App factory class.
 *
 * Use this class to quickly build a standalone WebSocket application
 * with controllers. It extends the Moost class and wraps MoostWs initialization.
 *
 * @example
 * ```typescript
 * import { WsApp } from '@moostjs/event-ws'
 * import { ChatController } from './chat.controller.ts'
 *
 * new WsApp()
 *   .controllers(ChatController)
 *   .start(3000)
 * ```
 */
export class WsApp extends Moost {
  protected _wsOpts?: TWsAppOptions

  protected _wsAdapter?: MoostWs

  /**
   * Registers one or more WS controllers.
   *
   * (Shortcut for `registerControllers` method.)
   */
  controllers(...controllers: (object | Function | [string, object | Function])[]) {
    return this.registerControllers(...controllers)
  }

  /**
   * Configures the WS options.
   */
  useWsOptions(wsOpts: TWsAppOptions) {
    this._wsOpts = wsOpts
    return this
  }

  /**
   * Returns the underlying MoostWs adapter instance.
   */
  getWsAdapter() {
    return this._wsAdapter
  }

  /**
   * Starts the standalone WebSocket application.
   *
   * @param port - Port to listen on
   * @param hostname - Optional hostname
   */
  async start(port: number, hostname?: string) {
    this._wsAdapter = new MoostWs({
      wooksWs: this._wsOpts?.ws,
    })
    this.adapter(this._wsAdapter)
    await this.init()
    return this._wsAdapter.listen(port, hostname)
  }
}
