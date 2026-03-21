import { defineConfig } from 'rolldown'

export default defineConfig({
    input: 'src/main.ts',
    output: {
        format: 'esm',
        file: 'dist/main.js',
    },
    external: ['@moostjs/event-cli', 'moost'],
})
