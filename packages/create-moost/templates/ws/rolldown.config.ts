import { defineConfig } from 'rolldown'
import swc from 'unplugin-swc';

export default defineConfig({
    input: 'src/main.ts',
    output: {
        format: 'esm',
        file: 'dist/main.js',
    },
    external: ['@moostjs/event-ws', 'moost'],
    plugins: [
        swc.rolldown(),
    ]
})
