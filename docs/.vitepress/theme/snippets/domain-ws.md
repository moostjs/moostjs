```ts
@Controller()
export class ChatController {
  @Message('join', '/chat/:room')
  join(
    @Param('room') room: string,
    @MessageData() data: { name: string },
  ) {
    const { join, broadcast } = useWsRooms()
    join()
    broadcast('system', { text: `${data.name} joined` })
  }

  @Message('message', '/chat/:room')
  send(@MessageData() data: { text: string }) {
    const { broadcast } = useWsRooms()
    broadcast('message', data)
  }
}
```
