const esbuild = require('esbuild')
const esbuildPluginTsc = require('esbuild-plugin-tsc')
//=IF (type === 'http')
const { spawn } = require('child_process')
//=END IF

const watch = process.argv[2] === 'watch'

esbuild[watch ? 'context' : 'build']({
    entryPoints: [
        './src/main.ts',
    ],
    logLevel: 'info',
    bundle: true,
    outdir: './dist',
    platform: 'node',
    packages: 'external',
    sourcemap: watch,
    plugins: [esbuildPluginTsc()],
}).then(async ctx => {
    if (watch) {
        //=IF (type === 'http')
        const nodemon = spawn('nodemon', { stdio: 'inherit' })
        process.on('SIGTERM', async () => { nodemon.kill(); await ctx.dispose() })
        //=END IF
        await ctx.watch()
    }
})
