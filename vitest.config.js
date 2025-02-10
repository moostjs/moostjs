/* eslint-disable unicorn/no-abusive-eslint-disable */
/* eslint-disable */
import { defineConfig } from 'vitest/config'
import { createDyeReplacements } from '@prostojs/dye/common'
import swc from 'unplugin-swc'
const define = createDyeReplacements()
for (const key of Object.keys(define)) {
  define[key] = '""'
}
define.__VERSION__ = '"0.1.2"'
export default defineConfig({
  define,
  plugins: [swc.vite()],
  test: {
    globals: true,
  },
})
