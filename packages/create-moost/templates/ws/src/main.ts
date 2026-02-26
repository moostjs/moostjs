import {
  WsApp,
  Connect,
  Disconnect,
  Message,
  MessageData,
  ConnectionId,
  Controller,
} from '@moostjs/event-ws'

@Controller()
class ChatController {
  @Connect()
  onConnect(@ConnectionId() id: string) {
    console.log(`Client connected: ${id}`)
  }

  @Message('message')
  onMessage(@MessageData() data: unknown) {
    return { echo: data }
  }

  @Disconnect()
  onDisconnect(@ConnectionId() id: string) {
    console.log(`Client disconnected: ${id}`)
  }
}

new WsApp()
  .controllers(ChatController)
  .start(3000)
  .then(() => {
    console.log('WebSocket server started on port 3000')
  })
