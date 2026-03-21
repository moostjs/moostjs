import { createSSRServer } from '@moostjs/vite/server'

const app = await createSSRServer()
await app.listen()
