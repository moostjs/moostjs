import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { moostVite } from '@moostjs/vite'

export default defineConfig({
  appType: 'custom',
  server: { port: 3000 },
  plugins: [
    vue(),
    moostVite({
      entry: '/src/main.ts',
      middleware: true,
      prefix: '/api',
//=IF (ssr)
      ssrEntry: '/src/entry-server.ts',
//=END IF
    }),
  ],
})
