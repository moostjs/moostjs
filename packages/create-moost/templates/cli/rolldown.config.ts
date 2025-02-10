import { defineConfig } from 'rolldown'
import swc from 'unplugin-swc';

export default defineConfig({
    input: 'src/main.ts',
    output: {
        format: 'cjs',
        file: 'dist/main.cjs',
    },
    external: ['@moostjs/event-cli', 'moost'],
    plugins: [
        swc.rolldown(),
    ]
})