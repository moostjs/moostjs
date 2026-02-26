import { Upgrade } from "@moostjs/event-http";
import {
  Connect,
  ConnectionId,
  Disconnect,
  Message,
  MessageData,
  WooksWs,
} from "@moostjs/event-ws";
import { Controller, Param } from "moost";

/**
 * `WsController` handles the WebSocket upgrade route
 * and WebSocket message/connection events.
 *
 * The @Upgrade decorator registers an HTTP route that upgrades
 * the connection to WebSocket. Message handlers use the
 * @Message decorator to handle incoming WebSocket messages.
 */
@Controller()
export class WsController {
  constructor(private ws: WooksWs) {}

  @Upgrade("ws")
  handleUpgrade() {
    return this.ws.upgrade();
  }

  @Connect()
  onConnect(@ConnectionId() id: string) {
    console.log(`WS client connected: ${id}`);
  }

  @Message("message")
  onMessage(@MessageData() data: unknown) {
    return { echo: data };
  }

  @Disconnect()
  onDisconnect(@ConnectionId() id: string) {
    console.log(`WS client disconnected: ${id}`);
  }
}
