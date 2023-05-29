//=IF (type === 'http')
const run = require('@rollup/plugin-run')
//=END IF
const ts = require('@rollup/plugin-typescript')
//=IF (type === 'http')
const dev = process.env.NODE_OPTIONS === '--enable-source-maps'
//=END IF
module.exports = {
    input: './src/main.ts',
    output: {
        file: 'dist/main.js',
        format: 'cjs',
        //=IF (type === 'http')
        sourcemap: dev,
        //=END IF
    },
    plugins: [
        ts(),
        //=IF (type === 'http')
        dev && run() || null,
        //=END IF
    ],
}
